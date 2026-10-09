import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { relativeFile } from './contracts.mjs'

export function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 }).trim()
}
export function workingFiles(root) {
  const tracked = git(root, 'diff', '--name-only', '-z', 'HEAD').split('\0').filter(Boolean)
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean)
  return [...new Set([...tracked, ...untracked])].sort()
}
export function fileDigest(root, file) {
  relativeFile(file)
  const location = path.resolve(root, file)
  const digest = createHash('sha256').update(file + '\0')
  if (!fs.existsSync(location)) return digest.update('deleted').digest('hex')
  // Resolve symlinks too: a slot must not silently edit another worktree.
  const target = fs.realpathSync(location)
  const boundary = path.relative(fs.realpathSync(root), target)
  if (boundary.startsWith('..' + path.sep) || boundary === '..' || path.isAbsolute(boundary)) throw new Error(`studio: file escapes worktree: ${file}`)
  const stat = fs.statSync(target)
  if (!stat.isFile()) throw new Error(`studio: expected file: ${file}`)
  return digest.update(String(stat.mode & 0o111)).update(fs.readFileSync(target)).digest('hex')
}
export function snapshot(root, files) {
  return createHash('sha256').update(JSON.stringify([...new Set(files)].sort().map((file) => [file, fileDigest(root, file)]))).digest('hex')
}
export function baseline(root) {
  return Object.fromEntries(workingFiles(root).map((file) => [file, fileDigest(root, file)]))
}
export function projectSnapshot(root) {
  // Blob ids cover committed product files cheaply; hash only dirty/untracked
  // content. A documentation-only commit does not invalidate a full run.
  const relevant = (file) => !file.endsWith('.md') && !file.startsWith('docs/') && !file.startsWith('.opencode/')
  const tree = git(root, 'ls-tree', '-rz', 'HEAD').split('\0').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t')
    return [entry.slice(tab + 1), entry.slice(0, tab)]
  }).filter(([file]) => relevant(file))
  const dirty = workingFiles(root).filter(relevant).map((file) => [file, fileDigest(root, file)])
  return createHash('sha256').update(JSON.stringify([tree, dirty])).digest('hex')
}
export function sameProject(left, right) {
  // realpathSync.native returns the canonical Windows long form: TEMP may give
  // 8.3 names (METALI~1) while git prints absolute long paths - plain
  // realpathSync keeps both forms and the same folder fails the comparison.
  const canonical = (p) => fs.realpathSync.native(p)
  const common = (root) => canonical(path.resolve(root, git(root, 'rev-parse', '--git-common-dir')))
  return common(left) === common(right)
}
export function worktreeInfo(root) {
  const entries = []
  for (const block of git(root, 'worktree', 'list', '--porcelain').split('\n\n')) {
    const lines = block.split('\n').filter(Boolean)
    const pathLine = lines.find((line) => line.startsWith('worktree '))
    if (!pathLine) continue
    const branchLine = lines.find((line) => line.startsWith('branch '))
    entries.push({ path: pathLine.slice('worktree '.length), branch: branchLine ? branchLine.slice('branch refs/heads/'.length) : null })
  }
  return entries
}
export function assertScope(task) {
  for (const file of workingFiles(task.worktree)) {
    if (task.card.files.includes(file)) continue
    if (task.baseline[file] === fileDigest(task.worktree, file)) continue
    // The owner/concept chat edits Markdown concurrently. These files cannot
    // enter the item commit, but their appearance does not cancel an item.
    if (file.endsWith('.md') || file.startsWith('docs/refs/')) continue
    throw new Error(`studio: changed file outside task: ${file}`)
  }
  for (const file of task.card.files) {
    if (Object.hasOwn(task.baseline, file)) throw new Error(`studio: scope contains pre-existing uncommitted work: ${file}`)
  }
}
export function assertCheckpoint(task, commit) {
  if (!/^[0-9a-f]{40,64}$/.test(commit)) throw new Error('studio: full commit SHA required')
  if (!task.report.files.length) {
    if (git(task.worktree, 'rev-parse', 'HEAD') !== commit || task.card.files.some((file) => fileDigest(task.worktree, file) !== task.original[file])) throw new Error('studio: an already satisfied item must match the unchanged baseline')
    return // No empty commit: record the inspected existing HEAD honestly.
  }
  const subject = git(task.worktree, 'show', '-s', '--format=%s', commit)
  if (!new RegExp(`^(Item|Пункт) ${task.card.item}:`).test(subject)) throw new Error('studio: checkpoint must belong to this batch item')
  const files = git(task.worktree, 'diff-tree', '--no-commit-id', '--name-only', '-r', commit).split('\n').filter(Boolean)
  if (!files.length || files.some((file) => !task.card.files.includes(file))) throw new Error('studio: checkpoint contains unreported/out-of-scope files')
  if (files.includes('docs/BATCH.md')) throw new Error('studio: BATCH needs a separate commit')
  if (git(task.worktree, 'rev-parse', 'HEAD') !== commit) throw new Error('studio: checkpoint must be current HEAD in the item worktree')
  // A commit of older content cannot masquerade as a reviewed snapshot.
  for (const file of task.report.files) {
    if (git(task.worktree, 'status', '--porcelain', '--', file)) throw new Error(`studio: uncommitted changes after checkpoint: ${file}`)
  }
}
