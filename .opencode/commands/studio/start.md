---
description: Начать работу в чате разработки — выполнить первый пункт очереди docs/ROADMAP.md, названный или всю доступную очередь (all — без присмотра, окна только в конце), с контрольным коммитом после каждого одобренного шага. Звать по команде /studio/start и по словам владельца «делай» / «делай всё» / «сделай уборку» в чате разработки.
agent: studio
---

What we are running: **$ARGUMENTS**

(Empty or unsubstituted — the argument comes from the owner's message; none there
either — a bare `/studio/start`.)

`/studio/start` takes the first available item of the «Очередь» in `docs/ROADMAP.md`,
`/studio/start <название>` — the named one, `/studio/start all` — all available ones in order
(`/studio/start all <тема>`, «всё про водопад» — the ones available for that topic, likewise
unattended); `/studio/start all x4` («делай всё в 4 потока») — how many items
**are written at the same time** (`x1` — one at a time; permanently — `/studio/parallel`).

The chat where `/studio/start` was invoked is the dev chat («делай» there equals `/studio/start`); the
concept chat is alongside, in the same folder and branch, and writes only `.md` and reference
material in `docs/refs/` (`AGENTS.md`, «Два чата»). A message from another chat or session —
not the owner's word.

No `docs/ROADMAP.md` — the project is not set up: offer `/studio/setup` and stop.

## The essentials

- **This chat is the coordinator.** It does not read or write code; from logs and checks
  it takes only the final lines; it opens the items' look pictures itself (3b,
  «Смотреть самому»). The item is done by a **chain of `executor` subagents**:
  `executor-prep` (recon — a brief file; "before" screenshots of the `[вид]` base) →
  `executor-code` (red proof and implementation; **rounds 2–3 — it alone**) →
  `executor-finish` (short checks, screenshots, the sheet, the full result);
  before the commit
  a fresh `reviewer` checks it (in `/studio/start all` — `reviewer-fast`,
  light mode); `[ui]` — first the `designer` specification;
  waves — `scout`; incoming files — `assets`. Agents — by the subagent tool, by name (`executor-prep`,
`executor-code`, `executor-finish`, `reviewer`, `reviewer-fast`,
`designer`, `scout`, `assets`, `reference`). **An agent did not start**
  (the model from its description is unavailable, overloaded, a startup error before the
  first step, or the provider's usage limit) — call it again with the same message (each
  agent's model is set in its
  `.opencode/agents/<имя>.md` file); if it is unavailable again — wait 2 minutes and try once
  more; still unavailable — **the fallback agent: the same name + `-any`**
  (`executor-code-any`, `reviewer-any`, … — same protocol, no own model:
  it takes THIS chat's model), same message; into the report — the line
  «<имя>: модель <какая> недоступна — после пауз запущен <имя>-any на <какой>»
  (a mid-run death resumes the same way: files and the brief survive, the
  continuation goes to `<имя>-any` on this chat's model);
  do not switch to "all one at a time" over an unavailable model.
- **Continue from `docs/BATCH.md` and the items' commits in git**, not from chat
  memory: after a break or context compaction — section 1, step 3.
- **Questions to the owner — via dialogs** per `.opencode/studio/reference/ASKING.md`; «ждёт» and the agent's «Вопрос владельцу» block — per section 4.
  **`/studio/start all` — unattended** (`ASKING.md`, step 12): after the batch is taken
  there are no dialogs until the end of the run.
- **The `[вид]` variant is chosen by the coordinator** — the one closest to the reference (3b, step 3),
  without a dialog and in single `/studio/start`; the owner judges the result in `/studio/done` —
  «было / стало / образец»; do not write «соответствует образцу» anywhere.
  `[ощущение]` follows the same path through the sheet of variants: in this skill "`[вид]`"
  also means it, except for the "`[ощущение]` differences" at the end of 3b.
- **Checks.** Single `/studio/start`: `reviewer` runs the full run. `/studio/start all`:
  `reviewer-fast` — the item in **light mode**; one full and one long — at the end
  of the batch, in the main folder (section 6); after two culprit searches — a full
  run again on every item. The «замеры» group — not among them, but at the end of the run,
  without a question to the owner (section 6, «Замеры»).
- **No more than three rounds** of "executor → reviewer" per item step, for
  `[вид]` — also three choices (rollback from a choice to the base — 3b step 2), and no
  longer than the **item budget** for its size (the «Бюджет пункта» section
  `docs/TESTING.md`; no size — medium) — section 4, "Over budget".
- **A commit — files by name**, never `git add -A` or `git add .`; in the main
  folder — no `git stash`, `reset --hard`, `clean`: the concept chat's uncommitted `.md`
  files are there. `docs/BATCH.md` — only as a separate `Партия: …` commit: inside
  a `Пункт N:` commit it breaks item rollback. A checkpoint commit is a rollback point, not
  acceptance: only `/studio/done` accepts.
- **Commit messages — per `.opencode/studio/reference/COMMITS.md`**: the marker in the project's
  language (the Russian ones are named below: `Пункт N:` — this is also `Item N:`, `Партия:` —
  `Batch:`; constant messages — there), the first line — what changed for
  the player; search — always with both markers.
- **Documents**, except `docs/BATCH.md`, `docs/specs/`, question lines in
  the «Решения» of `docs/BLOCKED.md` (sections 2 and 4), incoming-file lines in
  `docs/orders/ledger.md` (they are written by `assets` via `/studio/add`), and for `[вид]` — sheets
  in `docs/refs/<тема>/`, the passport's «Журнал» and the target-frame order (3b, step 2a:
  `docs/prompts/`, the `art` table of `BLOCKED.md`), are not edited during the batch by either
  the coordinator or agents: what to add — as a line to the item, `/studio/done` will add it.
- **Report and questions — in product words**, no git terms.

## 1. Prepare the base

1. `git status` and the branch. The branch is not the one in `AGENTS.md` («Два чата») —
   stop and ask via a dialog. Do not touch and do not commit someone else's uncommitted
   work: `.md` and `docs/refs/` (except sheets, the `variant-` and `accepted-`
   files of batch items) — concept-chat work, do not ask; unfamiliar code or
   assets — describe and ask via a dialog (`/studio/start all` — do not ask: into the report).
2. **Incoming order files — first, not by hand:** files outside git in
   the destination folders `docs/orders/*.md` and along the debt paths of `docs/BLOCKED.md`
   (in `docs/refs/` — only `target-*`) — `assets`: "Sort out the incoming files
   by the instructions at `<путь>`" (`.opencode/commands/studio/add.md`).
   Do not open the pictures or the prompts; they do not get into the batch.
3. **A batch already exists in `docs/BATCH.md`** — continue it, do not take a new one.
   Check the lines against git; the item's commits —
   `git log <хеш>..HEAD -E --grep "^(Пункт|Item) N:"`, the hash — from the line
   «Снята … на <хеш>» (each batch has its own numbers), the 3b step — by
   the constant message (`стенд`, `основа —`, `варианты …, выбор K`):
    - `в работе` with an item commit (for `[вид]` — of that step) — done:
      `готов к проверке`; for `[вид]` — the next 3b step; a commit only in
      the `wave/p<N>` copy — merging (3a; the variants commit — after the choice); `[вид]`
      on a choice without a base commit — to the "base" step, round 1/3; with the mark
      «возврат с выбора K на <хеш>» — the base is done only if an
      `основа —` commit exists in `<хеш>..HEAD` (otherwise — the base is on round 2/3 with a review note);
      **chain state** — from the `…/rounds/p<N>-r<R>-…` files: the brief exists,
      no code result — continue with `executor-code`; the code result exists, no
      result — `executor-finish`; both exist, no verdict — `reviewer`
      (section 3, step 5);
    - `в работе` with uncommitted non-`.md` files — do not restart;
      first section 4, "Interruption". Single `/studio/start` — a dialog «Пункт N
      прервался, правки остались — что с ними?»: «Продолжить проверкой
      (Recommended)» — `reviewer` on them; «Откатить и начать заново» — as for
      "failed" in section 4; «Оставить как есть». `/studio/start all` — a check right away;
    - `ждёт выбора` (a batch before 0.10.5) — choose yourself per 3b, step 3 (no «Вижу:»
      for the item — first «Смотреть самому»; the owner's words about the sheet —
      outweigh the reference), then — 3b, step 4;
    - `ждёт: …` — an answer exists (`docs/DECISIONS.md`; for a question in the concept chat —
      by the «Партия <дата>, пункт N» tag) or is given now — section 4; none —
      via a dialog (in `/studio/start all` — at the end); a question with a line in the «Решения»
      of `BLOCKED.md` is not re-asked — the answer will come from `/studio/need`; «Вопросы
      владельцу» — per section 4;
    - no work and no questions — offer `/studio/done` and stop; copies in
      `../<папка проекта>.wt/` outside the current wave — list them.

## 2. Fix the scope

Reread the «Очередь» in `docs/ROADMAP.md`: the concept chat may have changed it.

- Plain `/studio/start` — exactly one item. `/studio/start all` — take all
  `[можно]` items once; what was found along the way — into «Найдено по ходу» and into the report; do not
  extend the batch with it. A `scout` «Узкое место» line — there too, and into the report in
  product words («все пункты шли по одному из-за общего файла проверок»).
- **Cleanups** (items `Уборка:`) — no more than two and no more than half the batch
  (in a batch of 1–3 items — one). First — a cleanup that stands before a batch item
  or a `[ждёт уборки]` one and edits its file (without it — «не удалось: код»),
  even a second shared hub (for such — both cleanups, one per
  wave); the `[ждёт уборки]` item itself — into the same batch, as a wave after it (`scout`:
  «зависит от M»), without waiting for `/studio/done`; then — the first ones in queue order, among them
  a shared-hub cleanup (a registry or runner, a base class, a data schema,
  a root file — «Общие узлы» `docs/TESTING.md`) — one; the rest wait for
  the next batch — as a line in the report. Without the limit — if, besides cleanups, nothing is
  `[можно]`, and via `/studio/start all уборка` («сделай уборку»). An `Уборка:` with two
  «Не выполнен» in the details — do not take: with the line `уборка: пересмотреть
  «Готово, когда» — <пункт>` into «Найдено по ходу» (the goal and the criterion — `/studio/idea`);
  with two «Пересмотрен» — do not hand it over: `/studio/board` will show it
  and the `[ждёт уборки]` one.
  Lines with `уборка:` (the executor's, the reviewer's «Вне круга», the scout's
  «Узкое место», `code_check`) — into «Найдено по ходу», one line per cleanup, each
  starting with `уборка:` (drop the «Вне круга:» prefix): by it `/studio/idea` recognizes them.
- A named item is blocked by a question, a file, or the owner's check —
  explain; take another only with a bare `/studio/start` or `/studio/start all`.
- `[предварительно]` — single `/studio/start` confirms it via a dialog before work;
  unconfirmed — do not take it. `/studio/start all` takes it only if the caveat has
  a "yes" in `docs/DECISIONS.md` (into the report — «по вашему «да» <дата>»); otherwise
  it skips it and, if the line is not there yet, writes into the «Решения» of `BLOCKED.md`: «<пункт>:
  «<оговорка>» — делать так? — /studio/need» (in the batch-taking commit).
- No route marker — determine it by «Маршрут» of `.opencode/commands/studio/idea.md` and write it
  into the batch. Do not take `[вид]` without the conditions of 3b, step 1 (`[ждёт света]` — likewise;
  `[вид]` items per topic per batch — no more than the «Стенд»
  line of `docs/TESTING.md` directs; for a project with a weekly limit — one); `[ощущение]` —
  no more than one per topic, a second of the same topic waits for the next batch.

Write the batch into `docs/BATCH.md` into the **live part of the file** —
replacing the «Пусто.» line above the sample comment; the sample comment is
never filled or edited (a batch written into the comment is invisible to the
protocol). The header lines (with «Последний полный прогон: не было», «Волны:
<the «Параллельная работа» line of `docs/TESTING.md` as read at take time —
never carried over from the sample, the comment or the previous batch>»,
«Язык коммитов: <from the «Git»
of `AGENTS.md`, or by "Language" in `COMMITS.md`>»); the table — number, wave,
item with markers, criterion, `ждёт очереди`. The numbers are stable — `/studio/done
кроме 3` refers to them.

**Waves** — after writing (`scout` reads the batch from the file). `пишут` — from
the argument, otherwise from «Параллельной работы» of `docs/TESTING.md` (`предел: N` =
`пишут: N`), read at take time — never from the sample, the comment or the
previous batch's header. More than one item, «проверено» and `пишут` above 1 —
a fresh `scout` with the numbers and `пишут` is **mandatory, not optional**;
its waves with reasons — verbatim into the header
and the «Волна» column; do not assemble other pairs. With «не проверено» the argument
does not include parallelism; above what is checked — a line in the report. Otherwise
each item — its own wave.

The batch may touch user data (`docs/TESTING.md`) — take a copy,
as it says there, and write it into the header. Before the first item — the **baseline
check** (with it, it is visible which item broke the run): for `/studio/start all` a full
run, for a single item a quick run; the testbed is not «есть» — run what there is and
write down what limits the check. A red baseline — stop and show
the failure, if it is not an intentionally red check from `docs/BUGS.md`.

## 3. Execute one item

A wave of one item — here, in the main folder, **strictly one agent at a
time**: the folder and the product's data are shared. A wave of several — section 3a; `[вид]`
in both — by 3b steps. Waves go in order: the next one — when the previous one is
fully merged or taken down (`[вид]` after the base is merged — 3a).

1. Mark the item `в работе · круг 1/3 · с <дата ЧЧ:ММ>` (the start of the item, not of a step).
2. **`[ui]`** — first a fresh `designer`: "Item N of the batch from
   `docs/BATCH.md`, write the specification to `docs/specs/<дата>-N-<экран>.md`".
   Its result: «Решено за вас» — to the item with the `дизайн:` tag; "В DESIGN.md
   при /studio/done" — into «В документы при `/studio/done`» with the `DESIGN:` prefix; «Вопрос
   владельцу» — section 4, do not call the `executor` chain.
3. **The `executor` chain** — three links, each a fresh subagent; the message —
   one line, "Item N of the batch from `docs/BATCH.md`", plus its own; the brief and
   result paths — full ones, the coordinator names them:
    - **`executor-prep`** — «Бриф: `../<папка проекта>.wt/rounds/p<N>-r<R>-бриф.md`»;
      for `[ui]` — the specification path, for `[вид]` and `[ощущение]` — the step. Its
      «не удалось» or «ждёт» — section 4; «бриф готов» — the next link;
    - **`executor-code`** — the brief path, for `[ui]` — the specification path, for
      `[вид]` — the step and the full path of the technique library
      `.opencode/studio/reference/LOOK_TECHNIQUES.md` (without it the executor
      will find only the project's empty `docs/refs/TECHNIQUES.md`); if
      a shared-hub cleanup is already merged in the batch — also its "В документы при
      /studio/done" line about how to add now (a check, a kind of content): only `/studio/done` edits
      documents. Its «реализовано» — write the code result
      in full into `../<папка проекта>.wt/rounds/p<N>-r<R>-код.md`; to the item —
      «Как увидеть» and «Решено за вас» from it; then — the finish link;
    - **`executor-finish`** — the brief path, the step (`[вид]`/`[ощущение]`), the
      passport path, the same technique-library path, «Файлы» from the code result and
      **the code result verbatim** (from `…/-код.md`). Its «готово» — the chain's result.
    Relay nothing else. **A measurement item**
    (its result is numbers: a stack or render probe, the price of an effect; `scout` schedules
    it alone) — by the same chain, without a dialog (the probe frame pair is judged by `/studio/done`, section 6); busy
    (step 1 of «Замеры» in section 6) — the numbers with a tag, as in step 3 there.
4. «ждёт» or «не удалось» — from any link of the chain — section 4.
5. «готово» (the `executor-finish` result) — write to the item «Как увидеть» and «Решено за вас» from the result,
    the result in full — into `../<папка проекта>.wt/rounds/p<N>-r<R>-итог.md`, and
    start a fresh `reviewer` (light mode — `reviewer-fast`): the item number, route marker, round R/3, mode
    (per "The essentials"), for `[ui]` — the specification path, for `[вид]` — the step, the
    passport path, the same full technique-library path and the «Лист» line, «Файлы»
    and «Как увидеть» from the result, the merged
    shared-hub cleanup's "how to add now" line (as to the executor); the path to
    the result — as the last line.
6. `CHANGES_REQUESTED` — `в работе · круг R/3` (after the third — section 4).
    Copy the item's files into `…/rounds/p<N>-r<R>/` (`cp --parents <файлы>
    <туда>`). A new **`executor-code`** — the round-R brief path (no need to prepare
    anew: prep and finish are not called on a round), the review notes verbatim,
    "fix only them"; the short checks, the screenshots per the note, and the full
    round result — its own; for `[вид]`, where
    the «Вижу:» of two rounds in a row names the same main defect, — also: "<дефект>
    two rounds — this is the method, not the numbers: take the next technique from the «У нас:»
    or «Как сделано у образца» line of the passport, name it «меняю способ: <приём> →
    <приём>, потому что …»" (one change per choice K; then — 3b, step 5). A new
    `reviewer` (in `/studio/start all` — `reviewer-fast`) — **a narrow recheck**: the message
    of step 5, the previous review notes verbatim, and the path to the fix diff (`git diff
    --no-index` of the copied files against the current ones, a new one — against `/dev/null`)
    `…/rounds/p<N>-r<R+1>.diff`.
7. `APPROVED` — check the result's «Файлы» against `git status`, not counting `.md`,
    `docs/refs/` (the concept chat writes there too) and what was someone else's from the
    start (section 1, step 1);
    a mismatch — a fresh `executor-code`: "the result does not match the disk: <файлы> —
    include it in «Файлы» or restore it", then `reviewer`; again — `не выполнен`.
    A match — `готов к проверке · одобрен на круге R/3` (for `[вид]` — only
    after embedding, before it — the next 3b step); to «Как увидеть» — the screenshot
    paths and «Не судил»; into «В документы при `/studio/done`» — the executor's lines, its
    «Ловушка:» and the reviewer's `Ограничение:` (except in light mode — the full
    run at the end will close it); «Замечено вне пункта» and «Вне круга» — into «Найдено
    по ходу» (the reviewer's "решил сам" line — into «Принято по умолчанию»).
    The checkpoint commit — the result's files by name (and the `[ui]` specification); the first
    line — the «Коммит» of the result (`Пункт N: …`; off the rules — rewrite it per «Как
    увидеть»; for the 3b steps «стенд», «основа», «выбор K» — the constant message
    from `COMMITS.md`; for the "base" what changed — from the result's «Коммит»); the body —
    «Как увидеть» in the commit language, without `.wt/shots` paths and check numbers;
    `git log -1 --format=%s` starts with `Item N:` / `Пункт N:`; then
    `docs/BATCH.md`: `Партия: пункт N готов к проверке`.
8. Push, if in `AGENTS.md` checkpoint commits are pushed. A push
    rejected — `git fetch` and `git merge --no-edit origin/<ветка>` (not `pull
    --rebase`: concept-chat `.md` files get in the way), the item's check, and push again;
    a conflict — stop and describe.

## 3a. Wave: items at the same time

This section is the `studio-wave` skill (the skill tool): the batch goes in waves
(`пишут` above 1 — `scout`'s waves, the settings of `docs/TESTING.md` or
`/studio/parallel`) — load it and work by it; `пишут: 0/1` and
a one-item wave — not needed.

## 3b. Item `[вид]` and `[ощущение]`: variants and choice

This section is the `studio-vid` skill (the skill tool). If the queue or the batch
has an item marked `[вид]` or `[ощущение]` — load it **first thing, before
taking the batch** (the conditions — step 1 of the section) and work by it
on every such item and step, including acceptance in `/studio/done`. No
such items — not needed. A wave with `[вид]` — also `studio-wave`
(section 3a).

## 4. Error, question, shared gap

- **«ждёт» and the «Вопрос владельцу» block** of any agent — by substance
  (`ASKING.md`, steps 2 and 12):
  - order and manner of work (what first, how to show, which frame to shoot,
    how to get around an obstacle) — not a question: the recommended one, the line «Решил сам»
    (`ASKING.md`, step 2), into «Принято по умолчанию» of `docs/BATCH.md` (no
    section — add it); the executor stopped — a new `executor-code` with it;
  - a reviewer's question attached to a verdict — the item goes by the verdict (it goes by
    the recommended one); the question — into the item's «Решено за вас» with `[видно]`;
  - "what to do" — the item is `ждёт: <вопрос>`. Single `/studio/start` — a dialog at once.
    `/studio/start all` — a line into the «Решения» of `docs/BLOCKED.md`: «Партия <дата>,
    пункт N «<название>»: <вопрос> — <варианты, рекомендуемый первым>; пока
    нет ответа: <что сделано> — /studio/need» (needs an analysis or a reference — "— /studio/idea
    …") with the commit `Партия: пункт N ждёт ответа` together with `docs/BATCH.md`
    (`BLOCKED.md` with someone else's uncommitted edit — into «Вопросы владельцу»);
    then — the next independent item;
  - installation, measurement, and the like, which can neither be decided without the owner
    nor deferred — single `/studio/start` via a dialog at once; `/studio/start all` — into «Вопросы
    владельцу», via a dialog at the end.

  The answer — «Понял: …», verbatim to the item (into «В документы при `/studio/done`» — for
  `DECISIONS.md`; an answer via `/studio/need` is already there); deferred work — restore (below) and
  a new `executor-code` with the answer verbatim (the round's brief is the same — do not call prep
  anew); «пока не знаю» — as in section 6. A "yes"
  for Pillow is installed by the coordinator (`python -m pip install pillow` with a time
  limit); the line for «Окружение» — into «В документы при `/studio/done`».
- **«не удалось» or three rounds without approval** — restore only
  the uncommitted files from the result (someone else's — concept-chat work): changed —
  `git checkout -- <файлы>`, created by the item — delete; in a copy — reset
  the slot. `не выполнен: <последние замечания>` — and move on.
- **«не удалось: код — <строка находки>»** or **«не удалось: код —
  <сущность> без типа: нужно поле <что> (…)»** — roll back the same way and do not
  retry: the line — first into «Найдено по ходу» with the source at the end
  (`уборка: <строка находки без «уборка:»> — не удалось пункта N`; for
  an entity — `уборка: тип записи <сущность> — нужно поле <что> (…) — не
  удалось пункта N`): by it `/studio/idea` will schedule the cleanup before the item; the item —
  `не выполнен: ждёт уборки <что>`; without a dialog, the batch goes on.
- **Over budget** — the item budget is exceeded (from the start of the line, without waiting for
  the owner and the heavy queue, 3a); after a method change (section 3, step 6) «Вижу:»
  names the same defect, or the executor — «не удалось: способ — …»: copy the files
  into `rounds/p<N>-стоп/` and roll back, as for "failed"; `не выполнен: не уложился
  — <что видно, что пробовали, чем способ плох>`; for `[вид]` after a method change
  — `пересмотр приёма` (3b, step 5: leave the stand and the base), as a line
  into «Найдено по ходу» for `/studio/idea` (the technique, the reference, the size); without a dialog.
- **Interruption** (the owner stopped an agent, a break, compaction) — before continuing,
  a quick run check (Godot — `tools/load_all.gd`, otherwise the "quick" one of
  `docs/TESTING.md`); red — the item's files from the last `rounds/…`
  snapshot or by names, as for "failed", as a line into the report: do not hand over a grey window.
- **Defer started work.** An item became `ждёт` while the batch goes on or the run
  ends — copy its uncommitted result files in the main folder into
  `../<папка проекта>.wt/parked/p<N>/` (`cp --parents`; not into `rounds/` —
  section 6 cleans it) and restore, as above; in the item's line — `отложено:
  .wt/parked/p<N> на <хеш HEAD>`: the next item does not see someone else's half-work
  (in a wave copy the slot is held, 3a). An answer arrived — before the `executor` chain, restore them
  (`cp -r …/parked/p<N>/. .`, delete the folder), if `git diff --quiet <хеш>
  HEAD -- <файлы>`; otherwise the path — for `executor-code`: move them by hand.
- **«Общий пробел»** — two items stumbled over one concrete thing (the same
  file, check, or document section), or two "failed" in a row («не удалось:
  код» — counts only if the file is the same): do not start similar ones; into `## Общий
  пробел` of `docs/BATCH.md` — «<что>; задело N, M»; after the fix, one
  item first. An item's changes cannot be separated, or the shared base broke —
  stop the batch: do not continue over unknown red.

## 5. Rework after the owner's review

The owner asks to rework an item, or disputed a «Решено за вас» in `/studio/done` — the cycle
of section 3: a new `executor-code` with the item number and the owner's words verbatim
(the review notes — as round 2–3: do not call prep and finish anew),
`reviewer`, the commit `Пункт N: поправка — …` (one commit per item); a rework
**of taste** for `[ui]` first goes to `designer` (section 3, step 2), for `[вид]` —
a new choice per 3b, step 2 (his words outweigh the reference; he named a variant —
«встроить вариант X»). To the item in `docs/BATCH.md` — what was reworked.

## 6. Finish the run

**Single `/studio/start`** — there is no separate run: the full run was run by the reviewer
(for `[данные]` there is none), its hash — the item's commit; measurements — below.

**`/studio/start all`** — after the last item (the wave's merge), in the main folder,
**one** full and one long run, then a quick one. New red (it was not there in the baseline
check; checks that the item rewrote per «Готово, когда» or «В документы при
`/studio/done`», — for light, the tone and edge reference images are «снято до
света», — were judged by the reviewer: they are not "new red" and not the culprit):

1. Rerun the reddened ones up to three times: red 1–2 out of 3 — unstable,
   into «Найдено по ходу»; do not fix the product blind.
2. In a free slot (none — create and prepare one; it will not prepare — stop
   the batch) — the reddened ones at the baseline check's hash: red there too — not from
   the batch, into «Найдено по ходу». Otherwise, in the same place, `git bisect` from that hash to
   `main`, running **only the reddened checks** (`git bisect run`, if the exit
   code is honest), then `git bisect reset`; the first bad commit is not
   `Пункт N:` — into «Найдено по ходу».
3. The culprit — in the main folder, `git revert --no-edit` of its `Пункт N:` commits,
   the new ones first. Fewer than three rounds — return the work uncommitted (`git
   restore --source=<хеш до отката> -- <файлы пункта>`), a new `executor` chain
   with the failure text verbatim, a `reviewer` with the reddened checks, the commit
   `Пункт N: …`, the full run again. Otherwise — `не выполнен: <провал>`. A search done
   twice — say so in the report. The failure analysis — to a fresh
   `reviewer`; do not read its conclusion.

**Code health** — after the full run (for single — after the item's commit):
`python -X utf8 tools/code_check.py --changed <хеш снятия> --only` (all
lines, no cutoff at 20); into the context — only «Находки» and `Итог:`.
Findings (not notes: those are old and small, seen by `/studio/board` and `/studio/retro`) — into
«Найдено по ходу» by the same edit of `docs/BATCH.md` as «Последний полный
прогон»: one line per file, all of them. Not red; no
script or exit code 2 — skip. Into the report — «Код: партия добавила N мест для
уборки — встанут в очередь через /studio/idea» (zero — no line).

**Measurements** — the «замеры» line of «Команды проверки» in `docs/TESTING.md` (no
line — «нет»): not «нет», and the batch changed more than only `docs/`,
`tests/`, `tools/`, or measurements wait from last time («Замеры:
отложены» in the header) — load the `studio-perf` skill (the skill tool) and
run by it; otherwise — the line «замеры не нужны». Do not wait for the owner
and do not ask.

In both cases — into the header «Последний полный прогон: <уровень>
<зелёных>/<провалов> на <хеш>»; a separate commit of `docs/BATCH.md`: `Партия:
итог запуска`, the numbers — in the body. Delete the `rounds/` folder, except `p<N>-стоп/`; keep
`shots/` and `parked/`: the report's paths, the item lines, and `/studio/done`'s
"before" lead to them.

**The probe frame pair** — a `[код]` item with «Готово, когда: пара кадров»
(a renderer change, an expensive capability; after accepted light): the protocol
— the `studio-perf` skill (the "Probe frame pair" section), load it.

**Notification.** The end of `/studio/start all`, or stopping the batch — one, if
`PushNotification` is available: «<проект>: N готовы к проверке — /studio/done, M вопросов здесь,
K — /studio/need»; no parts with a zero. **`/studio/start all` dialogs** — after it, and only
«Вопросы владельцу» ones (section 4), no more than two; no variant choice and no probe
frame pair among them — look is judged by `/studio/done`. Before them — no more than 5 lines
for the owner who came back: «Ждёт вас здесь: вопросы — N (окна ниже)»,
«Вопросы в сценарист — N (`/studio/need`)», «Решил сам — N, из них выбор варианта —
M (отменить при `/studio/done`)», «Готово к проверке — N; отчёт — после окон»;
no lines with a zero. The answer — «Понял: …», verbatim to the item (section 4), and
**after the answers the run only finishes** — the report; there is no new `executor` chain
and no new items: the items that waited for an answer — into the report «готовы к следующему
запуску: N — `/studio/start all`». The owner, having answered the dialogs, waits for the end, not
another four hours of work. «Пока не знаю» and the unanswered stay in «Вопросы
владельцу», the item — `ждёт`; `/studio/done` will move them to `BLOCKED.md`.

**The report** — with the numbers from `docs/BATCH.md`; for `/studio/start all`, at the top —
the same «Ждёт вас здесь …» lines (after the answers — what is left), then what was done:

- first — "over budget", "method", and "technique review": the last round's
  «Вижу:», the owner's note, and the line «что предлагаю» (the next technique of the passport
  or the library, split the item, another reference);
- the waves and what ran at the same time, wave failures, the culprit search;
- per finished item — «Как увидеть», «Решено за вас», «Не судил», and the
  screenshot paths on separate lines (if there is a path to a file — show them by it); for `[вид]`
  — the sheets, the choice per round («Решил сам»), and the accepted frame's path; for a probe —
  the frame pair and the measurement table;
- skipped, `не выполнен`, waiting for an answer or a reference (the deferred — the path); hashes;
  «Решил сам» — the lines of «Принято по умолчанию»; questions for the concept chat — by the line;
- what limits the check (the testbed is not «есть», `вид не проверен`), the user-data
  copy, the remaining slots, someone else's uncommitted work from the start;
- measurements: the result per presets, «база переснята: <что сменилось>», «сняты на
  занятом компьютере (<чем>) — числа могут быть хуже настоящих», «отложены»
  or «не состоялись: <причина>»;
- in «Очередь» no `[этап N]` items of the `идёт` stage are left outside this batch —
  the line «Очередь Этапа N кончилась: после `/studio/done` (it will ask whether the stage is
  closed) — in the concept chat `/studio/roadmap следующий`».

The last line is mandatory:

> Check the result in the product per «Как увидеть» and call `/studio/done` — it
> will open the «было / стало / образец» frames and ask what you accept (or right
> away `/studio/done кроме …` / `/studio/done только …`).
