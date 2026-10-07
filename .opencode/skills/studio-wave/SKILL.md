---
name: studio-wave
description: Parallel waves. Load only when the current studio task needs this branch.
---

# Parallel waves

Read `.opencode/studio/protocols/commands/start/05.md`.
This chapter preserves the original branch, including failures and rollback.
Use scout for wave safety; one task card/worktree per item. The machine
state is shared at the main project, not copied into each slot.
Task transitions use studio_workflow; do not replace them with BATCH labels.
