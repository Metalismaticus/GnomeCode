---
name: studio-board
description: Follow the original studio board process with stage-local context. Use for /studio/board.
---

# /studio/board

Read-only command: do not bind or change chat mode.
Call studio_workflow status for the actual next stage and limits.
For live worktrees and disk use call studio_workflow {action:"tidy"} — read-only:
worktrees without active tasks (with their branches and dirtiness) and the
sizes of `.wt/` state, usage, `rounds/` and `docs/prompts/`.

Read the introductory chapter, then each chapter **when that stage is reached**.
Do not load all chapters at once; cross-references use this table.

- `.opencode/studio/protocols/commands/board/00.md` — Вводные правила

Original feature rules remain in force. API routing comes from the studio
coordinator and role skills; no old instruction may bypass runtime gates.
