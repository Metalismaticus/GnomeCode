---
description: Зафиксировать баг — спросить, как часто повторяется и где его видно, записать в docs/BUGS.md, найти причину по коду с честной пометкой уверенности, поставить ссылку в очередь; не чинить. Жалобу «выглядит, ощущается или звучит не так» — в паспорт образца и пункт [вид] или [ощущение]. Команда чата замысла.
agent: studio
---

Bug: **$ARGUMENTS**

(If the line above is empty or was left unsubstituted — take it from the
owner's message.)

Fixing without a separate word from the owner is forbidden. The `/studio/fault`
call itself already permits recording and saving the defect in the documents,
but writing no code. This is a concept-chat command: it changes only `.md`
and images in `docs/refs/`. Never run the product to reproduce — search for
the cause in the code; leave any run to the dev chat. Record no facts that are
not in the code, `git log`, or the documents. Questions — via the `question`
dialog per `.opencode/studio/reference/ASKING.md`.

## 1. Read, do not recall

Read `docs/BUGS.md` in full: it may already be recorded, and then the entry
must be amended, not a second one started.

Check `docs/ROADMAP.md` too, the section «Написано, но не подключено». Half
of what looks like a bug is in fact an unfinished feature, and its place is
there.

The symptom concerns what an item of the current batch (`docs/BATCH.md`) made,
not yet accepted by `/studio/done`, — this is not a new BUGS entry but a line
attached to the item in `docs/ROADMAP.md` (for an item with `[баг]` — to its
entry in `docs/BUGS.md`): `Замечание владельца во время партии (<дата>): «…»`;
the place and screenshot path from section 2 — after the quote. `/studio/done`
will show it. Then sections 3–5 are not needed, except the commit at the end.

**«Выглядит не так» while nothing is broken** (water, vegetation, light, sky,
fog, materials, effects, character looks; «не похоже», «не то») — not a bug:
continue per section 3 "Reference" of `.opencode/commands/studio/idea.md`.
The theme has no passport or it is `черновик` — analysis by the `reference`
agent; confirmed or `принят кадр` — a `question` dialog «что не так» over the
components, the answer goes into the passport's «Журнал»; an item `[вид]` into
the queue. Sections 2–5 are then not needed, except the commit. A defect of
the look (holes, flicker, seams, wrong scale) — a bug, continue as usual.
**«Ощущается или звучит не так»** (controls, camera, sound, feedback:
«прыжок деревянный», «шаги звучат пусто») — same way, an item `[ощущение]`;
a defect (sound cut off, action stuck) — a bug.

## 2. Ask how often and where

What is missing from the owner's words — ask. Dialog: «<суть бага>: как часто
повторяется?» — `Всегда` / `Иногда` / `Один раз` / `Не знаю`. After the dialog
— a one-line request for a screenshot and the place: screen, world seed,
coordinates (a line from the game's F3, if it can), what was done before. Do
not wait for the answer: record now; append the place and the screenshot to
the bug entry when they arrive — the reviewer takes the screenshot exactly
there. A screenshot of the look in the world, pasted into the chat, — copy it
to `docs/refs/<тема>/owner-<дата>-<n>.<ext>` (where it lies and is larger than
2560 px — `.opencode/agents/reference.md`, steps 1–2).

## 3. Separate the bug from the rest

Into `BUGS.md` goes **only what is broken for the user**:

| Symptom | Where it goes |
|---|---|
| the user does something and gets the wrong thing | **BUGS** |
| the user does something and gets nothing | **BUGS** |
| defect of the look: holes, flicker, seams, wrong scale, an object vanished | **BUGS** |
| «выглядит не так», nothing broken | passport of the reference, item `[вид]` (section 1) |
| feels or sounds wrong (controls, camera, sound), nothing broken | passport of the reference, item `[ощущение]` (section 1) |
| written but not wired up | ROADMAP |
| dead code, unused keys | delete, do not document |
| waits for an order or a decision | BLOCKED |

If it is unclear where to put it — say so out loud, do not guess.

## 4. Find the cause in the code and honestly mark the confidence

**A conclusion from the code is not yet a test.** The entry always states what
confirms the cause: «по коду, без замера», «по формуле», «замером» (if the dev
chat has already made the measurement).

Name what the dev chat will need for verification, per `docs/TESTING.md`: a
quick run, a measurement with numbers, or a screenshot at the named place. If
the cause is not visible without a measurement — the queue item starts with
the measurement.

Cause not found — record exactly that: «не найдено, нужно от владельца: …»
and what exactly — steps, a screenshot, a data file.

## 5. Record

A new entry in `docs/BUGS.md` following the sample from the file header:
**Симптом** — in the owner's words verbatim; **Где** — the place (screen, seed,
coordinates), the frequency from the dialog, the screenshot path; **Причина**
with the confidence mark; **Нельзя ломать** (mandatory: which neighboring
features rest on the same code and which tests guard them; here also «почему
сделано так», if the current behavior was a deliberate choice); **Готово,
когда**. A defect of the look in a theme with a passport — into «Нельзя
ломать» also `docs/refs/<тема>.md`: verifiable claims and the accepted frame.

Into «Очередь» of `docs/ROADMAP.md` — one short link to the entry with the
`[баг]` and state markers, straight into place by the priority from
`AGENTS.md`; do not copy the full description. Not reproduced and does not get
in the way — `баг-кандидат` or `ждёт`, not above confirmed work. Cause not
found and no place — `[ждёт снимка]`.

A fix method is **not required**. It may be written only when it follows
directly from the found cause and stays within one place; as the last line,
signed «мой вариант починки, не обязателен». A method touching neighboring
systems — do not write: the executor with the run will see the consequences;
the concept chat will not. In doubt — no line. The item is judged by «Готово,
когда», not by whether the executor took the proposed path. The owner's
decision is written as a separate line and is mandatory. **Apply no code.**

List in words what was recorded where; diff — only on request. Make a separate
documentation commit (files by name, images and analysis sheets in
`docs/refs/` — except those under `.gitignore`) with the note `Bug:` / `Баг:`
per `.opencode/studio/reference/COMMITS.md` (first line — the symptom in the
player's words: «Bug: Log the white box where the waterfall meets the cliff» /
«Баг: водопад у обрыва — белая коробка») and push, if in `AGENTS.md` commits
are pushed. The touched documents already changed by unknown work — stop and
name the conflict, do not mix.
