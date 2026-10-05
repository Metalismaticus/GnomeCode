---
name: studio — wave
description: Protocol of a parallel wave of items (section 3a of /studio/start) — .wt slots, simultaneous executor chains, one-at-a-time merging, wave failures. Load for the coordinator of /studio/start when the batch's items are written simultaneously (`пишут` above 1).
---

“Section N” references mean the `/studio/start` protocol in the coordinator context; section 3b (`[вид]`/`[ощущение]`) — the `studio-vid` skill.

## 3a. Wave: items at the same time

Each item of the wave — in its own worktree copy from the **«Набор
копий»** set: git worktree `../<папка проекта>.wt/slot<K>` on branch
`wave/p<N>`; the main folder and `main` do not change until the item is
approved. A copy sees only what is committed, so the order is strict:

1. The wave's `[ui]` items — `designer` in the main folder, the result per
   section 3, step 2: all at once if `docs/TESTING.md` has no screenshot
   command, otherwise one at a time; each writes only its own file in
   `docs/specs/`.
2. **The batch commit before copies:** `docs/BATCH.md` (the batch, the
   wave's items `в работе · круг 1/3`) and the wave's specifications by
   name, with the message `Партия: волна W — пункты N, M`. Without it an
   executor in a copy reads the previous batch.
3. One slot per item N. No new one yet — `git worktree add -b wave/p<N>
   "<слот>" main`. A former one — reset per the «Набор копий» section of
   `docs/TESTING.md`, delete the slot's old branch (`git branch -d`, one
   taken down by a failure — `-D`). Do not take a slot whose item is
   `ждёт` or has uncommitted work before the answer; the slot goes into
   the item's line: `ждёт: … · слот K`.
4. All of the wave's `executor` chains — **simultaneously** (several
   subagent calls in one message, the first link — `executor-prep`; then
   each link per section 3, step 3, also simultaneously with the
   neighboring items), no more than `пишут` items: “Item N of the batch
   from `docs/BATCH.md`. Work only in the copy `<полный путь слота>`:
   first prepare it per `docs/TESTING.md`, «Параллельная работа»”, the
   brief's path — as in section 3, step 3, for `[ui]` — the
   specification's path, for `[вид]` — the step and the full path of the
   technique library `.opencode/studio/reference/LOOK_TECHNIQUES.md`
   (section 3, step 3).
5. The wave's results arrive together: the `reviewer`s — in one message
   per section 3, steps 5–6, with the copy's path (pull the files from
   it). **Heavy** ones — full runs with screenshots (`[вид]`, the item
   about the look): there is one GPU, no more than `тяжёлых проверок` of
   them at once, the rest — as it frees up; `executor-finish` screenshots
   as they come — without queueing, this is not a measurement.
   `docs/BATCH.md` is maintained only by the coordinator in the main
   folder; in copies it is not edited and not committed.

**Merging — strictly one at a time, in queue order**, as items get
approved:

1. In the copy: commit the item's files by name, the message per section
   3, step 7; `git rebase main` (conflict — `git rebase --abort`, «Сбой
   волны»); if `main` managed to change — a quick run and the item's
   check, red — «Сбой волны».
2. In the main folder: `git merge --ff-only wave/p<N>`, a quick run; red
   — `git revert --no-edit` of the item's commits, «Сбой волны».
3. In `docs/BATCH.md` — `готов к проверке` and the lines per section 3,
   step 7; the commit `Партия: пункт N готов к проверке`; push if
   commits are being pushed.

**A `[вид]` item in a copy** merges its approved base (`основа —`) the
same way, then the choice runs in the same slot. **Exception to the queue
order:** after merging the base, the item does not hold up the queue —
the following items merge while its choice runs; the variants commit
waits in `wave/p<N>`. After the choice (section 3b, step 3) — in the slot
`git rebase main`, «встроить вариант X», merge. Conflict or red — «Сбой
волны», but the retry — with «встроить» in the main folder: the `executor`
chain gets `git show` of the variants commit, the choice — from the
«Журнал».

Remove clean slots at the end of the run, after section 6 (a slot is
needed for the culprit hunt): `git worktree remove`, `git branch -d`; a
slot with uncommitted work — into the report, do not delete. Checks from
«Нельзя одновременно» — only in the main folder, one at a time; stand
screenshots — in the item's copy, like the heavy ones (step 5): the old
projects' line “снимки стенда — по одному” means the same.

**«Сбой волны»** — an item is not as independent as `scout` promised:
return it to `ждёт очереди` with the note “повтор по одному: <причина>”
and do it **after** the wave per section 3, from scratch; into «Найдено
по ходу» — what the forecast got wrong (an unnamed shared hub — for the
«Общие узлы» section of `docs/TESTING.md`). **False failures** (red in
the copy, green in the main folder) — everything one at a time until the
end of the batch; into «Найдено по ходу» — lower `пишут` or add to
«Нельзя одновременно».
