# A deployed project: `/studio/setup обновить` and a repeated `/studio/setup`

`/studio/setup` without «обновить» in a deployed project — the dialog «Проект
уже развёрнут — что делаем?»: «Обновить процесс (Recommended)» — carry over
the new template, do not touch the project's own / «Пересмотреть старт» — the
stack, references, or the queue: I will show what changes / «Ничего» — exit.

## 0. Migration from the Claude studio

The project was deployed with the Claude version of the studio: the
instructions are in `CLAUDE.md` (the «шаблон vN» tag is there), no
`AGENTS.md`. OpenCode reads only `AGENTS.md` — move it: `git mv CLAUDE.md
AGENTS.md` (the history survives); the template tag — into the `AGENTS.md`
tag comment; then — «Обновить процесс» per `AGENTS.md`. The lines about
Claude Code in non-process sections (`Stack`, `Commands`) — leave as is.
Recent Claude Code also reads `AGENTS.md`; if it does not — ask with a
dialog: «переименовали — вернуть `CLAUDE.md` как ссылку-указатель на
`AGENTS.md`» (one line, not a copy: one piece of knowledge — one place). Only
the `.md` instructions: `docs/`, `tools/`, `.wt/` of the Claude studio —
compatible as is, rename nothing.

## Update the process

1. A batch is running (`docs/BATCH.md` is not «Пусто.») — do not update until
   `/studio/done`, except the missing `tools/` from p. 5 (the scripts and
   `perf_ref.json`, but not `code_check.py` with the baseline: the baseline
   is taken from accepted code): lay those out immediately, as a separate
   commit. In the needed files there are someone else's uncommitted edits —
   finish those first.
2. The tag — from the `шаблон vN` comment in the project's `AGENTS.md` (none
   — v1); the same as in `templates/AGENTS.md` — the process is fresh, go to
   p. 5. Compare with the templates only the **process** sections:
   - `AGENTS.md`: «Команды», «Два чата», «Как приходит работа», «Метки
     пунктов очереди», «Правила кода» (missing — after «Правила проекта»),
     «Правила процесса», «Как спрашивать владельца» (the list — from the
     template's tag comment); the project's own lines in them — into the
     «пропадут» list (p. 3). «Какой документ когда» and «Git» — only the
     template's missing lines, do not touch the project's lines and do not
     include them in «пропадут»; no «Git» — insert after «Запуск и проверка»
     (p. 7);
   - `docs/TESTING.md`: «Параллельная работа», «Правила каркаса», «Ловушки
     стека», «Принято без полной проверки», «Нестабильные проверки»; the
     line «Канонические ракурсы», the column «Сколько идёт · предел», and
     the lines «сценарий игрока», «стенд ощущения», «замеры», «сборка»,
     «проверка сборки», «здоровье кода», «типы» in «Командах проверки»; the
     probe rule in «Замерах»; the sections `## Здоровье кода` (after
     «Замеров»), `## Сценарии игрока`, `## Стенд` (was `## Стенд вида`; in
     the «вид» part — the template's lines about the frame's hour from the
     passport, the `concept` preset, gauges only on the reviewer's
     screenshots, `-Model <путь>`, and the number of `[вид]` themes per
     batch), `## Выпуск` and `## Окружение` (with the Context7 line); the
     line «Как открывается окно», and for a product with a real-time world
     (game, stand, viewer) `## Бюджет производительности` — only if they are
     missing (p. 4);
   - `docs/CONCEPT.md`: «Архитектура» empty (`{{…}}`) — the template's
     skeleton from the code: «Где что» — by entry points and folders (only
     what is found), the layers — only what the code already follows,
     otherwise `?? нужно подтверждение`; filled in — do not touch its text,
     but append under it what is missing from the skeleton: «Службы
     (автозагрузки):» — from `[autoload]` (empty — «нет»), «Новая система:» —
     the recommendation by the code's folders, with the «Решено за вас»
     line, the tables «Где что» (by entry points) and «Копии, которые
     нельзя убрать» — pairs without a shared call (a shader ↔ CPU code,
     another process) already guarded by the equality check (names like
     `*_matches_*`), otherwise empty; a second copy in another language of
     the same process (Godot .NET: GDScript ↔ C#) — not here, but as a p. 9
     line. Architecture is technique: its `??` does not go into «Решения» of
     `BLOCKED.md` (cleared by `/studio/retro` per «`[правило кода]`
     дважды»);
   - `docs/BATCH.md`: the header and the table's columns;
   - `docs/ROADMAP.md`: the «Подробности ближайших пунктов» item format, the
     route tags, `[этап N]` and `[ждёт света]`, the type «Готово, когда:
     пара кадров», the note and the format of «Этапов» and «Покрытие
     замысла» (the stages and rows — the project's own). No «Этапов» — do
     not insert empty: without them the commands work as before,
     `/studio/roadmap` assembles them (p. 6). «Из плана владельца» empty —
     remove it; with entries — leave it: `/studio/roadmap` will lay them out
     into stages or into «Потом»;
   - `docs/orders/art.md`: the «### кадр-цель» block (the additions
     «перекрась в стиль образца…», «не по геометрии») and the card frame for
     the picture by geometry — only the template's missing lines: order
     rules, not the project's style.
3. The per-section difference («было → станет») — into a temporary file
   outside the project; separately — the project's lines that will disappear
   in the replacement. Into the chat — the path and 2–3 lines of essence,
   then the dialog «Применить (Recommended) / Показать подробнее / Не
   сейчас». «Показать подробнее» — open the file and ask again; «Не сейчас» —
   change nothing.
4. «Применить» — insert the missing, replace the process sections with the
   template's text with the project's values (branch, push), append the
   missing lines in «Какой документ когда» and «Git». Do not touch the
   project's own: the stack, «Правила проекта», the queue, the entries, the
   check commands, the filled-in subsections of «Параллельная работа».
   Translate the state line: `предел: N` → `пишут: N · тяжёлых проверок: 1`.
   `## Стенд`: was `## Стенд вида` — its text and state become the «вид»
   part; was not — «вид» `нет` (no world judged by eye — «не нужна: …»); the
   «ощущение» part — `нет` (no controls and camera — «не нужна: …»); `##
   Сценарии игрока` and the new command lines — «нет»; not a game — «не
   нужен: …»; the line «замеры»: the group «замеры» runs in the "full" one —
   move it from there to here (a check-command edit — with the «Решено за
   вас» line); no group — «нет — строит пункт «замеры по бюджету»» (p. 9);
   `## Выпуск` — «нет — до первого выпуска»; `## Окружение` — fill per
   `env.md` (installing anything and Context7 — only by a dialog, as there);
   no «Движок:» line in the «Стек» of `AGENTS.md` — append it. `## Здоровье
   кода` — of the «Типы» blocks — the own stack's blocks (Godot with C# —
   both); do not enable the engine's warnings and `Nullable` yourselves (the
   quick run will go red) — that is cleanup (p. 9); the line «Типы движка» —
   «не включены — включают уборки типов, по папкам; сами не включать»
   (already enabled — `включены`). «Правила каркаса»: the project's runner
   keeps a list of checks — append to the line «раннер находит проверки сам»
   the words «цель; пока — по «Как добавить проверку», до приёмки уборки
   раннера» (its line — into «Найдено по ходу», p. 9; `/studio/idea` is what
   puts it into the queue). `## Бюджет производительности` (a real-time
   world; exists — the project's own, do not touch): «Цели для игроков» —
   the answer of the p. 3 dialog question (`talk.md`, quick start: one
   question as a bundle); the owner's earlier decisions about speed
   (`DECISIONS.md`, «Производительность»; the `CONCEPT.md` constraints)
   outweigh — their numbers into the own level's line (about his computer —
   «машина владельца») with the decision date; diverging from the dialog's
   variant — name it in its description; «Бюджет систем» — per the project's
   «Замеры» with the note «оценка до первого замера», nothing to take — «??
   после первого замера»; «Машины замера» — per `env.md`, Result, and
   `tools/perf_ref.json`; the owner's other machine in «Замерах» (a laptop)
   — the line «Не блокер» in `BLOCKED.md` about calibration («Машины
   замера» of the template); «Как открывается окно» — per `testing.md`,
   p. 10; an unverified flag — «не проверено: <флаг>». A game without a
   scenario runner — into the report: put the item «Довести проверки:
   сценарии игрока через ввод» via `/studio/idea`. The `{{…}}` of what was
   inserted — from the project; the unknown — `?? нужно подтверждение`; by
   dialog — only the owner's decision (here — «Цели для игроков»), the
   technical — without a dialog. Raise the tag to the template's tag.
5. The missing files — create from the templates, showing the list: `docs/`,
   `docs/refs/INDEX.md`, `tools/roadmap_check.py`, `tools/refs_check.py`,
   `tools/look_sheet.py`, and `docs/refs/TECHNIQUES.md` («Свои приёмы» — a
   separate file next to the plugin's library, no merging; if the world is
   judged by eye), `tools/perf_ref.json` (a real-time world),
   `tools/asset_check.py` and `docs/orders/ledger.md` (there is
   `docs/orders/` or it is a game), `tools/model_check.py` (3D: there is
   `docs/orders/model3d.md` or `.glb`/`.gltf` models in the project; 3D
   without the `model3d` kind — into the report «завести вид `model3d` —
   `/studio/order model3d`»), `docs/.gdignore` for Godot, README (p. 7); no
   «Прогноз» section in `docs/DECISIONS.md` — insert it from the template.
   The `tools/` scripts that exist but differ from the templates — replace
   with the template ones (in the same list); `tools/perf_ref.json` — do not
   replace: append the template's missing lines, keep the project's lines
   (calibration, added machines, `levels`). Code health:
   `tools/code_check.py` — like the neighbors, `tools/load_all.gd` — for
   Godot; `tools/code_baseline.json` — **never replace**: missing — `python
   -X utf8 tools/code_check.py --baseline`; present — `--baseline
   --add-new-metrics`; corrupted (code 2 «база испорчена») — restore from
   git, do not rewrite. Assets already lying in git — into the journal with
   what is known from `docs/prompts/` and `docs/BLOCKED.md`, the state
   `принят <сегодня>`; the unknown (the plan, the license) — `не выяснено`,
   as `ledger.md` instructs, do not invent. No `.gitattributes` — offer it
   as a separate question in the same dialog or in one of your own (what is
   in it and why — `plan.md`, step 8); after it the files may become
   «изменёнными» — carry them over with a separate commit `git add
   --renormalize <файлы поимённо>`, the note `Process:` / `Процесс:`
   («Process: Use the same line endings in all files» / «Процесс: единые
   концы строк во всех файлах»).
6. **Someone else's maps.** Before the p. 3 dialog, find plan files in the
   root and `docs/` — `GAME_ROADMAP.md`, `*ROADMAP*.md`, `*PLAN*.md`
   (except `docs/ROADMAP.md`, `SETUP-PLAN.md`, `ROADMAP-PLAN.md`), a
   «Порядок работ» section in the concept — and a second concept next to
   `CONCEPT.md`. There are — a question in that dialog (the process fresh —
   with your own): «Перенести в «Этапы» через `/studio/roadmap`
   (Recommended)» / «Оставить отдельно» — a line into «Как ведётся работа»
   of `DECISIONS.md`: `- <дата>: <файл> — отдельный план, в «Этапы» не
   переносим` (for a concept — `отдельный замысел`) / «Не трогать» — I will
   ask next time. A file with such a line — do not ask, a line into the
   report. Do not edit the files themselves; «Перенести» — propose
   `/studio/roadmap` as the report's last line, do not run it silently.
   Neither them nor «Этапов» — into the report «разложить замысел на этапы
   — `/studio/roadmap`».
7. **Git and README** — before the p. 3 dialog. In the «Git» of `AGENTS.md`
   no line `Язык коммитов:` or `README:` — first from the project, with the
   «Решено за вас» line: the commit language is named in «Правила проекта» —
   record it; both `README.md` and `README.ru.md` exist — `en + ru`. The
   rest — the questions from `talk.md`, round (d) (the recommendation —
   `English`, `en + ru`; the old commit history stays as is). README — per
   the answer and `.opencode/studio/reference/COMMITS.md`: no file — create
   from the template (p. 5); present with tags — update the blocks without
   a question; present **without tags — do not rewrite**: assemble the
   blocks, «было → станет» — into the p. 3 difference file. Places: `pitch`
   and `status` — right under the title, the rest — at the end; under the
   title too — the cross-link line to the second language, if the first 10
   lines have no link to `README.ru.md` / `README.md`. A section of the same
   meaning (and the text between the title and the first `##` — that is the
   `pitch` meaning) is not replaced: into the difference file — «похожий
   раздел: <имя>». The question — «Описание проекта (README): вставить
   блоки, которые команды будут обновлять сами?» — `Вставить блоки
   (Recommended)` — I will add the blocks, your text I will not touch /
   `Вставить и заменить: <разделы поимённо>` — these sections will go,
   their text — in the difference file (only if similar ones exist) /
   `Показать подробнее` — I will open the difference and ask again / «Не
   трогать README» — a line into «Как ведётся работа» of `DECISIONS.md`:
   `- <дата>: README — без блоков studio`; with it, do not ask. The second
   language (per the «README:» line) — only together with inserting the
   blocks or for a tagged `README.md`: per the `templates/README.ru.md`
   template (`README.md`); outside the tags — only the title and the link,
   the introduction — that is `pitch`. The p. 4–7 questions — in the p. 3
   dialog (the process fresh — with your own), while there are ≤ 4 there;
   they do not fit — the first dialog «Применить» and the players'
   computers, the rest — a second dialog right away. The answer about the
   players' computers — record into `DECISIONS.md` also on «Не сейчас» (the
   commit `Процесс:`). About — assemble into «Git»; changed and there is a
   GitHub remote — as lines into the report, like `/studio/setup`, step 12.
8. Queue items resembling `[вид]` (light and sky, water, vegetation,
   terrain, buildings, characters, effects, animation) or `[ощущение]`
   (controls, camera, pacing, sound, recoil), and `механика` passports about
   controls, camera, or sound — do not re-tag by yourselves: enumerate in
   the report «переметить и разобрать образцы — `/studio/idea`». `вид`
   passports where `refs_check.py` does not find «Главное впечатление»,
   «Разрыв», «У нас: приём:», or «Чем делаем», or «Образец для листа» — a
   whole concept frame — do not fill in by yourselves: «дописать паспорта —
   `/studio/idea`», and into «Найдено по ходу» of `docs/BATCH.md` the line
   «паспорт <тема> неполон — reference через /studio/idea» for each (by it
   `/studio/idea` calls `reference` without a dialog; the items of these
   themes `/studio/idea` keeps `[ждёт образца]` or `[ждёт света]`).
9. **Findings — into the queue without a dialog.** In `docs/BATCH.md`,
   «Найдено по ходу», if they are neither there nor in the queue (the
   technical ones: `/studio/idea` sets them itself, with the «Принято по
   умолчанию» line). Search the whole code (and `scripts/`, not only
   `tests/`), tracing where a number in an assertion comes from; one line
   per defect:
   - an FPS threshold in a check under `--headless` or by a per-second
     counter (in Godot — `Engine.get_frames_per_second`,
     `Performance.TIME_FPS`) — «<имя>: порог FPS ничего не стережёт — порог
     убрать, остальные утверждения оставить в полной, скорость — сценарием
     группы «замеры» в окне»;
   - a threshold in ms inside the full run — «порог времени в полной
     (<имя>) — вынести в «замеры»»;
   - a measurement route by real time — «<имя>: маршрут — на
     `--fixed-fps`»; frame clock instead of CPU and GPU render time —
     «<имя>: часы кадра — на время видеокарты»;
   - C# in Debug without optimization — «замеры C# идут без оптимизации —
     собирать с `-p:Optimize=true`»;
   - check and screenshot commands with an always-on-top or focused window —
     «окна проверок не мешают работе»; a window in the corner
     (`--position`) instead of beyond the screen edge (in Godot —
     `window_set_position` in the startup script) — «окна проверок — за
     край экрана»;
   - the group «замеры» without `--занят` — «замеры: режим занятого
     компьютера (`--занят`: пометка, без базы и красного)»;
   - a real-time world without the budget measurement group — «замеры по
     бюджету»;
   - the look stand without the frame's hour of day — «стенд: час кадра из
     «Кадров» паспорта аргументом (поле `time` у кадра стенда), лист —
     `--time`; проверка стенда сверяет час с паспортом»; without the gauge
     switch — «стенд: кадры владельцу (`done/`, лист) без капсулы и куба,
     мерки только на снимках проверяющего» (the hour and the gauges are
     needed by the first `[вид]` — `/studio/idea` sets them before it);
     there is a «свет и атмосфера» passport but no `concept` preset —
     «стенд: пресет `concept` из «Составляющих» паспорта света — после его
     приёмки листы всех тем на нём — `[ждёт света]`» (the values are taken
     from the accepted variant); 3D without `-Model` — «стенд: `-Model
     <путь>` — файл модели в кадре рядом с нашими вариантами»;
   - look benchmarks and the tone and edge checks (the benchmark file from
     «Правила проекта», the `*tone*` checks, edge fog up to the world's
     edge), taken before the light acceptance — «эталоны — снято до света:
     первым куском пункта света перевести на относительные утверждения его
     паспорта; по ходу не подгонять» (not a separate item: `/studio/idea`
     puts this as the first piece of the global look);
   - a look decision replaced by the concept (a line with «заменен» and
     «концепт» in `DECISIONS.md`, `INDEX.md`, or the look benchmark from
     «Правила проекта» — the literal «заменено концептом» note may be
     absent) — «снять числа старого образца: <места по grep номера решения и
     имени прежней игры>»; your own mesher without vertex AO — «вершинный AO
     в мешере (приём библиотеки `LOOK_TECHNIQUES.md`, 0 мс в кадре)».

   A 3D world without «Настройки графики» in the queue and «Сделано»:
   presets already in the code — «Настройки графики: довести — ультра,
   ползунки лестниц, автоподбор под компьютер игрока»; none — «Настройки
   графики: пресеты из лестниц качества, автоподбор под компьютер игрока
   (`/studio/setup обновить`)»; `/studio/idea` will show it to the owner:
   the player sees it. The code — per `python -X utf8 tools/code_check.py
   --only` after the baseline (all the lines, without cutting to 20), **no
   more than 5** `уборка:` lines in the "Bloated code" order below: the
   runner or the registry, the hottest one, while it keeps the list of
   checks (p. 4; «раннер находит проверки сам: новая проверка — свой файл;
   перенести одну подсистему, больше порога — несколькими файлами»;
   «Готово, когда» — a new check without a line in it) → a second copy in
   another language of the same process with a comparison (`*_matches_*`,
   Godot .NET: GDScript ↔ C#) — «уборка: <что> — вторая копия на <языке>:
   проверки поведения — на основную, сверка — на снятые хеши, вторую
   удалить (по частям)» → dead code — one line for the names of the
   «мёртвое:» notes («зовут только проверки» — do not take: the checks hold
   them; names already cleaned by a queue item — do not take) → one line
   per file over the threshold, the hot ones first (a hot one within the
   threshold — do not take) → types — one line per the product's folder from
   the «типы:» notes (not `tests/` and not a file that already has a goal in
   this list — otherwise `/studio/idea` will merge it with that goal), if
   room remains: it does not crowd out file lines; C# — `#nullable enable`
   as a line, only if the C# type check is visible (`TreatWarningsAsErrors`
   or the «типы» line for C#), otherwise it is a rule for new files, not an
   item. The rest is visible in `/studio/board` and `/studio/retro`; it does
   not go into the queue.
10. One documentary commit, the files by name, the note `Process:` /
    `Процесс:` (also for the `tools/` commit from p. 1): «Process: Adopt
    studio template v<N>» / «Процесс: шаблон studio v<N>», where <N> is the
    template's tag; `docs/BATCH.md` with the p. 9 findings — its own commit
    `Batch: Findings from the template update` / `Партия: находки
    /studio/setup обновить`; push if commits are pushed per `AGENTS.md`.
    Then the guard's self-check and a short report — `/studio/setup`, step
    12; the p. 9 findings — one line; the code — the line «Код: <`--summary`
    до « — »>; уборок в «Найдено по ходу»: N — встанут в очередь через
    /studio/idea» (the queue does not see them yet — do not write «0 уборок
    в очереди» from `--summary`).

## Bloated code — little by little

The owner's decision: cleanup next to the regular work, no more than two per
batch. **The baseline first, not rewriting** — with it the new is no worse,
the old does not grow, and the code stops bloating even before the first
cleanup. **Cleanup — on a signal**, not "tidy everything up": a finding above
the baseline; a finding in a file a queue item edits; the registry or the
runner — a wave's bottleneck (`scout`, a hot file); the third repetition of
one piece of knowledge; an item failed «не удалось: код». **A step — one
goal**: the behavior and the checks the same, its own commit; cleanup of a
shared hub — one per wave, in the first waves. **Order:** what unblocks
parallelism (registries, the runner, the root file) → copies that have
already diverged (that is a bug: the check first) → a second copy in another
language of the same process (in parts) → dead code → large files in parts,
each part — before the item that edits it (a part over the threshold — as
several files) → types (under ~150 untyped declarations — one cleanup; more
— by folders, a large folder — by files; when the folders are clean —
`untyped_declaration`, then `unsafe_*` by folders — «Здоровье кода» of
`docs/TESTING.md`). **Do not rewrite a system:** a part per item; the old
version is deleted by the item that replaced it.

## Reconsider the start

Do not rewrite the documents — show what changes:

1. Read `docs/DECISIONS.md`, `## Старт` (missing — assemble from DECISIONS,
   CONCEPT, and TESTING's «Окружение»).
2. The `multiSelect` dialog «Что пересматриваем в старте проекта?»: Стек /
   Образцы и вид / Замысел / Очередь.
3. Go through only the needed steps: the stack — `env.md` and round (g); the
   references — `refs.md`; the concept — rounds (a) and (b), there are
   «Этапы» — then `/studio/roadmap пересмотр`; the queue — `plan.md`, step 9.
4. `docs/SETUP-PLAN.md` — «было → станет» over the documents and what of
   the done will become stale (items, code, checks). The path and the dialog
   «Применить (Recommended) / Показать подробнее / Не сейчас».
5. «Применить» — point edits; each — as a line into `## Старт` with a date
   and «было: …». Reworking code — as queue items; the irreversible —
   `[ждёт «да»]`. The commit by name, the note `Process:` / `Процесс:`,
   delete the plan.
