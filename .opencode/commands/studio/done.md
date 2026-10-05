---
description: Принять проверенную владельцем работу — всю текущую партию из docs/BATCH.md, всё кроме названного или только выбранные пункты; до окна сам открыть на весь экран кадры [вид] «было / стало / образец» (и пару пробы), у [ощущение] — игру с выбранным вариантом; выбор и причины отказа — окнами (у [вид] и [ощущение] отказ — словами, они идут в следующий круг), решённое без вас — строками (оспорить — словами), после «только/кроме» окон о принятом нет; непринятое откатить revert-коммитом, причину записать дословно; принят последний пункт этапа — окном спросить, закрыт ли этап; в конце — разбор партии (/studio/retro) без окон. Звать только по слову владельца — /studio/done или «это не принимаю, остальное принимаю».
agent: studio
---

What the owner accepts: **$ARGUMENTS**

(Empty or left unsubstituted — take it from the owner's message.)

`/studio/done` — the owner has looked at the result in the product and accepts the batch from
`docs/BATCH.md` or part of it: `/studio/done кроме <numbers>`, `/studio/done только <numbers>`;
the phrase «это не принимаю, остальное /studio/done» is the `кроме` form. No batch — say so
and stop.

The batch's commits are already in the main branch: `/studio/start` saves every approved
item there. Accept — keep them and put the documents in order; not accept — revert with a
revert commit. There are no working branches (`AGENTS.md`, «Два чата»).

Questions — via dialogs per `.opencode/studio/reference/ASKING.md`; commit messages, searching them, and README — per
`.opencode/studio/reference/COMMITS.md` (the labels below are named in Russian: `Пункт N:`
is also `Item N:`). The key points:

- **the rejection reason is recorded verbatim** — without it the next pass repeats
  the same mistake;
- **a disputed «Решено за вас» goes into a fix**, not accepted silently;
- **for `[вид]` — «было / стало / образец» full screen before the dialog**: here and
  only here does the owner judge the look; open it yourself — without this there is
  no «что принимаете?» dialog; rejection — in his words, verbatim into the passport's
  «Журнал» and «Не принят», they go into the next round. `[ощущение]` — same as
  `[вид]`, but instead of frames — the game or the stand with the chosen variant and
  its numbers, in «Журнале» — «вариант X (<числа>)» instead of «кадр» (the state is
  also `принят кадр`);
- **do not trust an old green** if non-`.md` files changed after it.

## 1. Gather the batch

From `docs/BATCH.md` — the header («Последний полный прогон») and, per item: the state,
«Как увидеть» (the screenshot paths and the reviewer's «Не судил» are there too),
«Решено за вас», «В документы при `/studio/done`»; the «Решил сам» rows of the
«Принято по умолчанию» section. The item's commits —
`git log <хеш>..HEAD -E --grep "^(Пункт|Item) N:"`, its reverts —
`-E --grep "^Revert .(Пункт|Item) N:"`, the hash — from the header row «Снята … на
<хеш>» (the numbers are each batch's own); their diff must contain no foreign files.
From `docs/ROADMAP.md` (for bugs — also from `docs/BUGS.md`) — the
`Замечание владельца во время партии` rows for the batch's items: the concept chat
writes them; show each one before the acceptance question.
For `[вид]` — the passport from the «Образец» row, the main frame's «Образец для
листа», the accepted frame `docs/refs/<тема>/accepted-<дата>.png`, and «было» — the
main frame from `../<project folder>.wt/shots/<date>-p<N>-before/` (missing — from
earlier `shots/`; missing there too — without «было», as a row).

A per-item summary longer than 5 lines — into a temporary file outside the project,
its path into the chat: long text will cover the dialog. Items `ждёт`, `ждёт
выбора`, and `не выполнен` are unaccepted by definition: they stay in the queue, do
not ask about them; for `ждёт выбора` (batches before 0.10.5) the row and the
commits remain — `/studio/start` will choose the variant.

## 2. Ask

**Frames — before the dialog, by the chat itself; without them there is no
«что принимаете?» dialog.**
The batch has `[вид]` or `[ощущение]` — per the `studio-vid` skill (the skill tool,
section "Acceptance in `/studio/done`"): load it and show the «было / стало /
образец» frames the way it says. Other tags need no frames.

**Cleanups** (items `Уборка:`) — in the summary, one line «технические, игра не
меняется: N»; «проверьте по «Как увидеть», что ничего не сломалось» — only for a
cleanup that changed a shader or a scene, or if the testbed is not `есть` or the
full run is not green; otherwise — «проверено полной проверкой». They have no dialog
of their own, «Пройти по пунктам» does not go through them: they are accepted
together with the batch — with `Всё`, with `кроме …`, and with `только …` — unless
the owner names them himself («кроме уборок», a cleanup's number, the «Уборки (N)»
option in «Какие пункты не принимаете?»; «Какие пункты принимаете?» has no such
option). A cleanup has no «Причина» dialog: the owner's words verbatim; none — «не
принята владельцем».

**Decided without you — as rows, not a dialog** (before the dialogs; does not fit
into 5 lines — into a file, the path into the chat): «Решено без вас (видно в игре):
П.N — <что видно>; …» — the `[видно]` rows of «Решено за вас» of the items being
accepted (with `кроме`/`только` — only those) and the product-visible «Решил сам»
rows of «Принято по умолчанию» (a variant choice — «П.4: выбран C — ближе к образцу
вечером, днём не выбеливает песок»; the global look's draw distance; the accepted
probe — the row about weak PCs in `AGENTS.md` → the minimum per measurement: «на
слабых — неизвестно»); in product words, without numbers or terms («П.4: контур
темнее модели»); a row without a tag — rewrite it the same way, do not say what the
owner sees — `[техника]`. `[техника]` and the order of work («сначала форма», «пункт
3 до выбора пункта 2») — one line into the report «технических решений за вас: N —
в `docs/BATCH.md`, их проверял проверяющий». Then the line «Не так — напишите,
например: «поменяй П.1, мерки»». Disputed in words (now or in a dialog note) — like
a disputed «Решено за вас» below; silence — not disputed. There is no «что не
нравится» dialog (`ASKING.md`, p. 3).

**Dialog 1** — «Партия из N пунктов: что принимаете?» — `Всё` / `Всё, кроме…` /
`Только…` / `Пройти по пунктам`. `Всё (Recommended)` if all items are `готов к
проверке`, the last full run is green, and there are no owner review notes during
the batch; otherwise without the marker. The owner himself named what he accepts
(`кроме …`, `только …`, «принимаю N» — in the argument or in words) — no dialog, and
no further dialogs about accepted items: only the unaccepted item's reason (not
named), the dependency, and closing the stage.

**Selecting items** (`Всё, кроме…`, `Только…`) — a `multiSelect` «Какие пункты не
принимаете?» or «Какие пункты принимаете?», up to 4 items per question, more —
across several questions; cleanups — above.

**«Причина»** — for every unaccepted item except a cleanup, if the owner has not
named it yet:
«Пункт N — <суть>: что не так?» — `Не похоже на задуманное` /
`Не видно или не там` / `Ломает другое` / `Не успел посмотреть` (description:
«откатится и вернётся в очередь как есть»). For `[вид]` and `[ощущение]` there is
no dialog — rejection in the owner's words; none — one line «Пункт N — что не так
против образца? Напишите словами». The note attached to the answer is the main
thing, record it verbatim; there is none (except `Не успел посмотреть`) — ask in
one line, in words, what exactly is wrong. The words go into the next round: for
`[вид]` about the technique or the form («свет облаков зависит от времени суток»,
«как устроены горы», «кубики») — «пересмотр приёма» (section 5), not of the
reference; «образец другой» — a reference revision; otherwise — «Не принят»: from
them `/studio/start` will make new variants and choose, ranking them above the
reference. A `[вид]` screenshot from the answer — into
`docs/refs/<topic>/owner-<дата>-<n>.<ext>` (where it lives —
`.opencode/agents/reference.md`, p. 1), the path — into the «Не принят» row or
«Журнал», into the documentary commit.

**«Пройти по пунктам»** — one item at a time: «Как увидеть» and the screenshots (a
path or a path to a file; for `[вид]` — its frames in the viewer), then the dialog
«Пункт N — <суть>: так и есть?» — `Да` / `Нет, вот что не так` / `Потом`. `Нет` —
the reason from the note verbatim (none — in words, as above); `Потом` — like
`Не успел посмотреть`.

**Dependency.** An accepted item leans on an unaccepted one — do not accept silently:
name the dependency and ask with a dialog (a cleanup the owner did not name is not
covered by the dialog: it is accepted with the batch). The row «Решил сам: пункт M —
до выбора пункта N» — M leans on N's base (section 3). An unaccepted item nothing
depends on is reverted alone.

After the answers — the line «Понял: принимаю …; не принимаю … (причины); оспорено
…». No second confirmation needed. «Что принимаете?» twice without an answer —
change nothing and stop.

**Disputed.** An item with a disputed decision is neither accepted nor reverted now:
it stays in the batch and after section 5 goes into a fix — section 6. The decision
of an unaccepted item is disputed — append to its reason.

## 3. Revert the unaccepted

`git revert --no-edit` of the unaccepted items' commits, from new to old. Skip the
pair "a commit — its `Revert "Пункт N: …"`" (a revert after the culprit search; the
pair — by `This reverts commit <хеш>` in the revert's body): it is already
cancelled. Do not revert the stand commit (`Пункт N: стенд вида` or
`стенд ощущения`, `Item N: Add the look stand` or `feel stand`) — the stand serves
the next items; the sheets and «Журнал» live in the `Партия:` commits and remain.
Do not revert the base commit either (`Пункт N: основа — …`, `Item N: Base — …`)
if the rejection reason is in taste (the chosen variant, a colour, the preset's
numbers) or there is none (`ждёт`, `не выполнен`): the owner did not reject the
form; the reason is in the base itself (form, mass, a defect, «Ломает другое») —
revert it too. A conflict only in `docs/BATCH.md` (batches before 0.4.0) — not a
dependency: `git checkout HEAD -- docs/BATCH.md`, `git revert --continue --no-edit`.
Any other conflict — `git revert --abort`, push nothing, and show which accepted
item leans on the unaccepted one. The revert touches only the batch's files;
uncommitted concept-chat `.md` in the same files — ask to finish them there first.

## 4. Final check

Per `docs/TESTING.md`, on what came out after the revert:

1. **Full and long** — if the batch header's «Последний полный прогон» is `не было`
   or red, or `git diff --name-only <its hash>..HEAD` contains non-`.md` files (a
   revert, a fix, anything that landed after the run). Otherwise do not run: name
   its numbers and hash in the report.
2. Quick — with the verdict as the table says.
3. «После правки ресурсов», if resources changed; the related screenshots. Do not
   run the «замеры» group: that is the end of `/studio/start`.

A red check — run it twice more (from the full one — by name), as in `/studio/check`.
Red all three times — **acceptance stopped**: do not edit the documents, push
nothing, show the exact failure. Red 1–2 of 3 — unstable: into the documents
(section 5) and as a separate line in the report. Do not weaken the check for a
green total.

## 5. Documents and push

**Stage.** `docs/ROADMAP.md` has «Этапы», the `идёт` stage's `[этап N]` item is
accepted, and no other `[этап N]` left in «Очереди» — before the dialog, the
stage's «Что увидит игрок» row, the dialog «Этап N — закрыт? (по «Закрыт, когда»:
…)» — `Да (Recommended)` / `Нет, ещё: …` (description — «чего не хватает — в
заметке») / `Ещё не проходил` (description — «спросит `/studio/roadmap следующий`»).
`Да` — the stage is `сделан <дата>`, its systems in «Покрытии» — `работает`; do not
rebuild the other stages. `Нет` — the note verbatim into `docs/BATCH.md`, «Найдено
по ходу»: «Этап N не закрыт (<дата>): «…»» (the concept chat will make a queue item
from it); no note — ask in words. `Ещё не проходил` — the stage stays `идёт`, in
the report — «пройдите «Что увидит игрок», потом в чате замысла
`/studio/roadmap следующий` спросит снова».

These documents must not carry uncommitted concept-chat changes; if they do — ask
to finish them there, do not mix. The source — the item rows in `docs/BATCH.md`:

- **`docs/ROADMAP.md`** — move the accepted out of the queue and «Дальше», one line
  into «Сделано» — in player words: what is now possible, visible, or audible (the
  «Сделано» row from «В документы при /studio/done»; for an `[этап N]` item — the
  tag at the end: `/studio/board` counts a stage's items by it; for `Уборка:` —
  «<что> — для игрока без изменений»); `/studio/release` writes the release notes
  from it. The unaccepted stays in the queue; to its details (for a bug — to the
  `docs/BUGS.md` entry: the executor and the reviewer read it) — the row `Не принят
  (<дата>): «<вариант> — <заметка владельца дословно>»` and the screenshot paths
  if the result is visible. An unexecuted `Уборка:` — to the details the row «Не
  выполнен (<дата>): <причина>» (on the second such row `/studio/start` stops
  taking it). An item `не выполнен: ждёт уборки <что>` — in the queue
  `[ждёт уборки]` (otherwise `/studio/start all` takes it again to the same
  finding); an `Уборка:` item accepted — the `[ждёт уборки]` items behind it on the
  same file — `[можно]`: the tag is removed by the cleanup's acceptance, not by
  its queuing. The testbed became `есть` — the `[ждёт проверок]` items —
  `[можно]`. **Light accepted** (the «свет и атмосфера» passport, the global look)
  — the `[ждёт света]` items → `[можно]`, if nothing else waits;
- **the `docs/refs/<тема>.md` passports** — the accepted `[вид]`: `Состояние:
  принят кадр <дата>` (and in `docs/refs/INDEX.md`'s «Темах»), into «Журнал» —
  `- <дата>: принят кадр accepted-<дата>.png`, to the «покажем оба …» row in
  «Противоречиях» whose choice is in «Журнале» — «решено <дата>: выбран <как
  образец | как в ваших словах>»; the unaccepted — into «Журнал» verbatim `- <дата>:
  не принят кадр — «слова владельца»»; the «Журнал» rows `/studio/start` left in
  `docs/BATCH.md` — there too. **Technique revision** — an `[вид]` `не выполнен:
  пересмотр приёма` and an unaccepted one with a note about the technique
  (section 2): do not touch the passport or the state («Журнал» — `- <дата>:
  пересмотр приёма — «<заметка>»`, if `/studio/start` did not write it), the item
  in the queue — `[ждёт приёма]`, into `BLOCKED.md`'s «Решения» — «Пересмотр приёма
  <тема>: «<заметка>» — `/studio/idea приём <тема>`»; likewise convert the
  `не выполнен: на пересмотр образца` and `[ждёт образца]` ones standing from past
  batches without the owner's words «образец другой» (a passport from `черновик` —
  to its former state per the «Журнал» row, and in «Темах»); light accepted after
  their sheet — to the item's details «Сначала: переснять отвергнутые варианты в
  принятом свете». «Образец другой» — the passport to `черновик` (and in «Темах»;
  the former state — as a row into «Журнал»), the item — `[ждёт образца]`, into
  «Решения» — «Образец <тема>: пересмотреть — `/studio/idea образец <тема>`».
  **Light accepted** — for the other topics' passports with `принят кадр` earlier:
  into «Журнал» `- <дата>: снято до света` (in «Темах» — to the state), no repeat
  sheet is started for them without the owner's words; into `docs/BATCH.md`'s
  «Найдено по ходу» — «эталоны вида и проверки тона — снято до света: обновить
  одним пунктом после приёмки света» (the item is queued by `/studio/idea` or
  `/studio/setup обновить`);
- **`docs/CONCEPT.md`** — only what is really accepted and working; the rows
  `CONCEPT, Где что: …` and `CONCEPT, Копии: …` — into a row of that «Архитектура»
  table (no table — create one), `CONCEPT, Службы: …` — into the «Службы
  (автозагрузки)» row;
- **`docs/BUGS.md`** — delete only the accepted, fixed bugs;
- **`docs/BLOCKED.md`** — remove the debts closed by acceptance; into «Решения» —
  the `ждёт` items' questions and the unanswered from «Вопросы владельцу», if they
  are not there and there is no answer in `docs/DECISIONS.md`; such an item in
  `ROADMAP.md`'s «Очереди» — `[ждёт ответа: …]`; an answer already exists — into
  the report «пункт N можно брать»;
- **`docs/DECISIONS.md`** — the essential from the accepted items' «Решено за вас»
  and «Решил сам» (a choice that will later pull a redo): what was chosen — what
  was rejected — why, with the date;
- **`docs/TESTING.md`** — per its sections' headers: new checks, the testbed's
  state; the row `TESTING: Стенд, <часть> …` (and for the unaccepted one: the stand
  was not reverted) — that «Стенд» part is `есть` and the command into the table;
  the accepted frame — the regression reference, if the project can compare
  screenshots with a tolerance; `Ловушка:` → «Ловушки стека»; `Ограничение:` and
  the accepted items' «вид не проверен» → «Принято без полной проверки» (except the
  light mode covered by a green full run); the batch header «Замеры: отложены …»,
  «не состоялись», or «проверка сломана» → there too «замеры партии <дата> не
  сняты — <причина>», and «Замеры: N/M на <хеш>» removes such records by
  referencing this run; unstable ones → «Нестабильные проверки»; a registry or
  runner cleanup accepted — in «Правилах каркаса» remove the «цель; пока …»
  caveat from the «раннер находит проверки сам» row; «Общие узлы» — per the row
  `TESTING, Общие узлы: …`;
- **`docs/DESIGN.md`** — the accepted items' `DESIGN:` rows that the owner did not
  dispute; new components; the "like this / not like this" pairs from look fixes;
- **`docs/orders/<kind>.md`** — only when the order rules change;
- **`docs/BATCH.md`** — replace the header and the table with the row «Пусто.»,
  except items in a fix and `ждёт выбора`: their rows and the header remain,
  «Последний полный прогон» — per section 4. Keep the reference in the comment and
  the section headers; from «Вопросы владельцу» remove what was moved to BLOCKED,
  from «Принято по умолчанию» — the rows of the items that did not stay in the
  batch; «Общий пробел», «Пришло», and «Найдено по ходу» — keep the unclosed and
  what the concept chat did not move; there were reverts — of the `уборка:` rows
  ending in «— этот diff» (the batch's findings), keep only those whose file and
  kind (size, repetition, type, closed, a call by name…) is still named by
  `code_check.py --changed <capture hash> --only` — the line numbers and the
  numbers differ after the revert: the reverted item's findings are ghosts,
  `/studio/idea` would have queued a cleanup on them without a finding;
- **`README.md` and `README.ru.md`** — the `features`, `status`, and `shots`
  blocks per the "README" section of `COMMITS.md`: only between the markers, both
  files together; no markers — do not touch; the report line — per the "README"
  section of `COMMITS.md` (after the owner's rejection — do not write).

Delete the accepted items' screenshots in `../<project folder>.wt/shots/`, keep
the unaccepted ones: the «Не принят» rows point to them; delete the `done/`
folder. The parked work of an item that went back to the queue (`отложено:
.wt/parked/p<N> на <хеш>`), — rename to `parked/<дата партии>-p<N>`, to the item's
details in `docs/ROADMAP.md` — «Начато (<дата>): <путь>, на <хеш>»: the next
batch's executor will take it.

**The code health baseline** — `python -X utf8 tools/code_check.py --tighten`:
lowers the numbers where things got better (no script or code 2 — skip; the batch
still has items in a fix or `ждёт выбора` — too: their commits can still be
reverted, and the baseline cannot be raised later — the next `/studio/done` would
lower it). All edits — one documentary commit `Приёмка:` (the first line — what
the player can do now; in the body — the kept and the reverted items, the final
check's numbers), files by name, with the changed `tools/code_baseline.json`;
push (`git push`) if `AGENTS.md` says commits are pushed.

## 6. Disputed — into a fix

How it should be — from the dialog's note; none — ask in words. The fix — by the
`/studio/start` cycle "Fixes after the owner's check": a new `executor-code` with
the owner's words verbatim (as rounds 2–3: do not call prep and finish again),
`reviewer`, the commit `Пункт N: поправка — …`, the mark in `docs/BATCH.md`. The
next `/studio/done` accepts it once the owner has looked.

## 7. Report

In product words: the accepted items and their hashes; the unaccepted — the reason,
the revert's hash, where in the queue now; for `[вид]` — the accepted frame and the
passport's state; what went into a fix and what to look at after it; what was
recorded in «Ловушки стека», «Принято без полной проверки», `DECISIONS.md`; the
final check — run now or the batch's run taken (the numbers, the hash), the
unstable ones; the documentary commit's hash, the updated README blocks, and the
push fact; the user data copy from `docs/BATCH.md`, if one was made, — it can be
deleted; one concrete next queue item, without an automatic start, and a stage
closed — instead of it the line «Следующий шаг — в чате замысла:
`/studio/roadmap следующий`».

Then — the batch retro per `.opencode/commands/studio/retro.md`, sections 1–4,
without dialogs (the lessons are entered automatically; into the report — up to 5
lines «Записал уроки: …» and «Не так — напишите»); the owner does not need to call
`/studio/retro`.
