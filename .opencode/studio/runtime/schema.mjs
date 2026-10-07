export const workflowSchema = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['status', 'bind', 'get', 'create', 'adopt', 'begin', 'amend_scope', 'submit', 'review', 'verify', 'checkpoint', 'accept', 'reject', 'block', 'resume', 'invalidate', 'relocate', 'recover'] },
    id: { type: 'string' }, mode: { type: 'string', enum: ['concept', 'development'] },
    card: { type: 'object', additionalProperties: true },
    report: { type: 'object', additionalProperties: true },
    worktree: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' }, commit: { type: 'string' }, owner_quote: { type: 'string' },
    verdict: { type: 'string', enum: ['APPROVED', 'CHANGES_REQUESTED'] },
    spec: { type: 'string', enum: ['PASS', 'FAIL'] }, quality: { type: 'string', enum: ['PASS', 'FAIL'] },
    criteria: { type: 'array', items: { type: 'string' } }, notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['action'], additionalProperties: false,
}
