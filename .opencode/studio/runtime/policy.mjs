import fs from 'node:fs'
import path from 'node:path'
import { baseRole } from './contracts.mjs'

function within(root, file) {
  const relative = path.relative(path.resolve(root), path.resolve(file))
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)
}
function resolvedTarget(file) {
  let parent = path.resolve(file), tail = []
  while (!fs.existsSync(parent)) {
    const next = path.dirname(parent)
    if (next === parent) break
    tail.unshift(path.basename(parent)); parent = next
  }
  return path.join(fs.realpathSync(parent), ...tail)
}
export function editAllowed(engine, actor, resources) {
  const role = baseRole(actor.agent)
  if (['product', 'architect', 'scout', 'reviewer', 'reviewer-fast'].includes(role)) return false
  const state = engine.store.read()
  const mode = state.sessions[actor.sessionID]?.mode
  return resources.length > 0 && resources.every((resource) => {
    const file = path.resolve(engine.root, resource)
    const target = resolvedTarget(file)
    const relative = path.relative(engine.root, file).replaceAll(path.sep, '/')
    if (relative === '.git' || relative.startsWith('.git/') || relative.startsWith('.opencode/')) return false
    if (role === 'executor') {
      const task = Object.values(state.tasks).find((item) => item.worker === actor.sessionID && item.status === 'implementing')
      if (!task || task.coordinator !== actor.parentID) return false
      return task.card.files.some((name) => path.resolve(task.worktree, name) === file) && within(task.worktree, target)
    }
    if (!within(engine.root, target)) return false
    if (role === 'studio') {
      // Coordinator writes project documents, never implementation. Mode
      // separation applies even when a model forgets its textual instructions.
      if (!mode || mode === 'unbound') return false
      return relative.endsWith('.md') || (mode === 'development' && ['.gitignore', '.gitattributes'].includes(relative)) || (mode === 'concept' && relative.startsWith('docs/refs/'))
    }
    if (role === 'designer') return relative.startsWith('docs/specs/') && relative.endsWith('.md')
    if (role === 'reference') return relative.startsWith('docs/refs/')
    if (role === 'assets') return !relative.startsWith('docs/') || relative.startsWith('docs/refs/') || relative === 'docs/orders/ledger.md'
    return false
  })
}

export function shellAllowed(engine, actor, command) {
  const role = baseRole(actor.agent)
  if (['product', 'architect', 'scout', 'designer'].includes(role)) return false
  const mode = engine.store.read().sessions[actor.sessionID]?.mode
  if (role !== 'studio' || mode !== 'concept') return true
  // Deliberately small list: concept can inspect/commit documents and run
  // the original document/image checkers, never launch the game or a build.
  if (/[;&|><`\n\r]/.test(command) || /\$\(|\$\{|\b(?:-c|--command|-Command|-EncodedCommand)\b/i.test(command)) return false
  if (/^git\s+(status|diff|log|show|rev-parse)\b/.test(command)) return true
  if (/^git\s+(add|commit|push)\b/.test(command)) return true // original guard controls named staging/commits
  if (/^(?:python(?:3)?|py\s+-3)\s+(?:-X\s+utf8\s+)?["']?(?:tools\/|\.opencode\/studio\/templates\/tools\/)(roadmap_check|refs_check|look_sheet|asset_check|model_check|code_check)\.py\b/.test(command)) return true
  if (/^(rg|ls|Get-ChildItem)\b/.test(command)) return true
  return false
}
