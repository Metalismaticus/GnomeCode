---
description: Разбор партии после /studio/done — что пошло не так (откаты и их причины, три круга без одобрения, поправки и оспоренные решения, пункты «ждёт»), какое правило из этого следует; уроки проекта в DECISIONS и DESIGN, уроки процесса — в предложения правок плагина, без окон (сам в конце /studio/done); после закрытого этапа — строка темпа в «Прогноз». Команда чата разработки.
agent: studio
---

What gets reviewed: **$ARGUMENTS**

The retro is built from traces in git and the documents, not from chat memory: by the time of
`/studio/retro` the batch's details have already left the context. No dialogs: lessons are technique
and process, entered by the model itself (`.opencode/studio/reference/ASKING.md`, p. 2). `/studio/done`
runs this retro itself at the end — the owner does not need to call `/studio/retro`; a manual call
is for reviewing several batches.

## 1. Gather facts

For the last accepted batch (from the hash in its `«Снята … на <хеш>»` line — in the
history of `docs/BATCH.md` — to the closing documentary commit of `/studio/done`):

- item commits — `git log <хеш снятия>..<хеш приёмки> -E --grep
  "^(Пункт|Item) [0-9]+:" --format="%h %s"` (the acceptance hash — the earliest
  `-E --grep "^(Приёмка|Accept):"` after the take), reverts — `-E --grep
  "^Revert .(Пункт|Item)"` in the same range (annotations —
  `.opencode/studio/reference/COMMITS.md`): how many commits each item has,
  reworks («поправка — …» / «Rework — …») and reverts;
- the history of `docs/BATCH.md` (`git log -p -- docs/BATCH.md`): the states
  `не выполнен`, `ждёт`, rounds, the reviewer's review notes, the lines «Ограничение»,
  «Решено за вас», «Ловушка», «Общий пробел», «Найдено по ходу»;
- the history of `docs/ROADMAP.md` and `docs/BUGS.md` for the batch: the lines
  `Не принят (…)` and `Замечание владельца во время партии` — verbatim;
- what `/studio/done` sent for rework (the disputed «Решено за вас») and added to
  «Нестабильные проверки»;
- `/studio/done` closed a stage (in «Этапы» of `docs/ROADMAP.md` it became
  `сделан <дата>`) — its size and its batches: the «Снята …» takes in the history of
  `docs/BATCH.md` with `[этап N]` items in the table; `python -X utf8
  tools/roadmap_check.py` — the result and the findings;
- `python -X utf8 tools/code_check.py` — the result and the first findings (no
  script — skip); by the item commits (`--name-only`) — the files that three or more
  items of the batch edited.
- **Batch tokens** — `../<project folder>.wt/usage/studio-usage.jsonl`
  (written by the plugin: a line per model response — agent, model,
  input/output, cache, cost): the lines since the `«Снята … на <хеш>»` moment in the
  header of `docs/BATCH.md` — a summary by role: `агент → модель → вход/выход (из них
  кэш-чит) → $`, next to it the rounds before approval per item — from the states of
  `docs/BATCH.md`; into the facts — as is, into process lessons — if a role's spend is
  above expected or cache reads are suspiciously low. No file or no lines for the
  batch — the fact «токены: не записаны»; frequent breaks — a process lesson.

**Rejection frequency by causes** — how many non-accepted items per each `/studio/done`
verdict: «Не похоже на задуманное», «Не видно или не там», «Ломает другое»,
«Не успел посмотреть», the owner's own text; with item numbers; for `[вид]` and
`[ощущение]` — the rejection components (groups) from «Не принят» and «Журнал» of
`docs/refs/<topic>.md` for the batch. When several batches are reviewed — per each,
so it is visible whether a cause grows or goes away.

## 2. Find what repeats

One case is just a case. A lesson is what happened twice or cost dearly:

| Trace | What it says |
|---|---|
| «Не похоже на задуманное» | the owner's word was interpreted by the chat instead of asked; the criterion is about code, not about what the user sees |
| «Не видно или не там» | «Как увидеть» and screenshots — not where the owner looks |
| «Ломает другое» | «Нельзя ломать» is incomplete or no check guards the adjacent behavior |
| «Не успел посмотреть» | the batch is larger than the owner has time to review |
| a `[вид]` rejection on the same component twice | it is missing in «Проверяемые утверждения» of the passport or in the frames of the stand |
| an `[ощущение]` rejection on the same group twice | it is missing in «Проверяемые утверждения» of the passport or in the actions of «Кадры» (what to try) |
| approved on the first round, but the owner did not accept | the reviewer judged not what the owner sees: the criterion or the screenshot's place |
| the owner's rework on look | `docs/DESIGN.md` lacks a rule or the `designer` did not see the real data |
| a disputed «Решено за вас» | this choice must be asked before the work |
| three rounds without approval | the item is too large or the criterion cannot be checked |
| a revert because of a dependency | the batch took two items about the same files |
| a `ждёт` with a question whose answer was in the documents | the document is hard to find or outdated |
| «Общий пробел» | a shared base is missing — a queue item before the similar ones |
| red on an untouched check, unstable | the check is fragile — it is a queue item |
| a file in the commits of three or more items of the batch (except cleanups), and it grew during the batch and is already «большой» per `code_check` (beyond the size note) or has a finding beyond the baseline; a registry or a runner with a list — also without the size (a root from «Архитектура» and a common include edited by design — no) | an overloaded file or registry — cleanup |
| `[правило кода]` twice | the boundary — into «Архитектура» of `docs/CONCEPT.md` (in «Слои» — instead of `??`) or into «Правила проекта» |
| `не удалось: код` (`не выполнен: ждёт уборки`) | the cleanup was late — put it earlier |

## 3. Route the lessons to their destinations

- **Project lesson** — a rule about this product or stack. A draft line for
  `docs/DECISIONS.md`, the section «Уроки партий», or for `docs/DESIGN.md`, or for
  «Правила проекта» in `AGENTS.md`.
- **Process lesson** — fits any project: a plugin command did not ask something,
  did not check something, allowed too much. A draft for
  `docs/PLUGIN-FEEDBACK.md`: which command or agent, what happened, what text
  change is proposed. The owner carries this file over to the plugin repository;
  do not edit the plugin itself from here.

## 4. Show and accept

**A stage was closed** — a pace line without a dialog (it is a measurement, not a
lesson) in `docs/DECISIONS.md`, the section «Прогноз» (missing — create it): `- <дата>:
Этап N «<имя>», размер <малый | средний | большой> — K партий (<дата первой> —
<дата закрытия>)`; `/studio/roadmap прогноз` computes the pace from it. The findings
of `roadmap_check.py` — into the report and into `docs/BATCH.md`, «Найдено по ходу»:
`«карта: <находка>»` — the concept chat will fix them (`/studio/roadmap пересмотр`).

The batch went clean — say exactly that in one line, invent nothing, open no dialogs.

Otherwise the facts as one table, the rejection frequency and the lessons — no more
than five, each with a destination and a ready wording — write them to a temporary
file outside the project. **No dialog:** the owner does not analyze what went wrong —
what they see, they write down immediately (owner's words: «я не могу
анализировать, что было не так, если вижу что-то — я сразу прямо пишу»). Lessons
are entered without asking — this is technique and process (`ASKING.md`, p. 2); a
lesson that changes the product, the composition of a stage, or the concept — do not
enter it, but as a line in «Решения» of `BLOCKED.md` for `/studio/need`. Into the
chat — no more than 5 lines: «Записал уроки: <суть — адрес>, …», the
rejection-frequency line, the path to the retro file, and «Не так — напишите,
например: «убери урок про стенд»».

The lessons and the pace line — one documentary commit, the files by name, the
annotation `Process:` / `Процесс:` per `.opencode/studio/reference/COMMITS.md`
(«Process: Record lessons from the batch» / «Процесс: уроки партии»). Queue items
from the lessons (a fragile check, splitting a large item) — do not add them
yourself, but record them in `docs/BATCH.md`, «Найдено по ходу»: the queue is run by
the concept chat. Cleanups are technique, not lessons for a dialog
(`ASKING.md`, p. 2): immediately as `уборка: <файл> — <что> — <как исправить>` lines
into the same place, with a `Процесс:` commit (even when there are no lessons).
