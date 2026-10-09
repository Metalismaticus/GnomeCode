---
name: studio-acceptance
description: Show and accept a studio batch only from the owner's observed decision, or revert rejected item commits and preserve rejection reasons. Use for /studio/done.
---

# Owner acceptance

Read the original acceptance chapters from
`.opencode/studio/protocols/commands/done/index.md` as each stage is reached:
`00.md` and `01.md` first, then `02.md` (show and ask), `03.md` (revert),
`04.md` (final checks), `05.md` (documents), `06.md` (disputes), `07.md` (report).
Load `studio-vid` for look/feel items. Show «было / стало / образец» before
asking. Only the owner judges acceptance. Technical review is not acceptance.

Bind this chat as development and read `studio_workflow {action:"status"}`.
For a previously interrupted batch, reconcile git and BATCH before adopting
its tasks, quoting the owner's actual resume instruction.

Only `verified` tasks may be accepted. `checkpointed` still needs `verify`.
The original full-run freshness and dependency rules must also pass.
For each final item the owner accepts, call `accept` with the task id and
`owner_quote` exactly from the latest user prompt or completed question answer.
The runtime records observed evidence, refuses fabricated quotations and
checks dependencies. An unanswered or cancelled question is no acceptance.
An old batch that predates machine state needs a fresh card and independent
review; never synthesize APPROVED or verification from an old BATCH line.

For each rejected task call `reject` with the observed quote and the reason
verbatim; then follow the original revert chapter. This transition records
the decision; **it does not execute git revert**. Verify the actual rollback,
then preserve the reason in ROADMAP/BUGS and the passport journal. If the
revert conflicts, stop and retain the rejected task plus conflict record.
Do not mark the batch closed until rollback, final checks and documents finish.
Then call `studio_workflow {action:"close_batch", batch:<партия>}`: the machine
removes `rounds/` except `p<N>-стоп/` and the closed tasks already sit in the
state archive — report what it removed.

Intermediate visual stand/base/choice tasks are checkpoints, not separate
owner acceptances. The final embedding task represents the owner's result;
list earlier checkpoint SHAs in that task's report for the original selective
rollback policy. Do not silently accept every stage from a single «да».
