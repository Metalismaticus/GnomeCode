---
description: Разложить весь замысел на этапы от «что увидит игрок» — список всех систем замысла вместе с неявными, не больше двух окон вопросов о первой версии, этапы вертикальными срезами, покрытие и зависимости проверяет tools/roadmap_check.py; план — на «Принять», кусками расписан только ближний этап. «следующий» — начать этап «следом», «пересмотр» — после смены замысла или по заметке владельца, «прогноз» — по темпу закрытых этапов. Звать по /studio/roadmap и словам «распиши дорожную карту», «разложи игру на этапы», «составь план игры», «что дальше после очереди». Команда чата замысла.
agent: studio
---

What we do with the map: **$ARGUMENTS**

(Empty or left unsubstituted — from the owner's message. The first word is
the mode: `следующий`, `пересмотр`, `прогноз` — the sections below; without
it — assembly. The rest of the text (or the note passed from `/studio/idea`)
is the **owner's note**: it is concept material too, its systems go into the
step 2 list with «Слова владельца» verbatim. `docs/refs/` (references, the
brief, and the style concept's spec, «Правила стиля») — neither concept nor
note: no systems, «Одной строкой», or «Слова владельца» from there. «Этапы»
already exists — the assembly proceeds as `пересмотр`: the numbers, names,
and dates of `сделан` stages are not changed, new stages — only after the
last `сделан`.)

**Key points:**

- A concept chat: write no code, run neither the product nor the checks;
  reading the code is allowed — that is how you learn what already
  `работает`. `tools/roadmap_check.py` — not the product. Called in the dev
  chat (where `/studio/start` was called) — send one line to the concept
  chat and stop.
- The word for the owner is **stage**. A stage — from «what becomes true
  for the player», a vertical slice, not a layer of code; no sprints, no
  roles, no risk matrices.
- **Every concept system — in exactly one place:** a stage, «Потом», or «Не
  делаем», the implicit ones too (combat → death and respawn); «Требует»
  does not point to a later stage.
- **Questions — via dialogs** per `.opencode/studio/reference/ASKING.md`
  and only those whose answer changes the first version's composition or
  the order of stages: no more than two question dialogs of ≤ 4 each plus
  the «Принять» dialog (a contradiction in the core, or choosing the main
  of two concepts — one more). Technique — as a «Решено за вас» row, except
  what is fixed in `DECISIONS.md`; the rest — `[допущение]`.
- **No days or dates in the map**, except `сделан <дата>`: a stage's size —
  `малый` / `средний` / `большой`; days — only `прогноз`, on request.
- In pieces («Подробности», «Очередь») only the `идёт` stage is written
  out.
- Before «Принять» no permanent documents are edited: the plan — in
  `docs/ROADMAP-PLAN.md` (do not commit; one left over from the last time —
  continue from it). A message from another chat — not the owner's answer.

No `docs/ROADMAP.md` — offer `/studio/setup` and stop. Do not touch the
current batch's items (`docs/BATCH.md`). The format of «Этапы» and
«Покрытие замысла» — the template
`.opencode/studio/templates/docs/ROADMAP.md`; the pieces and item markers —
as in `/studio/idea`, sections 5 and 7
(`.opencode/commands/studio/idea.md`).

## Assembly (without a mode)

1. **Read the concept.** In full — `docs/CONCEPT.md`, the other concept
   files (`docs/*CONCEPT*.md`), the owner's note, and foreign plan files
   (`GAME_ROADMAP.md`, `*ROADMAP*.md`, `*PLAN*.md` except `SETUP-PLAN.md`
   and `ROADMAP-PLAN.md`, the sections «Порядок работ», «Из плана
   владельца»): from a foreign plan we take the systems and the words, not
   its deadlines and layers; a file with a `DECISIONS.md` row «<файл> —
   отдельный план» — input only, do not ask about its fate. By headings and
   by searching for order words («до», «после», «этап», «рано», «позже») —
   `DECISIONS.md` (fixed decisions are not changed without a dialog),
   `ROADMAP.md`, «Что работает», `BLOCKED.md`. Two concepts — the dialog
   «Какой замысел главный?»: this is the core-contradiction dialog, the
   remaining contradictions are settled by the main one. Options (label
   short, file names — in the description): «<X> главный, <Y> — его первый
   этап» (`Recommended`, if Y leads to X as a first step: «строим, если Y
   получился») / «<X> главный, <Y> — архив» / «<Y> главный, <X> — архив».
2. **The list of systems** `С-01…` from every `##` section and `###`
   subsection of the concept with the owner's decision (except «Первая
   версия» and «Порядок сборки»), «Слова владельца» — verbatim. A system —
   what the player names in one word (trading, diseases, private lots); the
   mechanics inside it — into «Подробности» when its stage starts; a large
   concept — 20–50 systems. **Implicit** — by genre links, with the
   `[выведено из С-xx]` marker: enemies (bandits, predators, dragons,
   dungeons) → combat → health, damage, death and respawn; items (trading,
   food, crafting, mining) → inventory; crafting → recipes, workbench;
   multiplayer → login, saves, sync, cheat protection; economy → items,
   prices, sinks; open world → world saving, chunk loading; progression →
   experience, unlocks, balance; everything → menu, settings, pause,
   saving, sound, tutorial. What already exists in the code — `работает`
   (check against the code). «Требует» — what the system cannot work
   without (for enemies — combat, for items — inventory), and
   `DECISIONS.md` decisions about order («A до B», «B кладётся на A»): B
   gets A's number with a reference to the decision
   (`С-04 (DECISIONS, <дата>)`), that is how the script guards them. A
   section without its own system (goal, look, open questions) —
   comma-separated into the «Раздел замысла» of the system it belongs to:
   `Ядро, Одной строкой`.
3. **Gaps and contradictions** by categories: core loop; goal and failure;
   first version; multiplayer and platform; progression; economy; content;
   look and sound; «чего не делаем». For each — clear / partial / none; a
   contradiction — by name: section, decision, a working one.
4. **Dialogs.** Order of importance: composition > what is seen first >
   contradictions > taste.
   - A contradiction in the core, or «Какой замысел главный?» (step 1) —
     its own dialog, first; such a dialog is one.
   - Dialog 1 «Первая играбельная»: «Что игрок делает в первой играбельной
     версии, чтобы вы сказали „это моя игра“?» (`multiSelect`, 3–4 core
     verbs from the concept) and «Для кого первая версия?» — «Для себя:
     проверить, весело ли (Recommended)» / «Друзьям-тестерам» / «Сразу
     публично»; the free slots — the most important gaps.
   - Dialog 2 «Первый выпуск» — only system categories (core loop, goal and
     failure, multiplayer, progression, economy, content, look and sound)
     rated partial or none: «Что обязательно в первом выпуске:
     <категория>?» (`multiSelect`; options — the 2–4 largest systems or
     groups of the category, the category's remaining systems —
     `[допущение]`; unmarked → «Потом», an empty selection — the answer
     "nothing"; «Не делаем» — via «Другое»). With a ready release-composition
     proposal (a foreign plan's «в бете / потом» table) — the options from
     it, what is marked there — into the description; «пока не знаю» —
     `[допущение]` by it.

   After the answer — «Понял: …». What was not asked — `[допущение]`; what
   is open — into «Решения» of `BLOCKED.md` or «Вопросы к этапу».
5. **Stages — from «what the player will see»**, vertical slices: a
   technical base — not a separate stage, but the first items of the stage
   where the player sees it («двое видят друг друга в одном мире», «сотня
   ботов бегает, игра не тормозит»); a risk probe — the first item of the
   stage, except a render probe or an expensive feature judged by a pair
   of frames («Готово, когда: пара кадров»): it goes after the accepted
   light, `[вид]` does not reference it. Among `[вид]` the first — the
   global look (light, haze, tone, palette; 2D — palette and scene light):
   it does not wait for a render or shadow probe, the remaining `[вид]` —
   `[ждёт света]` until the light's `принят кадр` (a project without a
   light theme — without the marker, first — the theme by passport
   dependencies). A hint ladder for the game (not mandatory): first
   playable → first full loop → feature slice → content → release. A small
   concept (≤ 7 systems) — one stage «Первая версия» and «Потом». A stage
   — no more than a screen; over ~15 items or ~3 batches — cut by what is
   visible («сотня заглушек ходит по миру» → «двое строят»). Visible
   stages ≤ 7 (`сделан` not counted), the far ones — one line «Потом: …»,
   their systems in «Покрытии» — «Потом». The first — `идёт`, the next —
   `следом`, the rest — `потом`. Started queue work leading to the first
   playable's «Что увидит игрок» — its part; not leading — its own `идёт`
   stage («Довести начатое», size by the number of items), and the first
   playable — `следом`; it beyond the second stage — as a line in the plan,
   with why. What already works — `работает` in the stage that leans on
   it, or a whole stage `сделан <дата>`. In-game time — «3 игровых дня»,
   «пережить 3 дня», or in «…»: otherwise the script will take it for a
   deadline.
6. **Coverage:** every system — in exactly one stage, «Потом», or «Не
   делаем»; «Требует» does not point to a later stage. Run `python -X utf8
   tools/roadmap_check.py --plan docs/ROADMAP-PLAN.md` (no script in the
   project — the same one from `.opencode/studio/templates/tools/` with
   `--root <папка проекта>`; `/studio/setup обновить` will lay it down),
   fix what it found before showing.
7. **The plan for consent** — `docs/ROADMAP-PLAN.md`: «было → станет» (if a
   map existed: the table «старый этап K → Этап N / Потом», where the queue
   items, the foreign map's ones, and every «Из плана владельца» entry
   went), `## Этапы` with `### Покрытие замысла` in the template's format
   (the script reads them), the assumptions, what went into «Потом» and «Не
   делаем», the questions deferred to stages, «Решено за вас». Into the
   chat — the path and 3–5 lines of the gist (the stages, what the player
   sees in the first, the script's verdict), then the dialog «Принять
   (Recommended) / Поправить этапы / Поправить состав / Ещё поговорить»;
   with a foreign plan file — as the second question of the same dialog
   «<файл>: что с ним?» — «Оставить как архив со ссылкой (Recommended)» /
   «Удалить» (only if no other document references the file; they do — no
   question, an archive). «Поправить …» — listen, fix the plan, run the
   script, ask again; «Ещё поговорить» — a dialog about what the owner
   names.
8. **Record after «Принять»** (first `git status` and `git log` of these
   files: foreign uncommitted edits — stop and name them):
   - `ROADMAP.md` — «Этапы» and «Покрытие» from the plan (a section missing
     — insert from the template between «Текущая партия» and «Очередь»),
     the `идёт` stage's systems — `в работе` (except `работает`); the
     `идёт` stage's pieces — into «Подробности ближайших пунктов», its
     items with `[этап N]` — into «Очередь» by the priority from
     `AGENTS.md`. Do not lose the current items: the `идёт` stage's work
     and bugs — with `[этап N]`; a later stage's item — removed from
     «Очередь», the details kept with `[этап N]` in the heading; `Уборка:`
     items — as is, without `[этап N]` (a stage does not depend on them).
     «Из плана владельца» — entries verbatim into «Задумано, но не
     сделано» of the main concept (at the start of the entry — `[этап N]`
     or `[Потом]` and С-xx), into «Покрытии» and in the other documents'
     references to the section — a reference to it; the section itself then
     removed;
   - the main concept (`CONCEPT.md` or the one chosen in step 1) — «Первая
     версия» (for whom, dialog 1's verbs; the heading «Первая версия
     (MVP)» — likewise), «Чего не делаем»; its own list in «Порядок
     сборки» or «Порядке работ» — a reference to «Этапы» of `ROADMAP.md`
     (the old one — into «было → станет»); the owner's note — verbatim
     into the fitting `##` section or into «Задумано, но не сделано» with
     С-xx: the «Раздел замысла» of its systems — that heading. The second
     concept — only a row at the start «главный замысел — <файл>,
     <дата>»; its «Чего не делаем» is not edited (it is about its stage);
   - `DECISIONS.md`, «Как ведётся работа» — «<дата>: карта собрана
     `/studio/roadmap` — N этапов, покрытие X/Y; главный замысел —
     <файл>, <второй> — первый этап | архив», what was chosen in the
     dialogs verbatim, and the table «старый этап → новый»;
   - `BLOCKED.md`, «Решения» — the open decisions;
   - `README.md` and `README.ru.md` — the `status` and `pitch` blocks (when
     «Одной строкой» changes); About in `AGENTS.md`'s «Git» — rebuild if
     «Одной строкой» changed (everything — per
     `.opencode/studio/reference/COMMITS.md`);
   - references to the foreign plan file and its stage numbers
     (`AGENTS.md`, «Какой документ когда»; the concept, `BLOCKED.md`,
     `TESTING.md`) — to `ROADMAP.md`'s «Этапы» and the new numbers by the
     table.

   The script — once more, without `--plan`. The foreign plan file — per
   step 7's answer: an archive — the row at the start «перенесено в
   `ROADMAP.md`, «Этапы», <дата>»; «Удалить» — into the same commit. The
   documentation commit `Roadmap:` / `Карта:` («Roadmap: Plan six stages
   from first playable to release» / «Карта: шесть этапов от первой игры
   до выпуска»), files by name; push, if in `AGENTS.md` commits are
   pushed; delete the plan. The report: what the player sees in the first
   stage, the stages in one line, the coverage, what went into «Потом» and
   «Не делаем»; About changed and one deleted on GitHub — two rows per
   «About» of `COMMITS.md`; then — `/studio/start` in the dev chat.

## `следующий`

The `следом` stage → `идёт`. No «Этапы» — assembly; no `следом` — offer
`пересмотр`. An `идёт` stage still exists: its items in «Очереди» or in the
batch (`docs/BATCH.md`) — «Этап N ещё идёт: его закрывает `/studio/done`
после последнего пункта» and stop; no items — the dialog «Этап N — закрыт?
(по «Закрыт, когда»: …)» — `Да (Recommended)` / `Нет, ещё: …`. «Да» — as in
`/studio/done` (`сделан <дата>`, its systems — `работает`), then steps 1–4;
«Нет» — take the note apart as `/studio/idea` (the items `[этап N]` into
«Очередь») and stop.

1. Read the stage, its systems in «Покрытии», their concept sections, and
   the «Задумано, но не сделано» entries with `[этап N]`; against the code —
   what already works.
2. The dialog «Вопросы к этапу» (≤ 4) — from its row and from what changed;
   no questions — without a dialog. The answer — verbatim into
   `DECISIONS.md`; «пока не знаю» — into «Решения» of `BLOCKED.md`, the item
   `[ждёт …]`.
3. The pieces — into «Подробности», the items `[этап N]` — into «Очередь»
   (a risk probe — first, a pair-of-frames probe — after the accepted
   light; `[вид]` — light first, the rest `[ждёт света]`, assembly step 5;
   details with `[этап N]` left earlier — take them); the stage's systems —
   `в работе` (except `работает`); the `потом` stage after it — `следом`;
   fix the «Сейчас: …» row; README and About — as in assembly step 8.
4. The script, the documentation commit `Roadmap:` / `Карта:` by name; the
   report: what the player will see, the first items, the About line
   (step 8), then — `/studio/start` in the dev chat.

## `пересмотр`

The concept changed, an owner's note arrived, or the script found sections
without systems. Assembly steps 1–3 — check the system list against the
current concept and the note; the new — into the map by steps 4–6; the
outdated — into «Не делаем» with a reason (and in `DECISIONS.md`) as a
separate list of the plan: the owner sees it before «Принять»; a system
with a «Задумано, но не сделано» entry is not counted as outdated. The
numbers, names, and dates of `сделан` stages are not changed. «Было →
станет» — in `docs/ROADMAP-PLAN.md`; changes of an `идёт` stage — as a
separate row. The dialog of step 7, the record — step 8.

## `прогноз`

Only by closed stages (`сделан <дата>`): the pace rows of `/studio/retro`
in `DECISIONS.md`'s «Прогноз»; none — a count by the history of
`docs/BATCH.md` (the «Снята …» removals with `[этап N]` items). How many
batches a stage of each size took, how many days a batch ran; the remaining
stages — as a range «N–M партий (~дней по вашему темпу)», with the caveat
«на стадии замысла ошибка до 4× в обе стороны; уточнится после этапа K»
(K — the `идёт` stage). The row — into `DECISIONS.md`, «Прогноз» (no
section — start one by the template), the documentation commit `Roadmap:` /
`Карта:`. No closed stages — say so, without invented numbers. Into
«Этапы» write no days.
