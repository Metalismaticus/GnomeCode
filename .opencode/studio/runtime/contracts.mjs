import path from 'node:path'

export const ROLES = ['studio', 'product', 'architect', 'executor', 'reviewer', 'reviewer-fast', 'designer', 'scout', 'assets', 'reference']
export const baseRole = (role) => typeof role === 'string' && role.endsWith('-any') ? role.slice(0, -4) : role
export const isStudioRole = (role) => ROLES.includes(baseRole(role))
export function requireText(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`studio: ${name} must be nonempty text`)
  return value
}
export function texts(value, name, required = false) {
  if (!Array.isArray(value) || (required && !value.length)) throw new Error(`studio: ${name} must be a ${required ? 'nonempty ' : ''}list`)
  value.forEach((entry) => requireText(entry, name))
  return value
}
export function relativeFile(value) {
  requireText(value, 'file')
  if (path.isAbsolute(value) || /^[A-Za-z]:/.test(value) || value.includes('\\') || value.split('/').some((part) => part === '..' || !part) || value.startsWith('.git/') || value === '.git') {
    throw new Error(`studio: unsafe file path: ${value}`)
  }
  return value
}
export function taskCard(card) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) throw new Error('studio: task card required')
  for (const key of ['id', 'batch', 'title', 'owner_words', 'goal', 'player_result', 'how_to_see', 'step']) requireText(card[key], key)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/.test(card.id)) throw new Error('studio: invalid task id')
  if (!Number.isInteger(card.item) || card.item < 1) throw new Error('studio: positive batch item required')
  if (!['code', 'bug', 'ui', 'visual', 'feel', 'data', 'cleanup', 'measurement'].includes(card.kind)) throw new Error('studio: invalid task kind')
  if (card.owner_result !== undefined && typeof card.owner_result !== 'boolean') throw new Error('studio: owner_result must be boolean')
  if (card.supersedes !== undefined) requireText(card.supersedes, 'supersedes')
  for (const key of ['acceptance', 'sources', 'files']) texts(card[key], key, true)
  for (const key of ['invariants', 'out_of_scope', 'references', 'skills', 'depends_on']) texts(card[key], key)
  card.files.forEach(relativeFile)
  if (!Array.isArray(card.checks)) throw new Error('studio: checks required; empty only with verification_limit')
  for (const check of card.checks) {
    requireText(check.name, 'check name'); requireText(check.command, 'check command')
    if (!Number.isInteger(check.timeout_ms) || check.timeout_ms < 100 || check.timeout_ms > 1_800_000) throw new Error('studio: check timeout must be 100..1800000 ms')
  }
  if (!card.checks.length) requireText(card.verification_limit, 'verification_limit')
  // Sources are locations, not an invitation to dump whole project histories.
  if (JSON.stringify(card).length > 24_000) throw new Error('studio: task card exceeds 24 KB; use source paths')
  return structuredClone(card)
}

export function reportContract(report, card) {
  if (!report || typeof report !== 'object') throw new Error('studio: structured report required')
  texts(report.files, 'report files')
  if (!report.files.length) requireText(report.nothing_to_change, 'nothing_to_change reason')
  for (const file of report.files) {
    relativeFile(file)
    if (!card.files.includes(file)) throw new Error(`studio: report exceeds scope: ${file}; amend the card before editing`)
  }
  requireText(report.summary, 'summary'); requireText(report.how_to_see, 'how_to_see')
  requireText(report.red_proof, 'red_proof (or explicit not applicable reason)')
  requireText(report.checks, 'checks'); texts(report.decisions, 'decisions'); texts(report.limitations, 'limitations')
  if (['visual', 'feel', 'ui'].includes(card.kind)) {
    texts(report.artifacts, 'artifacts', true)
    requireText(report.visual_review, 'visual_review (or explicit vision unavailable)')
  }
  return structuredClone(report)
}
