---
name: studio-wave
description: Parallel waves. Load only when the current studio task needs this branch.
---

# Parallel waves

Read `.opencode/studio/protocols/commands/start/05.md`.
This chapter preserves the original branch, including failures and rollback.
Use scout for wave safety; one task card/worktree per item. The machine
state is shared at the main project, not copied into each slot.
Slots come from the bounded pool: `python -X utf8 tools/slot_pool.py acquire
--item p<N>` per item (it reuses clean slots and switches them to the item's
`wave/<item>` branch), `release` after the checkpoint — the build cache
survives for the next item. Exit code 3 stops the whole batch (low disk).
Task transitions use studio_workflow; do not replace them with BATCH labels.
