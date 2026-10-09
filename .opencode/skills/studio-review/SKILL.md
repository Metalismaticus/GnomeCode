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
Do not re-run checks the executor already ran green: re-run only what was red,
what the changed code touches, plus your own spot checks — the full run belongs
to engine `verify`, once. An old unrelated defect, taste or "could be prettier"
is not an in-scope failure. No editing, committing, accepting or weakening
tests. Vision unavailable must remain a limitation, not an invented «Вижу».
Numbers do not judge similarity.

**Round 1** is the full review: specification, quality, all criteria.
**Rounds 2+ are delta reviews** (the session is still fresh; the scope is not):
1. take every stored note of the previous round and mark it resolved or not,
   with evidence of where and how it was addressed;
2. re-check the acceptance criteria **on the changed files only**;
3. regressions anywhere the change can reach.
A new finding outside the changed scope is «Замечено вне пункта» in the report
— it does not block. If every stored note is resolved and criteria hold on the
changed files, approve; do not restart the full inspection.

Call `review` on the named task. `APPROVED` requires `spec:"PASS"`,
`quality:"PASS"` and `criteria`, one evidence string per acceptance criterion.
`CHANGES_REQUESTED` requires notes in four parts each: the violated criterion
or code rule · path:line · observed symptom · «готово, когда» for the fix.
A note without a file reference is rejected by the runtime; out-of-scope
observations belong in the report. Every new round has a fresh reviewer
session. The state counter stops at three.
The Russian original report is returned to the coordinator for BATCH.
