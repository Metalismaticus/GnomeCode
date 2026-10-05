# Steps 7, 8, 9, and 11 — plan, files, Stage 1, journal

## Step 7. Recap

`docs/SETUP-PLAN.md` — temporary, do not commit. Short, by sections:

- **Как понял** — one line each plus the core; every line marked «сказали вы»
  (with a quote) or «предположил я [допущение]».
- **Образцы** — themes with paths to passports and sheets, the main
  reference, the stylization scale.
- **Окружение** — what is installed, what was set up, what is missing, and
  what that threatens.
- **Как проверяем** — 5–7 lines per `testing.md`; whether items can be done
  simultaneously; for a game — goals for players (round (d)).
- **Этап 1 «Первое играбельное»** — what the player will see and the first
  5 items with «Как увидеть»; the concept's other systems — «Потом» `[допущение]`.
- **Файлы** — what will be created, what existing stays untouched; order
  kinds and executors; the language of commits, README, and the About text.
- **Открытые решения** — what goes into «Решения» of `BLOCKED.md`.
- **Журнал** — lines for `## Старт` (step 11).

To the chat — the path and 3–5 lines of essence, then the dialog «Принять
(Recommended) / Поправить понимание / Поправить очередь / Ещё поговорить».
«Поправить …» — listen, amend the plan, ask again; «Ещё поговорить» —
rounds of dialogs about whatever the owner names.

A detailed start, or more than 7 systems in the concept — after «Принять»
the dialog «Разложить весь замысел на этапы сейчас (`/studio/roadmap`)?» —
`Сейчас (Recommended)` / `Позже`: «сейчас» — `/studio/roadmap` in this chat
after step 12, «позже» — a line in the report.

## Step 8. Files

| File | When |
|---|---|
| `AGENTS.md` | always; `{{ВЕТКА}}`, `{{_И_PUSH}}` — from the answers; the engine path — a line in «Стек»; «Git» — push, the commit and README language from round (d), About — per `.opencode/studio/reference/COMMITS.md` |
| `README.md`, `README.ru.md` | always, per the «README:» line — from the `README.md` and `README.ru.md` templates; a single `en` or `ru` — only `README.md` in that language (GitHub shows it), without the cross-link line; own README already exists — do not rewrite: `update.md`, step 7 |
| `docs/CONCEPT.md`, `ROADMAP.md`, `BUGS.md`, `BLOCKED.md`, `DECISIONS.md`, `TESTING.md`, `BATCH.md`; `tools/roadmap_check.py` | always |
| `docs/DESIGN.md` | the product has an interface |
| `docs/refs/INDEX.md`, passports | from step 4; no references, but the world is judged by eye — a single `INDEX.md` |
| `docs/engine-notes.md` | engine version newer than knowledge (step 3) |
| `docs/orders/art.md`, `music.md`, `sfx.md`, `design.md`, `model3d.md`, `texture.md` | only the needed kinds; 3D — `model3d`, `texture` |
| `docs/orders/<вид>.md` from `_kind.md` | other named kinds: texts, localization, a store page |
| `docs/orders/ledger.md` | there are order kinds or it is a game: the asset-origin journal for `/studio/release` |
| `docs/prompts/`, `docs/specs/` | empty folders with `.gitkeep` |
| `tools/look_sheet.py`, `tools/refs_check.py` | there is `docs/refs/` |
| `docs/refs/TECHNIQUES.md` | there is `docs/refs/` and the world is judged by eye: «Свои приёмы» next to the plugin's library |
| `tools/model_check.py` | 3D: there is `model3d` or `.glb`/`.gltf` models |
| `tools/perf_ref.json` | a real-time world (game, stand, viewer): the hardware table for «Бюджет производительности» and auto-picking «Настройки графики» |
| `tools/order_api.py` | the `api` executor is enabled |
| `tools/asset_check.py` | there are image or sound orders (`art`, `sfx`, `music`, `texture`) or it is a game: the sound of `[ощущение]` variants |
| `tools/code_check.py`, `tools/code_baseline.json` | there is code (almost always); the baseline is written by `python -X utf8 tools/code_check.py --baseline` in step 12 — after the repository is created, before the first commit |
| `tools/load_all.gd` | Godot: loads every script — type errors visible without launching the game |
| `.gitignore` | missing — under the stack: the engine cache (`.godot/` …), the builds folder from «Выпуск»; a public repository — also `docs/refs/**/ref-*` and, by name, the owner's screenshots from other games |
| `.gitattributes` | missing — `* text=auto eol=lf`; the stack's binary types `binary` (`*.png binary` …); there is git-lfs and the owner is not against — into LFS go glb, fbx, blend, psd, wav, ogg, the `docs/refs/**/sheet-*.png` sheets, and png over 1 MB — by name. The owner has `core.autocrlf=true`: without the file, diff is noisy |

Filling rules:

- **`AGENTS.md` — short:** loaded into every chat. «Правила проекта» — 3–7
  from the stack, platforms, and constraints (for 3D — `3d.md`); in an
  existing project — from what the code already follows.
- **Style** in `docs/orders/*.md` and `docs/DESIGN.md` — from the owner's
  answers, the passports (the main reference, the stylization scale), and
  finished assets (the palette — from code and files, with paths). Not said —
  do not invent: `?? нужно подтверждение: …` and the question into «Решения»
  (with an empty style `/studio/order` will not assemble an order).
- **`CONCEPT.md`, «Что работает»** — empty in a new project; in an existing
  one — only what is proven by code.
- **`CONCEPT.md`, «Архитектура»** — the template skeleton under the stack,
  4–6 lines (layers, where a new system goes, where content lives, services),
  without empty `{{…}}`. One place — a module or a folder, not "all X in one
  file". In an existing project — only what the code already follows
  (`existing.md`).
- **`TESTING.md`** — per `testing.md`; `## Окружение` — per `env.md`.
- **README** — the blocks per `.opencode/studio/reference/COMMITS.md` from
  the created documents: in the player's words; «Что уже умеет» in a new
  project — «пока ничего»; no screenshots and no release — empty blocks.
- **Quick start:** `CONCEPT.md` — a one-page brief: pitch, the core loop,
  the goal and the failure, what is not done; «Первая версия» and «Порядок
  сборки» — links to «Этапы» of `ROADMAP.md`. The other documents — as stubs,
  without questioning: the unknown — `?? нужно подтверждение: …`, not made
  up.

## Step 9. Stage 1 — vertical slice

Not by layers ("first all systems, then graphics"), but so that the owner
sees the game from the first item. The slice — **«Этап 1. Первое
играбельное»** in «Этапы» of `ROADMAP.md` per the template format, `идёт`,
size as an estimate: «Что увидит игрок» — 3–5 steps of the core loop (round
(b)); «Главный риск» — what the stack probe is for (none — `нет`); «Закрыт,
когда» — the owner played through «Что увидит игрок» and said «да»;
measurements — from the stack probe. Queue items — with `[этап 1]`, all
`[можно]` unless told otherwise:

0. **Проба стека** — before everything, if the core is constrained by
   performance: one measurement on the owner's hardware that decides
   whether the stack is fit («N участков мира в поле зрения держат бюджет
   рекомендуемых, пересчитанный на эту машину», «Бюджет производительности»);
   the measurement item — per «Как мерить» (pre-check; busy — the number with
   a note, no dialog).
1. **Каркас и быстрая проверка** `[код]` — the product launches; a quick run
   with one command, an honest verdict. After step 10, mark the skeleton
   piece «сделан `/studio/setup`»; the window did not launch — the reason as
   the first piece.
2. **Построить проверки продукта** `[код]` (`testing.md`); the world is
   judged by eye — **Стенд вида** `[код]` next.
3. **Серая коробка** `[код]` — scale (a 1.8 m capsule, a 1 m cube), camera,
   controls, one core verb — with a scenario through input that goes red if
   the controls are broken; on a key (F3) the game shows seed, coordinates,
   and the camera's direction and copies them in one line — that is how the
   owner names a place; for 3D — a budget measurement.
   The owner named a controls reference ("jumps like in X") — immediately
   after: **«<Главный глагол> ощущается как в <образец>»** `[ощущение]`:
   `Образец:` — the theme's passport (kind of work `ощущение`); not confirmed
   — `[ждёт образца]`. The box's platform is then built per the "feel" part
   of the `## Стенд` section (steps and boxes of known height, an edge, a
   passage, a wall, meters on the floor): the item's first step keeps keys
   1–4, the variant label, and the `_проба` presets.
4. **Первый кадр по образцу** `[вид]` — one frame is brought to the main
   reference. Passport not `подтверждён владельцем` — `[ждёт образца]`. A 3D
   world — **Настройки графики** (`3d.md`) next.
5. **Один полный цикл** `[код]` — «начало → испытание → итог», 3–5 minutes
   long.

Details («Дальше» of `ROADMAP.md`) — only for Stage 1 items, per the
template format: «Слова владельца» verbatim (for process items — `нет —
/studio/setup`); `Как увидеть:` — where in the game and what must be
visible; for `[вид]` and `[ощущение]` — `Образец: docs/refs/<тема>.md`;
«Готово, когда» for items about controls and player actions — by player
steps (the scenario text). An owner answer needed — `[ждёт …]`. Existing
project — `existing.md`.

The concept's remaining systems — as rows of «Покрытие замысла» with the
stage «Потом» and the `[допущение]` note after the quote in «Слова владельца»,
without questions; those in the slice — stage `1` and the state `в работе`;
«Чего не делаем» — `Не делаем`. Every filled section of the brief (except
«Первая версия» and «Порядок сборки») — in at least one «Раздел замысла»
cell; a section without its own system («Одной строкой», «Вид», «Цель и
провал») — comma-joined to the one it belongs to: `Ядро, Одной строкой`.
Then `python -X utf8 tools/roadmap_check.py`: fix the findings before the
commit.

## Step 11. Start journal

`docs/DECISIONS.md`, `## Старт` — one line per decision and assumption:
`- <дата>: <что> — сказали вы: «…»` or `— допущение: <почему так>`. The stack
choice — with the rejected variant and the reason. Into «Как ведётся
работа» — «<дата>: Этап 1 собран `/studio/setup`, остальное — «Потом»,
покрытие X/Y». Verify: all the plan's «Журнал» lines and the step 10 result
(the window launched, or why not) — in place.
