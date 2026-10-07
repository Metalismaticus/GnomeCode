---
name: studio-development
description: Run or resume studio development from an owner-approved queue, with task cards, independent review, checked transitions and checkpoint commits. Use for /studio/start or the owner's development request.
---

# Development controller

Bind this primary chat with `studio_workflow {action:"bind", mode:"development"}`.
Read `studio_workflow {action:"status"}` before deciding what is next.
The machine state and git, rather than chat memory, control task transitions.
`docs/BATCH.md` is the human batch ledger; do not silently overwrite either
ledger when they disagree. Inspect git and reconcile explicitly.
If a crashed process left `verifying`, call `recover`; it refuses recovery
while that process is alive, clears no success evidence, and requires rerunning
checks. A new coordinator uses `adopt` with the observed owner resume instruction.

## Prepare and freeze scope

Read `.opencode/studio/protocols/commands/start/00.md`, `01.md`, `02.md`,
then `03.md`. These preserve queue selection, cleanup limits, baseline checks,
existing batches, the three-round limit, interruptions and unattended mode.
Only take tasks already ready in ROADMAP. Do not expand a running batch.
Questions and decisions: `.opencode/studio/reference/ASKING.md`.
Incoming files go to `assets`; interface items go to `designer` first.
Commit a new designer specification with the preparatory BATCH document
before creating a UI card; include it as a source/reference. It remains a
design record, while implementation files form the independent item checkpoint.

If parallelism is enabled, load `studio-wave`; otherwise do not load it.
For `[вид]` or `[ощущение]`, load `studio-vid` before taking the batch.
Read `.opencode/studio/workflows/task-card.md` when creating the first card.

## Make a small, grounded task card

The owner describes the desired player experience. Never ask the owner to
choose a Godot node, class, shader algorithm or file layout.

For a straightforward fix, derive the card from the recorded queue and
ask `scout` to confirm affected files. For a new system, uncertain root cause,
cross-module change or save format, ask `architect` to translate the request
and existing code into the card. No architect meeting for a button offset.
Ask `product` only when the gameplay intent needs elaboration.
Neither the product nor the architect may invent owner preferences.

`create` requires owner words verbatim, player result, acceptance criteria,
invariants, exclusions, source paths, references, checks and concrete files.
Use one id per batch/item/visual step (`b20261007-p2-base`, for example).
The task and its worktree must belong to this project. A pre-existing dirty
scope file blocks the task; do not absorb the concept chat's work.
The card is stored by `studio_workflow`; do not manually edit workflow.json.

## Implement → review → checkpoint

1. `create` the card. `get` a task already present rather than creating again.
2. Launch a fresh `executor` with **task id, item, step, worktree and source
   paths only**. It gets the card from `studio_workflow`, calls `begin`, loads
   `studio-implement` and only needed technical skills, then calls `submit`.
3. On `reviewing`, launch a **fresh** reviewer. `reviewer-fast` for light
   unattended routine work; `reviewer` for full single-item runs, uncertain
   architecture, save/data changes and material risks. Vision unavailable
   remains an explicit limitation; numerical similarity cannot replace sight.
4. The reviewer independently checks specification **and** code quality,
   one evidence row per criterion, before reading the executor's narrative.
   It calls `review`: `APPROVED` needs both `spec:PASS` and `quality:PASS`.
5. `changes_requested`: new executor with the existing id and review notes
   verbatim, fixing only those; new reviewer for the next round. Third failed
   round is `failed`, not a fourth attempt. Method changes and budgets follow
   the original visual/error chapters. `block` records a blocker; resolve it
   before `resume`. Model failure: repeat once, then the same role `-any`
   with the same task id; report the actual fallback model, never silently.
6. On `approved`, compare disk, the reported file list and the original
   chapter `.opencode/studio/protocols/commands/start/04.md`, steps 7–8.
   Commit **only** the named task files, with the player's change first.
   `BATCH.md` is a separate batch commit. Call `checkpoint` with its full SHA.
   The runtime checks item ownership, content digest and committed scope.

The original chapter's old **one-line agent prompt** is superseded by a task
id and source paths. It must not bypass create/begin/submit/review/checkpoint.
Original queue, rollback, snapshots, visual steps and test policies stay in force.
Do not delete machine state or report files when the original chapter cleans
temporary rounds: state is the durable continuation record.

## Finish and verify

Read `.opencode/studio/protocols/commands/start/09.md`: full/long/quick checks
at the documented cadence, flaky failures, culprit isolation, code health,
measurement and the final owner-facing report. Use `studio-perf` only when
performance measurements or probe frames are needed.

For every completed final task, call `verify`. Checks are actually executed
by the runtime, serialized across tasks, against the reviewed snapshot.
Commands in the card come from TESTING.md; use the required full/long/quick
commands for a single task, the item's quick commands for a light task.
The batch-wide full run still happens **once** on the merged main tree.
After a wave merge, re-review/invalidate if the content differs from the
reviewed snapshot; use `relocate` with the main worktree path, then verify there.
Never trust a green slot for a red merge. relocate refuses a changed merge.
No applicable automatic check: empty checks require `verification_limit`,
which must be shown to the owner; `verified` means the declared checks passed,
not proof of the look or gameplay feel.

Task verified ≠ task accepted. Report «Как увидеть», «Решено за вас», screenshots,
limits and remaining questions; tell the owner to inspect and use `/studio/done`.
Owner rework: original chapter `08.md`; create a new task card for the rework,
with `supersedes:<prior-id>` and the observed `owner_quote`, referencing the
prior task and the owner's words rather than overwriting it or resetting failed rounds.
Error, budget, rollback or shared gap: read `07.md` before recovery.
