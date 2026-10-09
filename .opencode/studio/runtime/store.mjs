import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// One shared state for all worktrees, rather than divergent copies per slot.
export function stateDirectory(root) {
  return path.join(path.dirname(root), path.basename(root) + '.wt', 'state')
}

export class Store {
  constructor(directory) { this.directory = directory }
  read() {
    const file = path.join(this.directory, 'workflow.json')
    if (!fs.existsSync(file)) return { version: 1, revision: 0, sessions: {}, tasks: {} }
    const state = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (state.version !== 1) throw new Error('studio: unsupported workflow version')
    return state
  }
  transaction(change) {
    fs.mkdirSync(this.directory, { recursive: true })
    const lock = path.join(this.directory, 'workflow.lock')
    let descriptor
    try { descriptor = fs.openSync(lock, 'wx') } catch (error) {
      if (error.code === 'EEXIST') throw new Error('studio: workflow busy; retry. After a crashed process inspect workflow.lock before removing it.')
      throw error
    }
    let temporary
    try {
      fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }))
      const state = this.read()
      const result = change(state)
      if (result?.then) throw new Error('studio: state transactions must be synchronous')
      state.revision++
      temporary = path.join(this.directory, `workflow-${randomUUID()}.tmp`)
      const fd = fs.openSync(temporary, 'wx')
      try { fs.writeFileSync(fd, JSON.stringify(state, null, 2) + '\n'); fs.fsyncSync(fd) } finally { fs.closeSync(fd) }
      fs.renameSync(temporary, path.join(this.directory, 'workflow.json'))
      temporary = undefined
      return result
    } finally {
      fs.closeSync(descriptor)
      if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary)
      fs.unlinkSync(lock)
    }
  }
  /** Full closed task -> state/archive/<batch>.json; the live state keeps a tombstone. */
  archiveTask(batch, task) {
    const directory = path.join(this.directory, 'archive')
    fs.mkdirSync(directory, { recursive: true })
    const file = path.join(directory, `${String(batch ?? 'unknown').replace(/[^\w.\-]/g, '_')}.json`)
    let data = {}
    try { data = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
    data[task.card.id] = task
    const temporary = file + '.tmp'
    fs.writeFileSync(temporary, JSON.stringify(data))
    fs.renameSync(temporary, file)
  }
}
