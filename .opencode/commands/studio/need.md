---
description: Показать все долги владельца из docs/BLOCKED.md — заказы с готовыми к копированию промтами, недостающие картинки образцов, сначала то, что уже пришло; решения и неподтверждённые образцы задать окнами и ответ сразу записать в docs/DECISIONS.md или паспорт образца. Команда чата замысла.
agent: studio
---

What is needed from the owner: **$ARGUMENTS**

(If the line above is empty or left without substitution — take it from the
owner's message.) Empty — show everything. An order kind given (`art`,
`music`, …), `решения` or `образцы` (missing images and unconfirmed
references) — only that.

Orders and what has arrived — **show only**: send nothing, edit nothing.
`/studio/need` records only the owner's answers to decisions and references
(section 4): that is an `.md` edit, concept chat work. Questions — via dialogs
per `.opencode/studio/reference/ASKING.md`.

## 1. Read, not recall

`docs/BLOCKED.md` — the source; everything else — details on top of it. One
section requested — read it and the common header, without loading the rest.
References — `python -X utf8 tools/refs_check.py` (read-only): exit code 0 —
everything in place, 1 — a list of missing files (images, sounds) and
`черновик` passports, behind which items `[вид]` or `[ощущение]` stand. No
script, but `docs/refs/` exists — «образцы проверить нечем» and offer
`/studio/setup обновить`.

## 2. Check whether it has arrived already

Cross-check the expected files from BLOCKED against what actually lies in
the destination folders. A file has appeared — **say so first thing**, on a
separate line: «пришло: `<путь>`», and what it needs to start working:
usually `/studio/add` in the dev chat. Not doing it — offer it.

Show what has arrived above debts: a debt already closed yet still being
asked about — the worst thing this command can do.

No image the passport refers to — the owner's debt: «положите `<файл>` в
`docs/refs/<тема>/` (перетащите в папку) или назовите, где он лежит». A game
frame `ref-…` — the URL from the passport is there too: it can be downloaded
anew by reference analysis (`/studio/idea образец <тема>`). No sheet
`sheet-…` or accepted frame `accepted-…` — not the owner's debt: one line
«пропали снимки чата разработки: …».

## 3. Orders: output them ready

For every unclosed order find its item by file name in
`docs/prompts/<вид>-*.md`, without reading whole batches, and **assemble the
prompt whole**: replace the stub `[+ постоянная часть: <подвид>]` with the
text from `docs/orders/<вид>.md`. Copying must be possible in one motion,
from one block.

Per order: the line «что, куда и кто исполнитель», under it a block with the
full prompt, under it — the references to attach. Order — as in BLOCKED. The
file's last line in `docs/orders/ledger.md` — `перезаказать: <почему>`: to
the end of the prompt — a line against that defect: «шахматка» or «фон не
вырезан» — «настоящий прозрачный фон: PNG с альфа-каналом, без нарисованной
клетки» (or «сплошной фон #FF00FF», if the passport cuts the background by
color); «упёрся в край» — «объект целиком, поля не меньше 10% со всех
сторон»; otherwise — in the defect's words. Orders with executor `api` in
state `не отправлен` mark: «можно отправить командой `/studio/order`». State
`черновик — оформить /studio/order` (a concept draft from `/studio/idea`) —
do not output the prompt: offer `/studio/order <вид>` with a line.

Before output walk the kind's «Проверка перед отправкой». A kind without a
prompt (sounds from libraries) — as a list: file, what it is, character,
duration, where to put it. **Кадр-цель** (`art`, executor `вручную`;
assembled by `/studio/start` after the base or by `/studio/order art кадр-цель`)
— one prompt for the owner's ChatGPT: the prompt block from
`docs/prompts/art-NN.md` and under it two images by paths — first our stand
screenshot (without marks), second the theme's reference — with the line
«приложите обе, ответ сохраните как `docs/refs/<тема>/target-<n>.png`»; no
more than two attempts per theme, do not output a third — the line «без
кадра-цели: образец — вырезка концепта».

No order for a debt in any `docs/prompts/` file — say so and offer to
assemble it with `/studio/order`.

## 4. Decisions and references: ask via dialogs

Every decision from «Решения» of `BLOCKED.md` — a dialog question:
self-contained (what is being decided and what depends on the answer), 2–4
options, the recommended one first; for a number — 2–3 reasonable numbers. A
line «Концепт (стиля) <дата>…» and a batch line ending with `— /studio/idea
…` — not a dialog: offer the command from its end with a line (`/studio/idea
концепт`, `/studio/order`) — it will unpack the answer. First — the lines
«Партия <дата>, пункт N …» (they are written by `/studio/start all`: an
item of the running batch awaits an answer), then those because of which
queue items stand. No more than 4 questions in a dialog and two dialogs; the
rest — as a text list, until the next `/studio/need`. A fact has appeared
that changes the question — say so before the dialog.

**Образец** — a line «Образец <тема>: …» in «Решения» or a `черновик`
passport from `refs_check.py`: first the passport's «Слова владельца» — the
components named in them — `Важно владельцу: да — слова <дата>` without a
dialog (`/studio/idea`, section 3); the words do not say what matters to the
owner — before the dialog the passport's path and its images (a path or a
path to a file), the question «Что вам нравится в <образец>?» —
`multiSelect`, options — components in the kind's words (label — a
component, description — as with the reference), more than four — split
evenly across two questions; not about variants and the stand. No passport,
no game, no screen — not a dialog, but a one-line request: a game, a screen
or a video, `/studio/idea` will take it apart. The theme has an open line
«Концепт (стиля) <дата>, <тема>: …» — do not confirm the passport, offer
`/studio/idea концепт` with a line.

**Кадр-цель has arrived** (`docs/refs/<тема>/target-<n>.png` accepted by
`/studio/add`, the passport's «Журнал» has no answer about it) — once per
frame, before the dialog the paths of the кадр-цель and our screenshot (or a
path to a file): «Кадр-цель <тема>: это место должно выглядеть так?» — `Да` /
`Нет: …` / `Без кадра-цели` (`ASKING.md`, p. 13). `Да` — the frame's
«Образец для листа» and the passport's «Образцов» line: `target-<n>.png`,
«направление по свету, палитре, материалу и настроению, не по геометрии»;
`Нет: …` — the note verbatim into «Журнал», a second order of the same theme
with it (`/studio/order art кадр-цель`), after the second «Нет» — as `Без
кадра-цели`; `Без кадра-цели` — «Образец для листа» — a crop of the theme
from the concept (`target-<тема>-N.png`), the debt removed. The answer —
into «Журнал» with a date.

The answer:

1. «Понял: …» with a line;
2. a decision — **verbatim** into `docs/DECISIONS.md` (date, what was chosen
   and why, if the owner said); a reference — into the passport, as in
   `/studio/idea`, section 3 «Ответ» (`.opencode/commands/studio/idea.md`):
   `Важно владельцу`, «Слова владельца», «Журнал», state
   `подтверждён владельцем <дата>` and into `INDEX.md`;
3. remove the line from «Решения» of `docs/BLOCKED.md`; a queue item that
   stood `[ждёт …]` (`[ждёт образца]`) only because of that — `[можно]`; the
   answer changes the composition or order of «Этапы» of `docs/ROADMAP.md`
   (such decisions are left to `/studio/roadmap`) — do not rebuild the map
   here, offer `/studio/roadmap пересмотр` with a line at the end; the line
   «<пункт>: «<оговорка>» — делать так?» — the answer `Да` removes
   `[предварительно]` (and `[ждёт ответа …]`): the item `[можно]`;
   `По-другому` — rewrite the item with the owner's words verbatim,
   `[можно]`; `Не делать` — the item out of the queue; an answer to the line
   «Партия <дата>, пункт N …» — into `DECISIONS.md` with the same
   annotation, do not touch `docs/BATCH.md`: an item of the running batch
   will be continued by `/studio/start` in the dev chat, one gone to the
   queue — `[можно]`, as above (with a line at the end);
4. «пока не знаю» or an empty answer twice — the line stays in `BLOCKED.md`,
   the passport — `черновик`.

Before editing check `git status` of these files: changes of unknown origin
— stop and name the conflict. All answers — one documentation commit, files
explicitly, the annotation `Queue:` / `Очередь:` (references only —
`Reference:` / `Образец:`) per `.opencode/studio/reference/COMMITS.md`:
«Queue: Unblock the map screen — paper map chosen» / «Очередь: экран карты
— выбрана бумажная карта»; push if in `AGENTS.md` commits are pushed.

## 5. At the end — the count

One line: how many orders of each kind, how many decisions, references and
missing images are awaited. And which of these blocks work right now, and
which can be carried whenever: the owner must see the difference between
«без этого стоим» and «без этого просто некрасиво». Items `[ждёт света]`
and `[ждёт приёма]` — not the owner's debt: the line «ждут принятого света:
N; ждут приёма (`/studio/idea приём <тема>`): M».
