---
description: Один экран состояния проекта — сначала что ждёт владельца (проверка, ответы, пришедшее, образцы), потом текущая партия, этап и покрытие замысла, начало очереди, открытые баги, состояние проверок, здоровье кода и что неладно, в том числе ассеты с некоммерческими правами. Только чтение; годится для любого чата.
agent: studio
---

The command is **read-only**: edit nothing, commit nothing, do not run the
product or the tests — only `git`, the hooks' self-test, the reference checks
`tools/refs_check.py`, the map check `tools/roadmap_check.py`, and code
health `tools/code_check.py --summary`. Read sections by their headings, not
whole documents. The whole screen — **no more than 12 lines**, in product
words, without retelling details.

1. **Ждёт вас** — the first block, one line per thing present:
   - ready for review — items `готов к проверке` in `docs/BATCH.md` →
     `/studio/done`;
   - items `ждёт выбора` in `docs/BATCH.md` (batches before 0.10.5) →
     `/studio/start` in the dev chat: it will pick the variant and embed it
     itself;
   - questions — the section «Вопросы владельцу» of `docs/BATCH.md` and items
     `ждёт: …` without a «Партия …» line in «Решения» of `docs/BLOCKED.md` →
     `/studio/start` in the dev chat (it will ask via the `question` dialog);
     with the line — among the decisions below → `/studio/need`;
   - arrived — files in the destination folders from `docs/orders/*.md` and
     along the debt paths of `docs/BLOCKED.md` (target frame
     `docs/refs/<тема>/target-*`) that are not in git → `/studio/add` in the
     dev chat;
   - decisions from `docs/BLOCKED.md` that queue or batch items (lines
     «Партия …») stand behind, by name → `/studio/need`;
   - references — `python -X utf8 tools/refs_check.py`, into context only
     the list: missing files — images, sounds (how many, which themes) and
     unconfirmed references, with items `[вид]` or `[ощущение]` behind them →
     `/studio/need образцы`.

   Nothing present — «Ждёт вас: ничего».
2. **Партия** — one line: how many items in each state (none — «Партии
   нет»); how many lines wait in «Пришло» and «Найдено по ходу» (the concept
   chat carries them over via `/studio/idea`). **Токены** — from
   `../<папка проекта>.wt/usage/studio-usage.jsonl` since the «Снята …» of
   the header (no batch — since the last «Снята …» in the history of
   `docs/BATCH.md`): «токены: <вход>/<выход> (кэш-чит N) · ~$X — по ролям
   одной строкой: executor-code A %, finish B %, координатор C %» (agents
   with zero — do not name); no file or lines — «токены: не записаны».
3. **Очередь** — if `docs/ROADMAP.md` has «Этапы» — first the line «Этап N: X
   из Y пунктов · покрытие A/B» (N — the stage `идёт`; if none, the last
   `сделан`; X — lines of «Сделано» with `[этап N]`, Y — X plus items of
   «Очереди» with `[этап N]`; coverage — from the summary of
   `python -X utf8 tools/roadmap_check.py`, into context — only the summary
   and the first finding). Then the first three items of «Очереди» with
   markers; how many in total `[можно]` and `[ждёт …]` (of them
   `[ждёт образца]`, if present; `[ждёт проверок]`, `[ждёт уборки]`,
   `[ждёт света]` and `[ждёт приёма]` — not the owner's debt, do not call
   them into `/studio/need`: light is accepted by `/studio/done`,
   acceptance is given by `/studio/idea приём <тема>`).
4. **Баги** — how many entries in `docs/BUGS.md` and up to three titles.
5. **Проверки** — the state of the testbed and of «Стенда» (parts «вид» and
   «ощущение»; in old projects — the section «Стенд вида») from
   `docs/TESTING.md`; «Последний полный прогон» from the header of
   `docs/BATCH.md`; how many entries in «Принято без полной проверки» and
   «Нестабильные проверки», if not zero; «замеры не сняты с <дата>» — the
   batch header «Замеры: отложены» or such a record in «Принято без полной
   проверки». As a separate line «Код: » and the line of
   `python -X utf8 tools/code_check.py --summary` — «в порядке» | «N
   мест разрослись или повторяются, строк сверх нормы X (при записи базы Y)
   — M уборок в очереди, игра от них не меняется» («места» — findings, old
   files and functions above the norm; lines above the norm are brought
   down by cleanups, and by splitting across files too; no parentheses
   until the number changes), without file names; lines `уборка:` in
   «Найдено по ходу» of `docs/BATCH.md` whose file has no `Уборка:` in
   «Очереди» yet — after «в очереди» append «, ещё K ждут /studio/idea»; no
   script — «Код: мерить нечем → `/studio/setup обновить`» (the script
   writes the same if the baseline is missing or corrupt).
6. **Неладно** — the block only on a finding, one line per finding:
   - worktree copies `../<папка>.wt/…` outside the current wave
     (`git worktree list`);
   - an item `в работе` with uncommitted files — if the dev chat is not
     working right now, this is a tail left after a break; `/studio/start`
     decides what to do with it;
   - an item `готов к проверке` without an item commit after the batch-take
     hash (`git log <хеш из «Снята … на <хеш>»>..HEAD -E --grep
     "^(Пункт|Item) N:"` — both notes:
     `.opencode/studio/reference/COMMITS.md`);
   - unpushed commits, if in `AGENTS.md` commits are pushed;
   - `docs/refs/` exists but `tools/refs_check.py` does not — «образцы
     проверить нечем → `/studio/setup обновить`»; likewise with «Этапы»
     without `tools/roadmap_check.py` — «карту проверить нечем»;
   - `roadmap_check.py` with exit code 1 — «карта: N находок, первая: <…> →
     `/studio/roadmap пересмотр` (чат замысла)»;
   - `code_check.py --summary` with exit code 1 (above the baseline) and no
     batch — «код вырос сверх нормы — уборка через /studio/idea» (the
     «Код:» line does not repeat this);
   - an item `[ждёт уборки]` with no `Уборка:` for its file before it in
     «Очереди» — «пункт N ждёт уборки, которой нет в очереди →
     /studio/idea (чат замысла)»; there is one, but it has two
     «Пересмотрен» and «Не выполнен» again — «пункт N ждёт уборки, которая
     не выходит → /studio/idea»;
   - «ассеты с некоммерческими правами: N» — files in git whose latest
     `принят …` line of the ledger `docs/orders/ledger.md` has
     «Лицензией» `некоммерческая` (lines `заменён`, `удалён` and the like
     do not count): `/studio/release` will not release them → replace via
     `/studio/order`;
   - self-test not green: `python -X utf8 ".opencode/studio/hooks/selftest.py"
     --quick` (without the trial repository `code_check` — seconds), into
     context — only the line «Итог:»; in it «хуки НЕ работают» — «страж
     коммитов молчит: <что неверно>», «проверка карты НЕ работает» —
     «проверка карты сломана: <что неверно>», «проверка кода НЕ работает» —
     «проверка кода сломана: <что неверно>».

As the last line — one next step: `/studio/done`, if something is ready for
review; an answer to batch questions or `ждёт выбора` — `/studio/start`;
`/studio/start`, if the queue is not empty; `/studio/need`, if everything
available stands behind the owner; queue empty — if «Найдено по ходу» of
`docs/BATCH.md` has «Этап N не закрыт» — `/studio/idea`, else if a stage is
`идёт` or `следом` — «`/studio/roadmap следующий` (чат замысла)», else
`/studio/idea`.
