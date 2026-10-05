---
description: Показать или изменить, сколько работы чат разработки ведёт одновременно — две настройки в docs/TESTING.md, «пишут» (сколько пунктов партии пишется разом; 0 или 1 — всё по одному) и «тяжёлых проверок» (сколько полных прогонов идёт разом, обычно 1). По желанию владельца проверяет их пробным прогоном. Звать по команде /studio/parallel.
agent: studio
---

What the owner is asking for: **$ARGUMENTS**

(If the line above is empty or was left unsubstituted — take it from the
owner's message.)

Questions to the owner — via the `question` dialog per
`.opencode/studio/reference/ASKING.md`.

The settings live in the first line of the section «Параллельная работа» of
`docs/TESTING.md`:

```
**Состояние: проверено · пишут: 3 · тяжёлых проверок: 1**
```

- **пишут** — how many batch items are written at once, each in its own
  worktree copy; while they run, only short tests: the item's, a group, the
  quick run.
- **тяжёлых проверок** — how many full and long runs go at once. Usually 1:
  in `/studio/start all` the full run goes alone, at the end of the batch.

These are **ceilings**, not a plan: how many items actually go together is
decided by the `scout` agent per batch; no independent ones — everything one
at a time at any `пишут`. The old line `предел: N` is read as `пишут: N ·
тяжёлых проверок: 1`; on first recording replace it with the new one.

## Without an argument — show

One short answer: the status, `пишут`, `тяжёлых проверок`, by what and when
they were verified (the line «Готово, когда … замер»), the number of CPU
cores, and how long the quick and full runs take per the table in
`docs/TESTING.md`. Change nothing.

## `N` — how many `пишут`

- **0 or 1** — everything one at a time. Leave the status untouched:
  worktree-copy preparation remains verified.
- **2 or more** with «проверено» — record. Above what the trial run measured
  — say in one line that this many have not been measured on this machine,
  and offer `/studio/parallel проверить`. Do not refuse: the owner decides.
- **2 or more** with «не проверено» — record and say it will not work until
  a worktree copy is verified: this is part of the queue item «Построить
  проверки» or `/studio/parallel проверить`.
- **«невозможно»** — do not record without revisiting the cause given in the
  section; name it.

## `проверки M` — how many heavy runs

The same rules as for `N`, but about simultaneous full and long runs. 1 is
the safe value; more than 1 makes sense only if the machine can carry several
full runs without false failures.

Neither `пишут` nor `тяжёлых проверок` may be set above the number of CPU
cores without an answer in the dialog («Оставить <ядер> (Recommended)» /
«Всё равно поставить»): the tests will start interfering with each other, and
false failures will eat the gain.

## `проверить` — trial run

Only in the dev chat and outside a batch (`docs/BATCH.md` — «Пусто.»). It
takes long: say roughly how long, and ask via the dialog «Запустить пробный
прогон параллельной работы?» («Запустить (Recommended)» / «Не сейчас»).

0. Find tests in the testbed with a frame or time threshold (search the test
   code: `fps`, `frame`, `msec`, `usec`, `ms <`, `Time.`/`Stopwatch` near an
   assertion) — if they are not in the group «замеры», record them in «Нельзя
   одновременно» and in «Найдено по ходу»: «вынести в группу „замеры“»; do
   not run them in the trial.
1. Create worktree copies of the suite — as many as `пишут`:
   `git worktree add -b trial/s<K> "../<папка проекта>.wt/slot<K>" main`;
   prepare each per the section «Подготовка копии».
2. **Пишут:** the quick run and one group — in all copies at once (background
   commands). **Тяжёлые:** the full run — simultaneously in as many copies as
   `тяжёлых проверок` (at 1 — not needed). Into context — only the final
   lines and the time.
3. Compare with a single run of the same in the main folder (did not pass —
   lower the number by 1 and repeat):
   - the results match — no false failures;
   - each copy's data landed separately, the main folder untouched;
   - the time of one run grew no more than twofold.
4. Remove the copies and branches: `git worktree remove`,
   `git branch -d trial/s<K>`.
5. Record «проверено» and the highest `пишут` and `тяжёлых проверок` at which
   everything is right; the date and the measurement numbers — into «Готово,
   когда». What turned red only in a simultaneous run — into «Нельзя
   одновременно».

## Save

A change to the section of `docs/TESTING.md` — a separate documentation
commit, the file by name, the note `Process:` / `Процесс:` per
`.opencode/studio/reference/COMMITS.md` («Process: Build two tasks in
parallel» / «Процесс: две задачи параллельно»); push, if in `AGENTS.md`
commits are pushed. A batch is running — the new numbers take effect from the
next `/studio/start`: the waves of the current batch are already taken.
