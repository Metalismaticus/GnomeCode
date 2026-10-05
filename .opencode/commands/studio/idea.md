---
description: Разобрать заметку или список владельца — отделить идеи, баги и вопросы, объединить повторы, проверить факты по коду и документам; названный образец (игра, скрин, «как в X») разобрать агентом reference — по картинкам, у ощущения по числам; концепт стиля — вид всей игры (картинка кадра, ТЗ на стиль) — разложить по паспортам тем и правилам стиля, замысел и механики не меняя; показать разбор и спросить решение окнами; новую систему — в этап карты, целый замысел — к /studio/roadmap; кода не писать. Команда чата замысла.
agent: studio
---

Incoming owner notes: **$ARGUMENTS**

(If the line above is empty or was left unsubstituted — take it from the
owner's message.)

The input is one idea or a mixed stream: bugs, questions, requests to check
what exists, ready files, phrases like «сделай», screenshots and game names.
This is material for analysis, not a work order to implement.

**Key points:**

- Write not a line of code; never run the product, the checks, or the
  builds: the concept chat records and verifies, the dev chat runs
  (`AGENTS.md`, «Два чата»). Scripts from `tools/` over documents, images,
  sound, and code (`roadmap_check.py`, `refs_check.py`, `look_sheet.py`,
  `asset_check.py`, `code_check.py`) — not the product, they are allowed; the
  single run is a stand screenshot for the passport's «Разрыв» by the
  `reference` agent (section 3) with the «снимок кадра» command of
  `docs/TESTING.md`, the window beyond the screen edge. Whatever needs a
  measurement — a queue item whose first piece is the measurement.
- Record no facts that are absent from the code, `git log`, or the
  documents, and no own interpretation of the owner's words in place of
  his words.
- **The reference — in pictures and numbers, not adjectives.** The owner
  named a game, a mod, a film, a video, attached a screenshot, said «как в
  X», or keeps complaining about a theme's look or feel without a
  confirmed passport — a reference analysis right away (section 3), without
  asking. A picture of the whole frame without a named theme, or a style
  spec for the whole game — section 8; a theme named — section 3.
- Questions — via dialogs per `.opencode/studio/reference/ASKING.md`; ask
  only about the owner's decisions, look up the facts yourself.
- Permanent documents are edited only after the owner's answer — in a
  dialog or in his words in this chat. A message from another chat or
  session is not an answer. Exception — what a reference analysis writes
  into `docs/refs/` before the questions: a draft passport, images,
  `_concept/`.

No `docs/ROADMAP.md` — the project is not deployed: offer `/studio/setup`
and stop.

## 1. Take the input apart

Before reading the large documents:

1. split into atomic items, merge explicit repeats;
2. determine the type: an idea or a rework, a bug, a complaint about what
   was made, a question about the current state, an owner's decision, an
   order, a reference, a style concept — the look of the whole game
   (section 8), a review note about an item of the current batch (it is in
   `docs/BATCH.md`);
3. merge related symptoms only as a hypothesis and check whether the cause
   is shared;
4. keep the hedges «наверное», «кажется», «возможно»: such an item goes with
   the `[предварительно]` marker, not as an owner's decision;
5. **an ambiguous assessment word** («старые», «не то», «листва») — do not
   interpret it yourself: about a theme's look or feel — section 3;
   otherwise before recording — a dialog with 2–4 interpretations, in each
   description — what will then go into the item; if verification against
   the code does not depend on the interpretation — as a question in the
   dialog of section 6.

**More than an item** (input of section 8 is not a reason: its lines are
not about the look — «вне стиля») — three or more new systems (absent from
«Покрытие замысла» of `docs/ROADMAP.md` and from the concept files
`docs/*CONCEPT*.md`), the words «концепт» (of the concept, not of style),
«план», «этапы», «дорожная карта», or an idea against «Одной строкой» or
«Чего не делаем» of the main concept («Чего не делаем» of the second
concept is not a reason: it is about its stage): not a scatter of items,
but the dialog «<суть>: разложить замысел на этапы через
`/studio/roadmap`?» — `Да (Recommended)` / `Нет, по пунктам`. «Да» — call
`/studio/roadmap` (with «Этапы» present — `/studio/roadmap пересмотр`),
the owner's note as the argument after the mode, do not run the analysis;
«Нет» — a row in «Как ведётся работа» of `DECISIONS.md` «<дата>:
<причина окна> — по пунктам, без `/studio/roadmap`» (for the same reason
the dialog is not opened again), then sections 2–7 (the following dialogs
follow from the answer).

## 2. Read what is needed, not everything in a row

Do not rely on memory, but do not load every document either: look for
sections by headings and keywords.

- An idea or a rework — «Одной строкой», «Ядро», «Чего не делаем», and the
  relevant section of `docs/CONCEPT.md` (all of it — only if the idea
  changes the core or several systems); «Этапы» and «Покрытие замысла» of
  `docs/ROADMAP.md`, if present (which stage `идёт`, whether the system
  exists); decisions on the theme in `docs/DECISIONS.md`; about the look or
  feel — the theme's passport in `docs/refs/` and `docs/refs/INDEX.md`.
- A possible bug — `docs/BUGS.md` and «Написано, но не подключено» in
  `docs/ROADMAP.md`; look for the cause in the code, reproduction belongs
  to the dev chat.
- **A complaint about what was made** («стало хуже», «опять не то») — first
  check against `git log`, `docs/BATCH.md`, `docs/BUGS.md`: what was done,
  when, accepted or not, reverted or not. Record only what was found — not
  a revert that never happened. About the look or feel — section 3.
  Otherwise, if it is unclear what is wrong — ask for a screenshot and the
  place (screen, seed, coordinates — a line via F3 from the game, if it
  can); the item `[ждёт снимка]`.
- «Это уже работает?» — check against the code; no answer without a run —
  say so and queue a measurement, not a new task.
- Told that an order is ready — find the file in the destination folder of
  `docs/orders/<kind>.md`, check whether it is wired up; do not ask for
  the path before searching.
- Every time — «Пришло» and «Найдено по ходу» of `docs/BATCH.md` (for a
  style concept — only the summary row «в заметках разработки N строк —
  `/studio/idea`»): the rows not yet in `ROADMAP.md` and `BLOCKED.md`
  (check by file path or gist), move there by priority — this is part of
  the analysis. **Do not ask the owner about them**: technical findings
  (checks, bugs, measurements, code cleanup, broken tooling) the chat
  queues itself and names in a row of «Принято по умолчанию» («из заметок
  разработки в очередь: 4 пункта — …»); into a dialog — only a finding that
  changes what the player sees or does, the stage's composition, money, or
  the irreversible. The row «карта: …» (written by `/studio/retro`) — not a
  queue item: offer `/studio/roadmap пересмотр`. `BATCH.md` is not edited —
  the dev chat cleans it. **The row `уборка: …`** — an item `Уборка: …`
  following the sample of the template
  `.opencode/studio/templates/docs/ROADMAP.md`, but first a check:
  `python -X utf8 tools/code_check.py --only <файл>` — an item only if the
  row is there as a finding (code 1) or it is a breakage risk the script
  does not measure (dead code only tests call; a worktree copy already
  diverged or produced a bug; bypassing a public interface); otherwise —
  it stays a note, without an item. There is no dialog about cleanups:
  what to queue is decided by the chat, in «Принято по умолчанию» —
  «уборки: поставлено N, остались заметками M». Open `Уборка:` rows in
  «Очереди» — no more than 5: beyond that a row waits for a place in
  «Найдено по ходу» (in «Принято по умолчанию» — «уборок ждут места: N»).
  Past the limit — only an item's «не удалось», a cleanup before an item
  `[ждёт уборки]`, and a finding past the baseline (code 1, not a note)
  about a file a «Очередь» item edits: it has no headroom; notes (a big
  file, a hot one, a long function, dead code, number sets) — within the
  limit, even when their file is being edited. One goal; rows about one
  file — one item, the goal — the first in the order of «Раздутого кода»
  (`.opencode/studio/setup-steps/update.md`): registry and runner before
  size; a repeat — the same goal, not the same file; the file's other
  goals (types with a runner, size with dead code) do not count as
  carried over — they become their own item when the file's first cleanup
  is accepted. The repeat «— из базы, задет переносом» — not a cleanup:
  after `/studio/done` no run names it, no red and no green. «Готово,
  когда» — by the sample: for a finding past the baseline — `code_check`
  does not name it; for a size note — the piece's goal and the number
  below the former one (the piece — the part the first «Очередь» item on
  that file edits: per «Где что» and its «Куски»); for the registry and
  the runner — the new one without a row in it; for a second copy in
  another language — its part removed (checks — onto the main one,
  comparison — onto hashes, the copy deleted); a hot note does not serve
  as a number («задело пунктов» the cleanup does not lower) — the goal by
  file or function size. The row `уборка: пересмотреть «Готово, когда» —
  <пункт>` (written by `/studio/start`: the cleanup was not done twice) —
  narrow the goal to one function or file (the part the `[ждёт уборки]`
  item edits) and rewrite the criterion against the current
  `code_check.py --only <файл>`; remove the «Не выполнен» rows, into the
  details — «Пересмотрен (<дата>)». `уборка: тип записи <сущность> — нужно
  поле …` (written by `/studio/start`) — the item «Уборка: тип записи
  <сущность>: <массивы или ключи> → поля одного типа», behavior and
  hashes unchanged: it is a cleanup of one entity, not a «rewrite the
  system»; the source row — into «Слова владельца». Any other row ending
  in «— не удалось пункта M» (written by `/studio/start`) — in the note's
  form with the current number from `code_check.py --only <файл>` (the
  finding was in the reverted diff): «<место> N → меньше, часть, которую
  правит пункт M, — своей функцией или файлом». The place — before the
  first «Очередь» item that edits that file (per «Где что» of
  `docs/CONCEPT.md`; it unblocks — p. 3 of the priority), none — after the
  items of the `идёт` stage, without `[этап N]`; the testbed of
  `docs/TESTING.md` not `есть` — `[ждёт проверок]` (without a run
  «поведение прежнее» cannot be proven; became `есть` — `[можно]`). An item
  `[ждёт уборки]` with no `Уборка:` before it on its file — at every
  analysis put one there (standing behind — move it before the item; none
  anywhere — in the note's form from `code_check.py --only <файл>`);
  `[можно]` will be returned to it by `/studio/done`, accepting the
  cleanup. Dead code that is an unwired feature, not the leftover of a
  replacement — not a cleanup: a row in «Написано, но не подключено» of
  `ROADMAP.md`, then as a finding for the player.
- Every analysis — also `python -X utf8 tools/refs_check.py` (read-only):
  the row «Паспорт вида неполон» at a confirmed passport (missing «Главное
  впечатление», «Разрыв», «У нас: приём:», «Чем делаем», or «Образец для
  листа» — a whole concept frame), whose theme after the analysis stands
  as an item `[вид]` `[можно]` in «Очереди» (the first night — light only;
  `[ждёт света]` — until `/studio/done` removes the marker), — a fresh
  `reference` «концепт: приём» (section 3, «Пересмотр приёма» — the same
  input without a note: the theme, the spec rows, the
  `_concept/target-<тема>-N` cutout, the engine, the library paths),
  without a dialog, one theme at a time (one stand screenshot): it fills
  in «Разрыв», «Главное впечатление», «У нас: приём:», «Чем делаем»; for
  the light theme — «Образец для листа» as a whole frame
  `target-<тема>-1.png`; in «Принято по умолчанию» — «паспорт <тема>
  дописан по v16: <что>». After it `refs_check.py` again: red («Разрыв: не
  снято») — the item `[ждёт образца: <строка>]`, a row in «Решения» of
  `BLOCKED.md`. Without this `/studio/start` will not take the item, and
  the executor at a whole concept frame will set «ждёт образца».
- Before writing into `ROADMAP.md` and `BLOCKED.md`, check `git log` since
  the last reading: the dev chat may have changed them.

## 3. Reference: analyze before questions

The section is the `studio-obrazec` skill (the skill tool): the owner named
a game, sent a screenshot, or said «как в X» — load it and run the
reference analysis by it (the `reference` agent, in parallel). A concept
without references does not need it.

## 4. Check against what is recorded and the code

Three questions, each — with a fact from the code or a document, not
reasoning:

- **New or already there?** By searching the code and «Покрытие замысла»
  (the system is there — the idea lands in its stage). Written but not
  wired up — a finishing touch.
- **What does it contradict?** By name, with paths and line numbers: the
  CONCEPT section, a DECISIONS decision, a working function, the passport
  and the main reference in `docs/refs/INDEX.md`.
- **What will have to be redone?** Files and systems; what a measurement
  fixed — say the measurement will have to be repeated.

For a bug, instead of the price — reproduction, the found or assumed
cause, and what is missing for a confident conclusion. Do not fix.

## 5. Name the price

Write **what** is needed and **what it is judged by**, not **how**: the
pieces — parts of the task («such-and-such measurement», «the check goes
red without a fix»), the method — to the executor. A look, feel, or
mechanics reference — section 3; a named technique — find how it is done
and record the links at the item. Your own variant — as the «не
обязателен» row.

The first piece of a large feature — an end-to-end visible slice: the
owner sees something in the product at once. An item with more than three
pieces or ~10 files — cut into several queue items.

Separately and briefly: what it will demand of the owner (an order, a
decision); what becomes impossible; whether there is a cheaper way with
the same feel. A good idea — say so: the task is not to talk him out of
it.

## 6. Show the analysis and ask

The analysis — as text, items numbered: **type → how understood → what was
checked → what is proposed**, merged repeats and each one's place in the
queue by the priority from `AGENTS.md`. Under it — «Принято по умолчанию —
поправьте, если не так»: what was decided without a question (merges,
place in the queue, markers), one row each. Longer than five lines — into
a file outside the project, into the chat — the path and the gist in 3–5
lines.

**What the owner said is already a decision — do not re-ask it.** An item
the owner named himself (ordered, showed with a picture, wrote «хочу»,
«должна», «все разные»), is recorded without a dialog: after the analysis —
«Записал: …» row by row and «Не так — напишите, например: «убери пункт
2»». What is visible in his picture (berries on a bush) or follows by
default (bush growth — by the reference and the genre) — as a «Решено за
вас [видно]» / «[допущение]» row, not a question. A dialog — only about
what the analysis **added on its own**:

- `multiSelect` «Какие пункты принимаете?» — only the derived items the
  owner did not name (a merge that changed the gist; a system his words
  imply; a finding that changes the product; technical ones — into
  «Принято по умолчанию», without a dialog); a variant per item, the
  description — where it lands, last — `Ничего из этого`; more than
  three — across several questions of 2–3 items; one item — «Пункт 1,
  <суть>: записать так?»; none — no dialog;
- per question for each disputed item — only where the answer noticeably
  changes the gist or the price and there is no answer either in the
  words or in the picture: the recommended variant first, in the
  description — what changes at that answer; no more than two dialogs in
  a row, counting the reference dialog. A control or a player action
  without a number in the owner's words («прыжок выше») — a question with
  2–3 numbers from the current value in the code: «на 30% выше — до 2,6 м
  (Recommended)» / «вдвое» / …; not reducible to one number («деревянное»,
  «как в X») — the item `[ощущение]`;
- with «Этапы» present and the item a new system (absent from «Покрытие»)
  — «Пункт K, <система>: куда?» — `Этап N` (the `идёт` stage; absent —
  `следом`) / `Этап M` / `Потом` / `Не делаем`; first and with
  `(Recommended)` — `Этап N`, if the system is needed by its «Что увидит
  игрок», otherwise the fitting one; the description — what goes into the
  stage.

After the answer — «Понял: …». What is not marked with an item is not
recorded; «пока не знаю» — into «Решения» of `BLOCKED.md`, the item `[ждёт
…]`. **Before the answer, do not edit permanent documents.**

## 7. After the answer

The owner's answer permits changing and saving **only documents** and
`docs/refs/`, without a second confirmation for the commit.

Distribute, without copying the debt into two lists:

1. a bug — in detail into `docs/BUGS.md` following the sample of its
   header (the place — into «Где»), into «Очередь» of `docs/ROADMAP.md` —
   a short link;
2. a feature or a rework — into «Задумано, но не сделано» of
   `docs/CONCEPT.md`, as a short item into «Очередь» with state and route
   markers and with the details in «Дальше» of `docs/ROADMAP.md`:

   ```
   #### <Название> [метка состояния] [метка маршрута]
   Слова владельца: «<дословная цитата из заметки>»
   Образец: docs/refs/<тема>.md (только [вид] и [ощущение]; паспорт не подтверждён — пункт [ждёт образца])
   Куски: 1) … 2) …
   Готово, когда: … (управление и действия игрока — шагами игрока с числом: это текст сценария)
   Как увидеть: <где в продукте и что должно быть видно> (если результат видно)
   Не входит: …
   Крайние случаи: … (только для крупных [код]/[баг], не больше 5)
   Необратимо: <что> (только если меняет формат сохранения, удаляет содержимое, ломает выпущенное; пункт стоит [ждёт «да»])
   ```

   Route: judged by the eye in the world (light and sky, water, vegetation,
   terrain, buildings, characters, effects, animation) — `[вид]`; by play
   or by ear (controls, camera, pace and timing in the hands, sound,
   feedback) — `[ощущение]`; interface screens — `[ui]`; content files
   only — `[данные]`; otherwise `[код]`. The `[вид]` pieces — light, fog,
   and color grading → silhouette and mass → material or shader and
   motion; the variant axes in the pieces — «различаются приёмами: <имя> /
   <имя>» from the passport's «Как сделано у образца» (not «радиусом»,
   «тоном», «цветом солнца»; for the global look the first axis — the
   technique of distance and tone). **Light — first:** any theme's
   `[вид]`, except the global look (the «свет и атмосфера» passport — the
   word «свет» in the title), at its passport not `принят кадр` — `[ждёт
   света]` (a project without a light theme — without the marker); it
   does not wait for a render probe, shadows, or other `[код]`. For the
   global look's item the first piece — translate the look etalons and the
   tone and edge checks (the etalon file from «Правила проекта», the
   `*tone*` checks, edge fog up to the world's edge) into relative claims
   of the light passport with the «снято до света» mark: that is its
   criterion, not a separate `[код]` (the `/studio/setup обновить`
   «эталоны» finding — here, not an item); the stand findings the first
   `[вид]` needs (the frame's hour as an argument and the `time` field,
   the scale-marker switch, the theme's frames in the stand) — into the
   queue before it as a separate `[код]` or as the first piece of its
   «основа», otherwise the sheet will be shot with scale markers and at a
   foreign hour. A `[код]` that needs accepted light (the stand's
   `concept` preset from the light passport's «Составляющие», the probe
   over a pair of frames, the reshooting of rejected variants) — `[ждёт
   света]` too: the marker occurs not only on `[вид]`, `/studio/done`
   removes it by accepting the light. A render probe or an expensive
   feature — `[код]` with «Готово, когда: пара кадров — те же кадры
   паспорта света было / стало в одном свете, судит владелец в
   `/studio/done`», after the accepted light (`[ждёт света]`), `[вид]`
   does not reference it. «Чем делаем: файл» in the passport — the base:
   wiring the model in code (instances, placement), the variants — 2–4
   files on the stand (`-Model <путь>`), the sheet and the choice the
   same. The «вид» part of `docs/TESTING.md`'s «Стенд» missing (not
   `есть`) and no «Стенд вида» item in the queue — put it before that as
   a separate `[код]` item (the «ощущение» part builds the first step of
   the `[ощущение]` itself). Sound that needs new files for variants —
   first `/studio/order sfx` with 2–3 variants, the item `[ждёт файла]`.
   The «Готово, когда» of `[вид]` and `[ощущение]` — a frame (the variant
   and its numbers), accepted by the owner in `/studio/done`, not «похоже
   на образец»; for `[вид]` the first — a positive look row from the
   passport's «Главного впечатления» («вода перекатывается через край
   одной мягкой шапкой, граней не видно»), not only «чего быть не
   должно»; the numbers — support, not acceptance; with the passport's
   «покажем оба» axis, the pieces and «Готово, когда» — the goals of both
   sides («как образец: …; как в словах: …») or «после выбора — по
   выбранному».

   **«Этапы» present.** A queue item and details — only for the `идёт`
   stage; an idea for the `следом` stage, `потом`, or «Потом» — only into
   «Задумано», as an entry with `[этап M]` or `[Потом]` at the start (the
   pieces will be written out by `/studio/roadmap следующий`). A new
   system — also a «Покрытие» row (`С-<next number>`, the concept
   section, «Слова владельца» verbatim, «Требует», the stage per the
   answer, `впереди`) and its number in the stage's «Системы»; «Не делаем»
   — instead of «Задумано» a row in the main concept's «Чего не делаем»
   (`CONCEPT.md` or the one named in `DECISIONS.md` «главный замысел —
   …»), the reason — in `DECISIONS.md` (p. 4).

   An item from «Пришло» or «Найдено по ходу» — `Слова владельца: нет —
   <откуда>`;
3. a review note about an item of the current batch — not a new item, but
   a row attached to it in `docs/ROADMAP.md` (for an item with `[баг]` —
   to the entry in `docs/BUGS.md`): `Замечание владельца во время партии
   (<дата>): «…»` — `/studio/done` will read it;
4. a choice between variants — into `docs/DECISIONS.md`: what was chosen,
   what was rejected, why; the rejected with a reason worth remembering —
   too;
5. an order or the owner's answer — into `docs/BLOCKED.md`; an order — via
   `/studio/order`;
6. an answered question about the current state is written nowhere, unless
   it found a bug or a shortfall.

A new item goes in by the priority from `AGENTS.md`, not at the end; with
«Этапы» — with the `[этап N]` marker of the `идёт` stage (a bug too); no
`идёт` stage (closed, and `/studio/roadmap следующий` not yet called) — do
not put a dev item into the queue, offer `/studio/roadmap следующий`
instead, a bug — with the `[этап N]` of the `следом` stage. **`[можно]` —
only an item on which nothing is open with the owner:** `/studio/start
all` takes only those and goes without the owner (`ASKING.md`, p. 12). An
open question «что делать» (including one that did not fit into the
dialogs, «пока не знаю» and the `[предварительно]` hedge — as the row
«<пункт>: «<оговорка>» — делать так?») — `[ждёт ответа: …]` and a row in
«Решения» of `BLOCKED.md`; a file needed — `[ждёт …]`; with «Необратимо» —
`[ждёт «да»]` and the row «Пункт X необратим: <что>. Делать?»
(`/studio/need` will ask, the answer — `[можно]`). The choice of a variant
(`[вид]`, `[ощущение]`, the «покажем оба» axis) — not an open question:
`/studio/start` makes it itself, the owner judges in `/studio/done`;
`[ждёт света]` — not the owner's debt, `/studio/done` removes it by
accepting the light. The queue's order — without a dialog: «Решил сам:
<пункт> первым — <почему>; отменить — словами» in «Принято по
умолчанию».

List in words what was recorded where (a document — a row); diff — only
on request. One documentation commit — its own `.md`, images, and
analysis sheets (`sheet-*.png`, `.json`) of `docs/refs/` by name (those
caught by `.gitignore` are not added: in a public repository another's
frames are not committed), the note `Queue:` / `Очередь:`, references
only — `Reference:` / `Образец:` per
`.opencode/studio/reference/COMMITS.md` («Queue: Add night raids to Stage
2» / «Очередь: ночные набеги — в Этап 2»); push, if in `AGENTS.md`
commits are pushed. A document already carries changes of unknown origin
— stop and name the conflict, do not mix.

## 8. Style concept (the look of the whole game)

The section is the `studio-concept` skill (the skill tool): a style concept
was brought — a picture of the whole frame or a style spec — load it and
work by it. None — not needed.
