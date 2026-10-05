---
name: studio — style concept
description: Protocol of the style concept (section 8 of /studio/idea) — a whole-frame picture or a style spec (ТЗ) — topic passports, INDEX style rules, contradictions, questions. Load when a style concept is brought.
---

“Section N” references mean the `/studio/idea` protocol; a single
reference's analysis (section 3) — the `studio-obrazec` skill.

## 8. Style concept (the look of the whole game)

**When** the input is the look of the whole game, not of one topic: a
picture of a whole frame without a named topic and/or a style spec
(several topics, shared rules, prohibitions), “стиль игры”, “концепт
стиля”, or “дизайна”; `/studio/idea концепт` — continue from
`docs/refs/_concept/` (do not ask for the brief's header again). Doubt —
the dialog “Это стиль всей игры, образец одной темы или замысел — что в
игре делают?” (a topic — section 3, the game concept — sections 1–7).
Everything outside the spec — sections 1–7.

**Key points:**

- **Boundary: the style concept changes only the look** (what — step 7).
  It does not edit and does not silently propose changes to the game
  concept (`docs/*CONCEPT*.md`: «Одной строкой», «Ядро», «Чего не делаем»,
  mechanics, genre, tone), «Этапы» and «Покрытие» of `docs/*ROADMAP*.md`,
  or setup decisions of `DECISIONS.md`, except the look fragment of a
  concept line by a `Да` answer (steps 2, 6). “Заменить всё прежнее”,
  “вместо Valheim” (games in brackets — former references) — an answer
  about the former look references: for the taken topics `Концепт` (a
  subtopic the concept does not have — with the former one), `Да` about
  the main reference (taken not `Всё` — `Нет`), the spec's scale; without
  a question, the words — into the brief's header and `DECISIONS.md`,
  into the result — what was replaced. A concept line is decided by
  neither it nor “замысел не трогаем”: that is the boundary, not an
  answer about the look.
- The first line of the analysis result (step 5) — “Это концепт стиля:
  меняется вид игры; замысел, механики и этапы не меняются” (there will
  be a question about the line, step 6, — also “; строку <файл, раздел> о
  виде — только если ответите «Да»”); of the layout result — “Замысел
  (жанр, механики, этапы) не менялся; по файлам:”, for each
  `docs/*CONCEPT*.md` — “не тронут”, “только «Задумано»” or “<раздел>:
  было «…» → стало «…» (вид, по вашему «Да»)”.
- The spec and the picture — input, not a decision: lose no spec line,
  do not silently change the owner's former choice; it lays things out
  itself, before dialogs — only `_concept/`.

1. **Save** into `docs/refs/_concept/`: the picture —
   `target-<дата>-<n>.<ext>` (where it lies, how to shrink it to 2560 px —
   `.opencode/agents/reference.md`, steps 1–2), the spec verbatim —
   `brief-<дата>.md` with a header: where from, the date, the owner's
   words (no spec — the brief from the words, “ТЗ п. N” below —
   “картинка: <что видно>”).
2. **Distribute the spec's lines:**
   - **topics** (as in the queue of step 7; camera and pacing —
     `[ощущение]`): the passport `docs/refs/<тема>.md` and what the owner
     chose in it; «Составляющие» lines per
     `.opencode/studio/templates/docs/refs/_topic.md` with the spec item
     and the proof `видно` or `сказано в ТЗ`; a crop by frame fractions
     `x,y,w,h` — `_concept/target-<тема>-<n>.png` (no Pillow — the
     fractions into the passport and the analysis; for a light topic the
     subject is the whole frame: its copy under the name
     `target-<тема>-1.png`, not the `target-<дата>-N` itself). The
     picture contradicts the spec — the spec is stronger, what is
     disputed in the picture — «не берём» (into the passport's
     «Противоречия»);
   - **not in the product yet** — a topic or asset whose system is in the
     game concept or the plan but not in the product (bushes in
     `GAME_CONCEPT.md` and a `GAME_ROADMAP.md` stage): a passport is
     allowed, the item — into «Задумано» of `docs/CONCEPT.md` (`[этап N]`
     of the plan or `[Потом]`), not into «Очередь», without an order;
     into the result — “<файл>, этап N: K пунктов вида — привяжет
     `/studio/roadmap пересмотр`”;
   - **outside the style** — the game's genre, goal, and tone, mechanics
     and systems (building, the day-night cycle, weather), positioning,
     feel landmarks, and also a topic or asset whose system is in neither
     the concept nor the plan, or is in the main concept's «Чего не
     делаем»: without a passport, item, order, or dialog, verbatim into
     the brief's header “Вне стиля: п. N — <суть>”, into «Правила стиля»
     — only the look half. Present in the concept or plan — “уже в
     <файл, раздел>”; the genre otherwise — “ваш замысел: «<цитата>»”;
     nowhere — into the result “обсудить — `/studio/roadmap пересмотр
     <суть>`” (without «Этапы» — `/studio/roadmap <суть>`);
   - **cross-check** — against the look etalon (from `INDEX.md` or
     «Правила проекта», for example `docs/VISUAL_TARGETS.md`), the queue,
     `docs/BATCH.md`, the concept files. The spec against a setup
     decision (a generator, world data, a technique — `DECISIONS.md`; a
     shape rule, for example `docs/ROUNDED_WORLD.md`) — no dialog: “ТЗ
     п. N против <решение>: вид — в его пределах; менять — `/studio/idea`
     отдельно” — into the analysis, the result, the passport's
     «Противоречия», and the `[вид]` item's «Не входит». The look in a
     concept line: in «Одной строкой» and «Чего не делаем» — do not edit,
     “обсудить”, as “outside the style”; in another — the question of
     step 6.
3. **Style rules** — what is shared by the concept's topics per the
   «Правила стиля» lines of the template
   `.opencode/studio/templates/docs/refs/INDEX.md`, each line with the
   source “ТЗ <дата>, п. N”, with **prohibitions**.
4. **The recognition sheet**: `python -X utf8 tools/look_sheet.py
   --only-ref --ref <картинка> --crop "Рельеф=x,y,w,h" … --out
   _concept/sheet-<дата>.png --json _concept/sheet-<дата>.json` (≤ 4
   crops; then `sheet-<дата>-2`; no script —
   `.opencode/studio/templates/tools/`); colors — HEX from the json,
   `измерено`.
5. **Analysis** — in the format of section 6 without dialogs, into a file
   outside the project (into the chat — the path, the sheet, the result in
   3–5 lines): topics, rules, “outside the style”, **contradictions**
   “было → в концепте”; **expensive in the picture** (dense grass to the
   horizon, reflections) — not “abandon”, but the passport's «Лестница
   качества» per `_topic.md`, the cost — `оценка` within «Бюджет
   производительности» of `docs/TESTING.md` (missing — “бюджет —
   `/studio/setup обновить`”) and «Ловушки стека»; an open decision of
   `BLOCKED.md` — by link, not a new question.
6. **Dialogs** (ASKING step 8; after two — only the entailed ones: about
   the line, “Куда”):
   - the `multiSelect` “Концепт стиля <дата>: что берём в вид игры?” —
     `Всё (Recommended)`, two topic groups (“Земля и вода” / “Деревья,
     небо, свет”), last `Ничего из этого` (with groups, `Всё` does not
     count); “Концепт стиля <дата>: главный образец вида вместо <прежний>
     — его правила стиля для всех тем?” — `Да` / `Нет, только взятые
     темы` (the former — from `INDEX.md` or a `DECISIONS.md` look entry;
     none — without “вместо …”, with `Да (Recommended)`); the spec's scale
     of a different step than in `INDEX.md` — “Шкала стилизации: прежняя
     — X (выбор <дата>), концепт стиля — Y. Что берём?” — `Концепт` /
     `Прежняя`;
   - contradictions of the taken topics with the former look reference (a
     confirmed passport or an accepted frame, the main reference, the
     etalon, a `DECISIONS.md` look entry; after `Да` about the main
     reference — with it and its etalon lines — `Концепт` without a
     question), one question per topic, ≤ 4: “<Тема>: прежний образец
     говорит X, концепт стиля — Y. Что главнее?” — `Концепт` /
     `Прежний образец` / `Смешать` (description — what from what, what
     happens to the passport and the item; `(Recommended)` on `Концепт` —
     only if the owner said “хочу так” and the former was not his choice,
     ASKING step 6); does not fit or no answer — «Решения» of
     `BLOCKED.md`: “Концепт стиля <дата>, <тема>: X или Y? —
     `/studio/idea концепт`”;
   - a look line in a concept file (step 2) — for a taken topic without a
     `Прежний образец` answer (if there is a “что главнее” question —
     after its answer): “<что за файл — по «Одной строкой», не
     заголовком>, `<путь>`, «<раздел>»: концепт стиля меняет вид — «<весь
     видовой оборот>» → «<новое>». Поправить только это?” — in product
     words (“Описание стенда, `docs/CONCEPT.md`, «Ядро»: …”) — `Да, только
     это` (“это вид, не механика; меняется только этот оборот”) / `Нет,
     строку не трогать` (as in the line; the concept — «Чего не берём»);
   - `docs/ROADMAP.md` has «Этапы» — “Куда” (section 6), one question for
     all look items, without `Не делаем` and «Покрытие» lines.

   The answers — at once, verbatim, into the brief's header, what is not
   taken — “Не берём: … (<дата>)”; empty or “пока не знаю” — outside
   `_concept/` only the «Решения» line of `BLOCKED.md` “Концепт стиля
   <дата>: что берём? — `/studio/idea концепт`”; `Ничего из этого` —
   “Не берём: всё”, and nothing more.
7. **Layout** of what is taken — only this:
   - passports per `_topic.md` and its «Образец из концепта стиля»
     (missing — create, present — Edit, as `reference`, step 7, do not
     return to `черновик`; «Образец для листа» — a crop of the topic's
     subject at the same camera angle `target-<тема>-N.png`, not a whole
     frame), «Лестница качества» — from step 5; `Концепт` — the line
     `да`, the former — into «Журнал»; `Прежний образец` — the concept
     only as an «Образцы» line with «Чего не берём»; `Смешать` — by the
     note; the answer verbatim — into «Журнал» and «Противоречия» of the
     passport and `INDEX.md`; the state — `подтверждён владельцем
     <дата>` (and in `INDEX.md`'s «Темы»), without an answer — do not
     touch the former passport (a new one — `черновик`), the topic's item
     — `[ждёт образца]`;
   - a topic with a batch item (`docs/BATCH.md`) — before `/studio/done`
     only a review note on the item (section 7, step 3) and the «Журнал»
     line “концепт <дата> ждёт `/studio/done`”; the rest — `/studio/idea
     концепт` after the batch («Решения» of `BLOCKED.md`);
   - `INDEX.md`: into «Правила стиля» (no section — per the template) —
     “Концепт <дата>: `_concept/target-…` (ТЗ `_concept/brief-…`)” and
     the taken topics' rules (`Нет` about the main reference — “для тем:
     …”); into «Шкала стилизации» — the spec's scale by `Концепт` or
     “заменить всё” (the former — “было: … (<дата>)”), none former — at
     once; `Прежняя` or no answer — do not touch (no answer — the
     «Решения» line of `BLOCKED.md` “Концепт стиля <дата>: шкала X или
     Y? — `/studio/idea концепт`”); `Да` about the main reference —
     «Главный образец» (the former's debt in `BLOCKED.md` — into the
     result); into the «Правила проекта» of `AGENTS.md` — the line
     “Правила стиля и запреты — `docs/refs/INDEX.md` (пункты `[вид]` и
     заказы)” (present without the bracket — append), do not copy the
     prohibitions;
   - the concept files: for its topics' entries in «Задумано» — “образец:
     docs/refs/<тема>.md”; the «Вид» of `CONCEPT.md` (if present) — the
     main reference and the scale in one line, in detail —
     `docs/refs/INDEX.md`, into the result “было → стало” (it was empty —
     also “привяжет `/studio/roadmap пересмотр`”); `Да` about the line —
     Edit only that phrase (into the result — also what in the concept
     and the decisions now diverges from it); `Нет` — do not touch the
     line in any way;
   - `DECISIONS.md`, the section about the look — the step 6 answers as a
     line: what was chosen, what rejected, what it replaces (scope —
     “только вид”); the outdated in the look etalon — with the note
     “заменено концептом <дата> — docs/refs/<тема>.md”;
   - the queue (section 7; “not in the product yet” — step 2): **the
     concept's first `[вид]` item — «Глобальный облик: свет, дымка, тон,
     палитра»** (2D — “палитра и свет сцены”; the passport “свет и
     атмосфера”), `[можно]`, does not wait for the render probe, shadows,
     and other `[код]` items: sun, ambient, haze, tonemapping, glow, SSAO
     exist in any of the project's renderers; the other `[вид]` items —
     `[ждёт света]` until the light's `принят кадр` (light's `[ощущение]`
     items do not wait; the `[код]` items that need accepted light —
     section 7), the order guideline — light, sky and haze → terrain →
     grass and soil → trees → water and shores → stones → buildings (not
     hard-coded: by the passports' dependencies; a project without a
     light topic — first “палитра и свет сцены” or a topic by
     dependencies, without the marker); a topic item judged by the eye
     already present — an edit of its «Образец», its «Куски» (`[код]` →
     `[вид]`; with `Прежний образец` — do not touch); do not write into
     another plan (another `docs/*ROADMAP*.md` with stages, for example
     `GAME_ROADMAP.md`) — items into `docs/ROADMAP.md`, into the result
     “<файл>, этап N: K пунктов вида — привяжет `/studio/roadmap
     пересмотр`”;
   - the spec's assets that passed step 2 — code (item pieces) or an order
     per «Правила проекта» and `DECISIONS.md`: a draft per
     `.opencode/commands/studio/order.md`, sections 1–4, without dialogs,
     for existing `docs/orders/<вид>.md`, into `docs/prompts/` and
     `BLOCKED.md` — `черновик — оформить /studio/order`; no such kind, or
     the file already lies — «Решения» of `BLOCKED.md` “Концепт стиля
     <дата>: завести вид <вид>? | перезаказать <путь>? —
     `/studio/order`”; a file the code does not read — with a hookup
     item; into the result — “Заказы по ТЗ: N — `/studio/order`”;
   - **the technique — mandatory** for every taken topic, not “if
     needed”: `reference` “концепт: приём”, up to three at once — the
     topic, the spec's lines, the crop, the engine, the paths of the
     library `.opencode/studio/reference/LOOK_TECHNIQUES.md` and
     `docs/refs/TECHNIQUES.md` («Свои приёмы»; missing — from
     `.opencode/studio/templates/docs/refs/`); first from the library
     without a web search (≥ 2 techniques per base component), the web —
     only when it has no technique; it also writes «Разрыв», «У нас:
     приём:», and «Чем делаем» (section 3).
8. **Commit** — as in section 7, but with the mark `Reference:` /
   `Образец:`; by name — `_concept/` and the files of steps 6–7 (concept
   files — only «Задумано», «Вид», and the step 6 line); do not take
   another chat's sheets in the topics' folders.
