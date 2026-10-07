---
name: studio-review
description: Independently review a studio task against its specification and code quality, with criterion evidence, own checks and honest visual limits. Use as reviewer or reviewer-fast.
---

# Review one card independently

Get the task by id. It must be `reviewing`. Work only in its worktree.
Read the original reviewer chapters in `.opencode/studio/protocols/agents/reviewer/`:
`00.md`, `01.md`, `02.md`, `06.md` and `07.md`. At rounds 2–3 also `05.md`.
Look tasks need `03.md`; feel tasks need `04.md`; UI needs its spec and shots.
Load `studio-godot` for Godot-specific checks; shader changes also its shader skill.

Inspect sources, diff and images **before** the executor's narrative report.
Keep two explicit conclusions:
1. Specification: each acceptance criterion, invariants, scope and owner words.
2. Code quality: demonstrable bugs, regressions, code rules and own test results.

Use light mode for reviewer-fast; full/long runs remain at the original cadence.
An old unrelated defect, taste or "could be prettier" is not an in-scope failure.
No editing, committing, accepting or weakening tests. Vision unavailable must
remain a limitation, not an invented «Вижу». Numbers do not judge similarity.

Call `review` on the named task. `APPROVED` requires `spec:"PASS"`,
`quality:"PASS"` and `criteria`, one evidence string per acceptance criterion.
`CHANGES_REQUESTED` requires concrete notes, with basis/path/observed symptom.
Every new round has a fresh reviewer session. The state counter stops at three.
The Russian original report is returned to the coordinator for BATCH.
