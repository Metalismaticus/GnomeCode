import fs from 'node:fs'
import path from 'node:path'
import { isStudioRole } from './contracts.mjs'

export function checkModel(root, role, actual) {
  if (!isStudioRole(role) || role === 'studio' || role.endsWith('-any')) return
  const file = path.join(root, '.opencode', 'agents', role + '.md')
  const front = fs.readFileSync(file, 'utf8').split('\n---\n')[0]
  const expected = front.match(/^model:\s*(\S+)/m)?.[1]
  if (!expected || !actual?.providerID || !actual?.id) return
  const observed = `${actual.providerID}/${actual.id}`
  if (observed !== expected) throw new Error(`studio: model routing mismatch for ${role}: expected ${expected}, actual ${observed}. Check the OpenCode version/provider; use ${role}-any only as an explicit, reported fallback.`)
}
