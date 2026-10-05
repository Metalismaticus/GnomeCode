---
description: Прогнать проверки проекта по docs/TESTING.md — все или одну по имени — и разобрать провалы, отличая сломанный продукт от сломанной и нестабильной проверки. Команда чата разработки.
agent: studio
---

What we are testing: **$ARGUMENTS**

(If the line above is empty or was left unsubstituted — take it from the
owner's message.) Empty — run the full run. A name — only that test or its
group. Read the commands and the exact test list from `docs/TESTING.md` and
from the test suite itself: do not trust a count from memory. Questions — via
the `question` dialog per `.opencode/studio/reference/ASKING.md`.

The testbed state in `docs/TESTING.md` — «нет»: do what the section «Что
проверяется уже сейчас» names, and say plainly what this does **not** test. If
the item on building tests stands in the queue — name its place.

## 1. Run

The command — from the table in `docs/TESTING.md`; read the verdict the way
the column «Как читать вердикт» says, and per the «Правила каркаса»
(«Полигон»): empty output, engine not found, a hang (exit code 124), a test
without assertions — red, not "nothing fell over". Trust the exit code only
where it is declared honest.

Parse and load errors of the tests themselves — handle **before** failures:
a broken test is not a product failure, and a missing test means the result
is not green.

**Red — repeat.** A quick run failed — run it twice more; in a full run or a
group — the tests that turned red, by name, twice more. Red all three times
— a failure, analyze further. Red 1–2 of 3 — **flaky**: do not fix the
product blind on its account; enter the line «<проверка> — <дата>, красная K
из 3, <первая ошибка>» into `docs/TESTING.md`, «Нестабильные проверки», as a
documentation commit, the file by name, the note `Process:` / `Процесс:` per
`.opencode/studio/reference/COMMITS.md` («Process: Mark the save test as
flaky» / «Процесс: проверка сохранения — нестабильная»). A batch is running
(`docs/BATCH.md` is not «Пусто.») — instead, into `docs/BATCH.md`,
«Найдено по ходу»: the other documents are edited by `/studio/done`.

**The «замеры» group** (`/studio/check замеры`: the owner named it himself —
that is his "yes" to the game dialog) — in the main folder, one; do not
repeat it three times: repetition and verdict — per «Регрессии» of the
«Бюджет производительности» of `docs/TESTING.md`; exit code 3 — «замер не
состоялся: <причина>», not red. `/studio/check замеры пересъём` — retake the
baseline at the same fingerprint (if it changed — the run retakes it
itself). A successful run clears the records «замеры … не сняты» in
«Принято без полной проверки» — a `Процесс:` commit together with the new
baselines; a batch is running — the line «Замеры: …» into the header of
`docs/BATCH.md`, commit `Партия: замеры`, the records are cleared by
`/studio/done`.

## 2. Analyze failures

Per failure: what was expected and what was received. Before fixing the
code, answer: **did the product break, or did the test break?**

The sign of a broken test: the number looks round and extreme — zero, empty,
everything at once. The sign of a broken product: the number is plausible,
but wrong.

## 3. What to do with findings

- **Product broke, cause clear** — describe the fix in product words and ask
  via the `question` dialog: починить / записать через `/studio/fault` /
  оставить. Do not fix silently: the failure may be intentional (see below).
- **Product broke, cause unclear** — offer to open an entry via
  `/studio/fault` in the concept chat.
- **Test broke** — fix the test at once; it is tooling, not the product.
- **Flaky** — do not fix the product on its account. The cause of the
  flakiness is visible — fix the test as broken; not visible — a line into
  `docs/BATCH.md`, «Найдено по ходу»: the concept chat places it in the
  queue.

## 4. Red can be correct

A test is also written for an open bug — then it is red on purpose and guards
the fix. Before "fixing the red", check against `docs/BUGS.md`.

Such a test must not be removed or weakened to get a green result. If the
failure gets in the way, it is spoken about out loud, not silenced.

## 5. What tests do not see

Read the section of the same name in `docs/TESTING.md`. Usually it is the
look: if the change touched the interface, graphics, or the world, a green
run says nothing about it — a screenshot of the place the owner looks at is
needed.
