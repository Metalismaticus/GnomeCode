---
name: studio — measurements
description: Protocol of performance measurements at the end of a /studio/start run (the «замеры» group, a busy computer, the BATCH header, the measurements commit, and probe frame pairs. Load when finishing a run whose «замеры» line is not «нет», or for an item with «Готово, когда» — a probe frame pair.
---

“Section N” references mean the `/studio/start` protocol; «Бюджет
производительности» and «Как мерить» — the project's `docs/TESTING.md`.

**Measurements** — the «замеры» line of the «Команды проверки» in
`docs/TESTING.md` (no line — «нет»), in both cases the last one: if it is
not «нет» and the batch changed more than only `docs/`, `tests/`, `tools/`,
or measurements wait from last time («Замеры: отложены» in the header,
“замеры … не сняты” in «Принято без полной проверки» of `docs/TESTING.md`);
otherwise the line “замеры не нужны”. Do not wait for the owner and do not
ask — no dialog, measurements always run:

1. **Is the computer busy?** — the pre-check “«Как мерить — группа
   „замеры“»” («Бюджет производительности» of `docs/TESTING.md`): the CPU,
   the GPU, another engine process; if busy — with what (for the GPU — the
   process by `pid_<N>`). This is a note, not a stop.
2. **The run** — the group in the main folder, once (busy — with `--занят`),
   the result lines into the context. Code 3 (the pre-check failed) —
   “замер не состоялся: <причина>”, not red, do not open a dialog. A script
   error, empty output, another code — “замеры: проверка сломана — <первая
   ошибка>”, into «Найдено по ходу», not “хуже базы”. Red (the retry
   already done per the «Регрессии» of «Бюджет производительности») — do
   not fix the product blind and do not revert items: a fresh `reviewer`,
   from the result, names which batch item could have shifted the frame
   time (CPU or GPU, preset); the line “замер <имя>, <пресет>: хуже базы
   на X% — вероятно пункт N” — into «Найдено по ходу» and the report.
3. **Busy** — into the report “замеры сняты на занятом компьютере (<чем>) —
   числа могут быть хуже настоящих”; do not take and do not change the
   baseline; “хуже базы” — not red and not a culprit hunt: “замер <имя>,
   <пресет>: хуже базы на X% на занятом — перепроверить при следующем
   замере” into «Найдено по ходу».
4. The batch stopped — «Замеры: отложены <дата> — партия остановлена».


After the measurement — the header line «Замеры: <зелёных>/<красных> на
<хеш> [· на занятом: <чем>] | отложены … | не состоялись: <причина> |
проверка сломана | не нужны» with its own commit `Партия: замеры` together
with the baselines `tests/perf/baselines/…` that the run took or retook.

**The probe frame pair** — a `[код]` item with «Готово, когда: пара
кадров» (a renderer change, an expensive capability; after accepted light,
section 3b step 1): the light passport's same frames on the current and
the new one — «было / стало», one hour, without measurements, the paths —
in «Как увидеть»; the measurement — like «Замеры», on an exported build
after shader warm-up; to the item — “на вашем ПК тянет / не тянет (по
замеру); на слабых — неизвестно”, `DECISIONS:` — in «В документы при
`/studio/done`», the numbers table — into the report. No dialog:
`/studio/done` shows the pair full screen; accepted — the new one stays
(the line about weak PCs in `AGENTS.md` → the minimum per measurement —
with a «Решил сам» line, do not ask about hardware), rejected — revert to
the current one. Into the report — broken shaders, particles, the first
seconds after loading. The probe blocks nothing: `[вид]` items do not
reference it.
