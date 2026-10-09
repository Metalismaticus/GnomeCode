import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { Store, stateDirectory } from './store.mjs'
import { taskCard, reportContract, requireText, texts, baseRole, isStudioRole } from './contracts.mjs'
import { git, baseline, snapshot, fileDigest, assertScope, assertCheckpoint, sameProject, projectSnapshot, worktreeInfo } from './git.mjs'
import { runChecks } from './checks.mjs'

const NEXT = {
  ready: 'executor', implementing: 'executor (resume)', reviewing: 'fresh reviewer',
  changes_requested: 'fresh executor, only review notes', approved: 'checkpoint or verify',
  verifying: 'wait for running checks', verified: 'checkpoint or owner acceptance',
  checkpointed: 'verify on merged main tree, then /studio/done', blocked: 'resolve the recorded blocker',
  failed: 'record failure; preserve files and follow failure workflow',
  accepted: 'update documents per /studio/done', rejected: 'revert item commits per /studio/done',
}
function at() { return new Date().toISOString() }
function dirSize(directory) {
  let total = 0
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) total += dirSize(child)
    else { try { total += fs.statSync(child).size } catch {} }
  }
  return total
}
function taskOf(state, id) {
  const task = state.tasks[id]
  if (!task) throw new Error(`studio: unknown task: ${id}`)
  return task
}
function status(task, allowed) {
  if (!allowed.includes(task.status)) throw new Error(`studio: ${task.status} cannot do this; next: ${NEXT[task.status]}`)
}
function coordinator(actor, state) {
  if (baseRole(actor.agent) !== 'studio' || actor.parentID) throw new Error('studio: only the primary coordinator can do this')
  if (!state.sessions[actor.sessionID]) throw new Error('studio: bind this session mode first')
}
function dev(actor, state, task) {
  coordinator(actor, state)
  if (state.sessions[actor.sessionID].mode !== 'development') throw new Error('studio: concept chat cannot implement or accept tasks')
  if (task && task.coordinator !== actor.sessionID) throw new Error('studio: task belongs to another coordinator; use adopt after interruption')
}
function worker(actor, task, roles) {
  if (!roles.includes(baseRole(actor.agent)) || actor.parentID !== task.coordinator) throw new Error('studio: wrong task role or parent session')
}
function record(task, action, actor, detail = '') {
  task.history.push({ at: at(), action, session: actor.sessionID, agent: actor.agent, detail })
  task.history = task.history.slice(-40)
}
function dependencies(state, task, accepted = false) {
  for (const id of task.card.depends_on) {
    const upstream = taskOf(state, id)
    const allowed = accepted && upstream.card.owner_result !== false ? ['accepted'] : ['checkpointed', 'verified', 'accepted']
    if (!allowed.includes(upstream.status)) throw new Error(`studio: dependency ${id} is ${upstream.status}`)
  }
}
function unchanged(task) {
  assertScope(task)
  if (snapshot(task.worktree, task.card.files) !== task.reviewed_snapshot) throw new Error('studio: files changed since review; request a new review')
}

export class Engine {
  constructor(root, options = {}) {
    this.root = fs.realpathSync(root)
    let mainRoot = this.root
    try {
      const first = git(this.root, 'worktree', 'list', '--porcelain').split('\n').find((line) => line.startsWith('worktree '))
      if (first) mainRoot = first.slice('worktree '.length)
    } catch {} // /setup may run before git init
    this.store = options.store ?? new Store(stateDirectory(mainRoot))
    this.runChecks = options.runChecks ?? runChecks
  }
  observeOwner(sessionID, text, source = 'prompt', intent = null) {
    if (typeof text !== 'string' || !text.trim()) return
    this.store.transaction((state) => {
      const session = state.sessions[sessionID] ??= { mode: 'unbound' }
      // Evidence comes only from a user prompt or a completed question tool.
      // It is not accepted as an argument supplied by an agent.
      const inferred = /(?:принимаю|не принимаю|отклоняю|\/studio\/done\s+(?:всё|все|только|кроме))/i.test(text) ? 'acceptance' : null
      const evidence = { id: randomUUID(), text, source, intent: intent ?? inferred, at: at(), revision: state.revision + 1 }
      session.owner_evidence = evidence
      session.owner_evidence_history = [...(session.owner_evidence_history ?? []), evidence].slice(-32)
    })
  }
  evidence(state, actor, quote, decision = false) {
    requireText(quote, 'owner_quote')
    const session = state.sessions[actor.sessionID]
    const evidence = (session?.owner_evidence_history ?? []).findLast((item) => item.text.includes(quote) && (!decision || item.intent === 'acceptance'))
    if (!evidence) throw new Error('studio: owner decision must quote an observed prompt/question answer verbatim; acceptance requires an explicit decision')
    return evidence
  }
  summary(state = this.store.read()) {
    return { revision: state.revision, tasks: Object.values(state.tasks).map((task) => ({ id: task.card.id, item: task.card.item, step: task.card.step, title: task.card.title, status: task.status, round: task.round, next: NEXT[task.status], worktree: task.worktree, limitations: task.report?.limitations ?? [] })) }
  }
  // Compact projections for per-request context injection: keep the whole
  // studio state out of every worker's token budget.
  compactSummary(state = this.store.read()) {
    const active = Object.values(state.tasks).filter((task) => !['accepted', 'rejected'].includes(task.status)).slice(-16)
    return active.map((task) => [task.card.id, task.status, task.round])
  }
  workerSummary(sessionID, state = this.store.read()) {
    const task = Object.values(state.tasks).findLast((item) => item.worker === sessionID && !['accepted', 'rejected'].includes(item.status))
    return task ? { id: task.card.id, status: task.status, round: task.round } : null
  }
  actorTask(state, actor, id) {
    const task = taskOf(state, id)
    if (actor.sessionID !== task.coordinator && actor.parentID !== task.coordinator) throw new Error('studio: task belongs to another session')
    return task
  }
  async execute(input, actor, signal) {
    requireText(actor.sessionID, 'authenticated sessionID')
    if (!isStudioRole(actor.agent)) throw new Error('studio: tool is for studio roles only')
    if (input.action === 'status') return this.summary()
    if (input.action === 'get') {
      const state = this.store.read(), task = this.actorTask(state, actor, input.id)
      return { ...structuredClone(task), next: NEXT[task.status] }
    }
    if (input.action === 'verify') return this.verify(input, actor, signal)
    return this.store.transaction((state) => {
      const extra = {}
      if (input.action === 'bind') {
        if (baseRole(actor.agent) !== 'studio' || actor.parentID) throw new Error('studio: only primary studio can bind a chat')
        if (!['concept', 'development'].includes(input.mode)) throw new Error('studio: concept or development mode required')
        const session = state.sessions[actor.sessionID] ??= {}
        if (session.mode && session.mode !== 'unbound' && session.mode !== input.mode) throw new Error('studio: use a separate chat for the other mode')
        session.mode = input.mode
        return { mode: input.mode, ...this.summary(state) }
      }
      if (input.action === 'create') {
        dev(actor, state)
        const card = taskCard(input.card)
        if (state.tasks[card.id]) throw new Error('studio: task id already exists; get it instead of overwriting')
        const sameStep = Object.values(state.tasks).findLast((item) => item.card.batch === card.batch && item.card.item === card.item && item.card.step === card.step && !item.superseded_by)
        if (sameStep) {
          if (card.supersedes !== sameStep.card.id || !['verified', 'accepted', 'rejected'].includes(sameStep.status)) throw new Error('studio: this batch item/step already has a task; get it instead of resetting rounds')
          const proof = this.evidence(state, actor, input.owner_quote)
          if (proof.revision <= sameStep.review_revision) throw new Error('studio: rework instruction predates the reviewed result')
        }
        const worktree = fs.realpathSync(input.worktree ?? this.root)
        if (!sameProject(worktree, this.root)) throw new Error('studio: task worktree is not part of this project')
        let ownerWordsFound = false
        for (const source of card.sources) {
          const file = source.split('#')[0]
          if (!fs.existsSync(path.resolve(this.root, file))) throw new Error(`studio: missing task source: ${source}`)
          ownerWordsFound ||= fs.readFileSync(path.resolve(this.root, file), 'utf8').includes(card.owner_words)
        }
        if (!ownerWordsFound) throw new Error('studio: owner_words must be quoted verbatim from a task source')
        const task = { card, worktree, coordinator: actor.sessionID, status: 'ready', round: 0,
          base_commit: git(worktree, 'rev-parse', 'HEAD'), baseline: baseline(worktree),
          original: Object.fromEntries(card.files.map((file) => [file, fileDigest(worktree, file)])), history: [], checks: [], checkpoints: [] }
        assertScope(task); dependencies(state, task)
        state.tasks[card.id] = task; record(task, 'create', actor)
        if (sameStep) sameStep.superseded_by = card.id
        return { id: card.id, status: task.status, next: NEXT[task.status] }
      }
      if (input.action === 'tidy') {
        coordinator(actor, state)
        const canonical = (p) => { try { return fs.realpathSync.native(p) } catch { return null } }
        const rootCanon = canonical(this.root)
        const worktrees = worktreeInfo(this.root).flatMap(({ path: wtPath, branch }) => {
          const canon = canonical(wtPath)
          if (!canon || canon === rootCanon) return []
          const active = Object.values(state.tasks).some((item) => !item.archived && !['accepted', 'rejected'].includes(item.status) && item.worktree && canonical(item.worktree) === canon)
          let dirty = null
          if (fs.existsSync(wtPath)) { try { dirty = git(wtPath, 'status', '--porcelain').trim() !== '' } catch { dirty = null } }
          return [{ path: wtPath, branch, active, dirty }]
        })
        const size = (p) => (fs.existsSync(p) ? dirSize(p) : 0)
        return { worktrees, bytes: { state: size(this.store.directory), usage: size(path.join(path.dirname(this.store.directory), 'usage')), rounds: size(path.join(this.root, 'rounds')), 'docs/prompts': size(path.join(this.root, 'docs', 'prompts')) } }
      }
      if (input.action === 'close_batch') {
        dev(actor, state)
        requireText(input.batch, 'batch id')
        const open = Object.values(state.tasks).filter((item) => !item.archived && item.card.batch === input.batch && !['accepted', 'rejected'].includes(item.status))
        if (open.length) throw new Error(`studio: batch still has open tasks: ${open.map((item) => item.card.id).join(', ')}`)
        const removed = [], kept = []
        const rounds = path.join(this.root, 'rounds')
        if (fs.existsSync(rounds)) {
          for (const name of fs.readdirSync(rounds)) {
            if (/^p\d+-стоп$/u.test(name)) { kept.push(name); continue }
            fs.rmSync(path.join(rounds, name), { recursive: true, force: true })
            removed.push(name)
          }
        }
        return { batch: input.batch, rounds_removed: removed, rounds_kept: kept }
      }
      const task = input.action === 'adopt' ? taskOf(state, input.id) : this.actorTask(state, actor, input.id)
      if (input.action === 'adopt') {
        coordinator(actor, state)
        if (state.sessions[actor.sessionID].mode !== 'development') throw new Error('studio: development chat required')
        if (task.status === 'verifying') this.recoverVerification(task)
        this.evidence(state, actor, input.owner_quote)
        task.coordinator = actor.sessionID; delete task.worker; record(task, 'adopt', actor, input.owner_quote)
      } else if (input.action === 'begin') {
        worker(actor, task, ['executor'])
        status(task, ['ready', 'changes_requested', 'implementing'])
        dependencies(state, task)
        if (task.status !== 'implementing') task.round++
        if (task.round > 3) throw new Error('studio: maximum three rounds; stop the item')
        task.worker = actor.sessionID; task.status = 'implementing'; record(task, 'begin', actor)
      } else if (input.action === 'amend_scope') {
        dev(actor, state, task); status(task, ['ready', 'implementing', 'changes_requested'])
        texts(input.files, 'new scope files', true)
        const nextCard = taskCard({ ...task.card, files: input.files })
        requireText(input.reason, 'scope reason')
        for (const file of nextCard.files) {
          if (!Object.hasOwn(task.original, file)) task.original[file] = fileDigest(task.worktree, file)
        }
        task.card = nextCard; assertScope(task); record(task, 'amend_scope', actor, input.reason)
      } else if (input.action === 'submit') {
        worker(actor, task, ['executor']); status(task, ['implementing'])
        if (task.worker !== actor.sessionID) throw new Error('studio: executor lease belongs to another session')
        task.report = reportContract(input.report, task.card); assertScope(task)
        for (const file of task.card.files) {
          if (task.original[file] !== fileDigest(task.worktree, file) && !task.report.files.includes(file)) throw new Error(`studio: changed file absent from report: ${file}`)
        }
        task.submitted_snapshot = snapshot(task.worktree, task.card.files)
        task.status = 'reviewing'; record(task, 'submit', actor)
      } else if (input.action === 'review') {
        worker(actor, task, ['reviewer', 'reviewer-fast']); status(task, ['reviewing'])
        if (actor.sessionID === task.worker) throw new Error('studio: executor cannot review its own work')
        if (task.history.some((entry) => entry.action === 'review' && entry.session === actor.sessionID)) throw new Error('studio: each round needs a fresh reviewer session')
        assertScope(task)
        if (snapshot(task.worktree, task.card.files) !== task.submitted_snapshot) throw new Error('studio: submitted files changed during review')
        texts(input.notes, 'review notes')
        if (!['APPROVED', 'CHANGES_REQUESTED'].includes(input.verdict)) throw new Error('studio: invalid verdict')
        if (input.verdict === 'APPROVED') {
          if (input.spec !== 'PASS' || input.quality !== 'PASS') throw new Error('studio: both spec and quality review must pass')
          if (!Array.isArray(input.criteria) || input.criteria.length !== task.card.acceptance.length) throw new Error('studio: evidence required for every acceptance criterion')
          for (const row of input.criteria) requireText(row, 'criterion evidence')
          task.reviewed_snapshot = task.submitted_snapshot; task.status = 'approved'
        } else {
          texts(input.notes, 'review notes', true)
          for (const note of input.notes) if (!/[\w\-]+\.[A-Za-z0-9]{1,5}|\b\d+:\d+\b|\/[\w\-.]+/.test(note)) throw new Error('studio: every review note needs a file or path reference (rule · path:line · observed symptom · «готово, когда»); out-of-scope observations belong in the report, not blocking notes')
          task.status = task.round >= 3 ? 'failed' : 'changes_requested'
        }
        task.review = { verdict: input.verdict, spec: input.spec, quality: input.quality, criteria: input.criteria, notes: input.notes }
        task.review_revision = state.revision + 1
        record(task, 'review', actor, input.verdict)
      } else if (input.action === 'checkpoint') {
        dev(actor, state, task); status(task, ['approved', 'verified']); unchanged(task)
        assertCheckpoint(task, input.commit)
        task.checkpoints.push(input.commit); task.status = 'checkpointed'; record(task, 'checkpoint', actor, input.commit)
      } else if (input.action === 'accept' || input.action === 'reject') {
        dev(actor, state, task)
        status(task, input.action === 'accept' ? ['verified'] : ['approved', 'verified', 'checkpointed', 'blocked', 'failed'])
        if (input.action === 'accept') {
          if (task.superseded_by) throw new Error('studio: task superseded by owner rework; accept the new result')
          if (task.card.owner_result === false) throw new Error('studio: intermediate visual stage is a checkpoint, not an owner acceptance')
          unchanged(task); dependencies(state, task, true)
          if (!task.checkpoints.length) throw new Error('studio: checkpoint required before owner acceptance')
          if (projectSnapshot(task.worktree) !== task.verified_project_snapshot) throw new Error('studio: product changed since verification; run verify again')
        }
        const proof = this.evidence(state, actor, input.owner_quote, input.action === 'accept')
        if (proof.revision <= task.review_revision) throw new Error('studio: decision predates the reviewed result')
        if (input.action === 'reject') { requireText(input.reason, 'verbatim rejection reason'); this.evidence(state, actor, input.reason) }
        task.owner_decision = { quote: input.owner_quote, reason: input.reason ?? '', evidence_id: proof.id, source: proof.source }
        task.status = input.action === 'accept' ? 'accepted' : 'rejected'; record(task, input.action, actor, input.owner_quote)
        // Close-out: the full task goes to the batch archive; the live state
        // keeps a small tombstone so dependency checks still resolve it.
        this.store.archiveTask(task.card.batch, structuredClone(task))
        state.tasks[task.card.id] = { archived: true, status: task.status, round: task.round,
          card: { id: task.card.id, batch: task.card.batch, item: task.card.item, title: task.card.title },
          owner_decision: task.owner_decision }
        extra.cleanup = this.cleanupWorktree(task)
      } else if (input.action === 'block') {
        if (baseRole(actor.agent) === 'studio') dev(actor, state, task)
        else worker(actor, task, ['executor', 'reviewer', 'reviewer-fast'])
        status(task, ['ready', 'implementing', 'reviewing', 'changes_requested', 'approved', 'checkpointed'])
        requireText(input.reason, 'blocker'); task.resume_status = task.status; task.status = 'blocked'; task.blocker = input.reason; record(task, 'block', actor, input.reason)
      } else if (input.action === 'resume') {
        dev(actor, state, task); status(task, ['blocked'])
        requireText(input.reason, 'blocker resolution'); task.status = task.resume_status; delete task.blocker; record(task, 'resume', actor, input.reason)
      } else if (input.action === 'invalidate') {
        dev(actor, state, task); status(task, ['approved', 'verified', 'checkpointed'])
        requireText(input.reason, 'new finding'); task.status = task.round >= 3 ? 'failed' : 'changes_requested'; task.review = { verdict: 'CHANGES_REQUESTED', notes: [input.reason] }; delete task.reviewed_snapshot; record(task, 'invalidate', actor, input.reason)
      } else if (input.action === 'relocate') {
        dev(actor, state, task); status(task, ['approved', 'checkpointed', 'verified'])
        const worktree = fs.realpathSync(requireText(input.worktree, 'merged worktree'))
        if (!sameProject(worktree, this.root)) throw new Error('studio: merged worktree belongs to another project')
        if (snapshot(worktree, task.card.files) !== task.reviewed_snapshot) throw new Error('studio: merge changed reviewed files; invalidate and re-review')
        task.worktree = worktree; task.baseline = baseline(worktree); task.status = 'checkpointed'; delete task.verified_snapshot
        record(task, 'relocate', actor, worktree)
      } else if (input.action === 'recover') {
        dev(actor, state, task); status(task, ['verifying']); this.recoverVerification(task)
        record(task, 'recover-interrupted-verification', actor)
      } else throw new Error(`studio: unknown action: ${input.action}`)
      return { id: task.card.id, status: task.status, round: task.round, next: NEXT[task.status], notes: task.review?.notes ?? [], ...extra }
    })
  }
  /** Remove the item's worktree after a close-out; never touches the main tree, dirty copies or pool slots. */
  cleanupWorktree(task) {
    const notes = []
    try {
      const canonical = (p) => fs.realpathSync.native(p)
      const worktree = canonical(task.worktree)
      if (worktree === canonical(this.root)) return notes
      // A slot registered in tools/slot_pool.py belongs to the pool: leave it
      // for reuse; the pool's release/sync manages its lifecycle.
      const poolFile = path.join(path.dirname(this.root), path.basename(this.root) + '.wt', 'slots.json')
      try {
        const pool = JSON.parse(fs.readFileSync(poolFile, 'utf8')).slots ?? {}
        const name = path.basename(worktree)
        if (/^slot\d+$/.test(name) && pool[name]) {
          notes.push(`pool slot ${name} left for reuse; tools/slot_pool.py release manages it`)
          return notes
        }
      } catch {}
      if (git(worktree, 'status', '--porcelain').trim()) { notes.push(`worktree left with uncommitted changes: ${task.worktree}`); return notes }
      const branch = (worktreeInfo(this.root).find((entry) => { try { return canonical(entry.path) === worktree } catch { return false } }) ?? {}).branch ?? null
      git(this.root, 'worktree', 'remove', task.worktree)
      if (branch) { try { git(this.root, 'branch', '-d', branch) } catch { notes.push(`branch left (not merged): ${branch}`) } }
      notes.push(`worktree removed: ${task.worktree}`)
    } catch (error) {
      notes.push(`worktree cleanup failed: ${error.message}`)
    }
    return notes
  }
  recoverVerification(task) {
    if (task.verification_pid) {
      try { process.kill(task.verification_pid, 0); throw new Error('studio: verification process is still alive; wait or cancel it') }
      catch (error) { if (error.code !== 'ESRCH') throw error }
    }
    task.status = task.before_verify ?? 'checkpointed'
    task.verification_failure = 'verification process interrupted; checks must run again'
    for (const key of ['verification_pid', 'verification_lease', 'before_verify', 'verifying_project_snapshot']) delete task[key]
  }
  async verify(input, actor, signal) {
    const lease = randomUUID()
    const reserved = this.store.transaction((state) => {
      const task = this.actorTask(state, actor, input.id)
      dev(actor, state, task); status(task, ['approved', 'checkpointed', 'verified']); unchanged(task)
      if (Object.values(state.tasks).some((item) => item.status === 'verifying')) throw new Error('studio: another heavy verification is running')
      task.before_verify = task.status; task.status = 'verifying'; task.verification_lease = lease
      task.verification_pid = process.pid
      task.verifying_project_snapshot = projectSnapshot(task.worktree)
      record(task, 'verify-start', actor)
      return structuredClone(task)
    })
    let results, failure
    try { results = await this.runChecks(reserved.worktree, reserved.card.checks, signal) } catch (error) { failure = error.message; results = [] }
    return this.store.transaction((state) => {
      const task = taskOf(state, input.id)
      if (task.verification_lease !== lease) throw new Error('studio: verification lease changed')
      const current = snapshot(task.worktree, task.card.files)
      const project = projectSnapshot(task.worktree)
      const passed = !failure && current === task.reviewed_snapshot && project === task.verifying_project_snapshot && results.length === task.card.checks.length && results.every((row) => row.exit_code === 0 && !row.timed_out && !row.error)
      task.checks = results; task.verification_failure = failure ?? (current !== task.reviewed_snapshot || project !== task.verifying_project_snapshot ? 'product changed during verification' : null)
      task.status = passed ? 'verified' : task.before_verify; delete task.verification_lease; delete task.verification_pid; delete task.before_verify
      task.verified_snapshot = passed ? current : null; record(task, 'verify-finish', actor, passed ? 'PASS' : 'FAIL')
      task.verified_project_snapshot = passed ? project : null; delete task.verifying_project_snapshot
      // A green verify already proves the checked snapshot on this tree: record
      // the checkpoint commit automatically when HEAD satisfies the contract,
      // saving the coordinator one round trip; otherwise the manual path remains.
      if (passed && !task.checkpoints.length) {
        try {
          const head = git(task.worktree, 'rev-parse', 'HEAD')
          assertCheckpoint(task, head)
          task.checkpoints.push(head)
          record(task, 'auto-checkpoint', actor, head)
        } catch {} // HEAD does not satisfy the checkpoint contract - checkpoint manually
      }
      return { id: task.card.id, status: task.status, passed, limitation: task.card.verification_limit ?? null, results, next: NEXT[task.status] }
    })
  }
}
