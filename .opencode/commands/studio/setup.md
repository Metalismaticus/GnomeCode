---
description: Развернуть в папке проекта процесс studio — узнать замысел окнами, проверить компьютер и поставить недостающие программы после «да», разобрать образцы владельца в docs/refs/, создать AGENTS.md, docs/ и README (English и русский), поставить Этап 1 вертикальным срезом, для игры на движке — создать каркас и показать живое окно игры. Работает в пустой папке и в проекте с кодом; /studio/setup обновить переносит в развёрнутый проект новый шаблон процесса. Звать по команде /studio/setup.
agent: studio
---

What we are setting up: **$ARGUMENTS**

(If the line above is empty or left unsubstituted — take it from the owner's
message; not there either — start from step 1. «Обновить» —
`.opencode/studio/setup-steps/update.md`.)

Everything needed is in the studio plugin folder (in the project root):

- `.opencode/studio/setup-steps/<шаг>.md` — the step's details. **Read the step
  file upon reaching it**, not act from memory; after a context squeeze — reread.
- `.opencode/studio/templates/` — document templates and `tools/`. `{{…}}` — a
  place for content: a finished document keeps not a single `{{`.
- `.opencode/studio/reference/ASKING.md` — how to ask; `.opencode/studio/reference/COMMITS.md` —
  commits, README, and About; `.opencode/studio/env_check.ps1` — the computer
  check; `.opencode/studio/hooks/selftest.py` — the guard's self-test.

## Key points

- Questions — via dialogs per `ASKING.md`, only about the owner's decisions.
  Hardware, versions, what is installed, where the engine is — **facts**: find
  out via `env_check.ps1`, do not ask and do not take from memory. Something
  said with a hedge («наверное») — the `[предварительно]` tag, not an owner
  decision.
- **Show, do not describe.** The owner's references (games, screenshots, links)
  are analyzed by the `reference` agent in `docs/refs/` before the questions;
  an image — by the file path, then the dialog.
- **Install programs only after a "yes"** — one question per program.
- **Do not overwrite anything existing** (except the process sections in
  «обновить» after consent). Before «Принять» at step 7, only
  `docs/SETUP-PLAN.md`, `docs/refs/`, `docs/engine-notes.md`, and `tools/` from
  the templates are written.
- **Do not write product code — and setup follows the role of the chat it
  runs in.** The concept chat never builds the skeleton and never opens
  the product, not even during setup: its setup is steps 1–9 (questions,
  env check, documents, references, the queue) plus their document
  commit; then stop — "steps 10–12 (the scaffold and the live window) —
  in the dev chat: run `/studio/setup` there" (the plan waits in
  `docs/SETUP-PLAN.md`; the next setup resumes from the first unfinished
  step). The dev chat runs every step, including step 10: the project
  scaffold (infrastructure, not features) and the window — announce it in
  one line **before** starting. Beyond that, code — only through the
  queue.
- **Setup log:** every decision and assumption — as a row (before step 8 — in
  `docs/SETUP-PLAN.md`, then in `docs/DECISIONS.md`, `## Старт`). A repeat
  `/studio/setup` reads the log and shows what changes, it does not rewrite the
  documents.
- **Git** — files by name, never `git add -A` or `git add .`; push — only if
  the owner said so, and to the repository he named. Commit messages — per
  `COMMITS.md`, the `Process:` / `Процесс:` marker.
- Reports and questions — in product words.

## 0. Where we are

| What is in the folder (top to bottom) | Mode |
|---|---|
| has `docs/SETUP-PLAN.md` | **interrupted setup** — read the plan and `docs/refs/`, continue from the first undone step: by the plan's log and the files (`{{` in the documents — step 8; no queue — 9; no `docs/refs/setup/first-frame.png` and no «Первый запуск окна» row — 10; no commit — 12). A «было → станет» plan — an interrupted revision, `.opencode/studio/setup-steps/update.md` |
| has `docs/ROADMAP.md` | **deployed** — `.opencode/studio/setup-steps/update.md` |
| has code | **existing** — first `.opencode/studio/setup-steps/existing.md`, then steps 1–12 with its adjustments |
| empty or notes only | **new project** — steps 1–12 |

An own `AGENTS.md` without the studio marker — do not replace: the dialog
«Вставить разделы процесса (Recommended) / Показать разницу / Не трогать», the
difference — into a temporary file outside the project.

## Steps

1. **A dialog of two questions** — `.opencode/studio/setup-steps/talk.md`:
   «Где вы сейчас?» (Идеи нет / Идея смутная / Идея ясная / Уже есть наработки)
   and «Как стартуем?» (Быстрый старт (Recommended) / Подробно).
2. **One request as text**, not a dialog: «Расскажите своими словами и
   принесите всё, что есть: игры, на которые похоже, скрины (можно вставить в
   чат), ссылки, заметки». The answer — verbatim into `docs/SETUP-PLAN.md`.
3. **Computer check** — `.opencode/studio/setup-steps/env.md`:
   `env_check.ps1`; what is missing for the chosen path — the dialog «Поставить
   через winget (Recommended) / Покажу, где лежит / Пропустить». The engine
   version — from what is installed; newer than your knowledge or an unfamiliar
   stack — `docs/engine-notes.md` and a dialog about Context7 (a connector; the
   owner connects it). The result — `## Окружение` in `docs/TESTING.md`, the
   engine path — as a row in `AGENTS.md`; for a game, the machine fingerprint —
   in the «Машины замера» of the «Бюджет производительности» there too.
4. **Analysis before questions** — `.opencode/studio/setup-steps/refs.md`: for
   every named reference (≤ 3) the `reference` agent, in parallel, and one
   shared investigator of the genre's and this engine version's traps — in the
   background, while rounds (a) and (b) run.
5. **Dialog rounds** — `.opencode/studio/setup-steps/talk.md`: (a) genre,
   camera, platforms, size; (b) the 30-second loop; (c) references; (d) the
   stack and the players' computers (game); (e) orders, parallelism, and git —
   the commit language, README, privacy. A dialog has ≤ 4 questions; quick
   start — ≤ 4 rounds, detailed — ≤ 7. After (d) — engine installation,
   `.opencode/studio/setup-steps/env.md` p. 3–4.
6. **3D** — `.opencode/studio/setup-steps/3d.md`: the «Правила проекта» for
   scale, axes, and import; the order kinds `model3d` (glTF `.glb`, meters, Y
   up, the pivot at the bottom center, «вперёд» +Z; checking what arrives —
   `tools/model_check.py`), `texture`; the «Настройки графики» item.
7. **Recap** — `.opencode/studio/setup-steps/plan.md` (think the checks through
   before it — `.opencode/studio/setup-steps/testing.md`):
   `docs/SETUP-PLAN.md`, the path for the owner, the dialog «Принять
   (Recommended) / Поправить понимание / Поправить очередь / Ещё поговорить».
   Anything but «Принять» — adjust and ask again. A detailed start or more than
   7 systems — then a dialog about `/studio/roadmap`.
8. **Files** — `.opencode/studio/setup-steps/plan.md`: documents from
   templates, `docs/refs/` (the world is judged by eye — so also
   `docs/refs/TECHNIQUES.md`, «Свои приёмы» toward the
   `.opencode/studio/reference/LOOK_TECHNIQUES.md` library), `.gitattributes`,
   `.gitignore`, README per round (d)'s answer, «Git» in `AGENTS.md`; for a
   game — `tools/perf_ref.json`, «Бюджет производительности» and «Как
   открывается окно» in `docs/TESTING.md`
   (`.opencode/studio/setup-steps/testing.md`); code exists —
   `tools/code_check.py` (for Godot also `tools/load_all.gd`); quick start — a
   one-page brief in `CONCEPT.md`, the rest as stubs.
9. **Stage 1 — the vertical slice** — `.opencode/studio/setup-steps/plan.md`:
   «Этап 1. Первое играбельное», the `[этап 1]` items from the stack and
   scaffold trial through the grey box and the first frame per the reference to
   a full 3–5 minute loop; the other systems — «Покрытие замысла», «Потом».
10. **Scaffold and a live window** — `.opencode/studio/setup-steps/finale.md`:
    the engine project with its own tools, types at the "error" level, a
    window launch, the screenshot `docs/refs/setup/first-frame.png`, the dialog
    «Видите окно игры?».
11. **Setup log** — `.opencode/studio/setup-steps/plan.md`:
    `docs/DECISIONS.md`, `## Старт` — every decision and assumption of the plan
    and the outcome of step 10, one row each.
12. **Commit, guard, report** — below.

## 12. Commit, guard, report

No repository — create one on the `main` branch without a dialog, with the
«Решено за вас» row: without history, checkpoint commits and the `/studio/done`
revert do not work. `tools/code_check.py` exists but the baseline does not —
after the repository (without git there is nothing to measure with: code 2) and
before the commit, `python -X utf8 tools/code_check.py --baseline`: the
baseline is the current code, `tools/code_baseline.json` — into the commit;
then the timing measurement of the «здоровье кода» row — into the «Команды
проверки» of `docs/TESTING.md`. The background collection of
`docs/engine-notes.md` (step 3) — wait for it before the commit. The first
commit — files **by name**, the `Process:` / `Процесс:` marker ("Process: Set
up the studio workflow and the Stage 1 queue" / «Процесс: развёрнут процесс
studio и очередь Этапа 1»); in an existing project — only what `/studio/setup`
created. Do not commit `docs/SETUP-PLAN.md`: delete it after the commit, its
content is already in the documents. Push — only by the owner's word.

Hooks self-test: `python -X utf8 ".opencode/studio/hooks/selftest.py"`, only the
result into the context. Code 0 — «страж коммитов: работает». The result says
«хуки НЕ работают» or there is no `python` — «страж коммитов: молчит» and the
first line of the failure: in a two-chat folder nothing will stop `git add -A`
and `git stash`; «проверка карты НЕ работает» and «проверка кода НЕ работает» —
as a row into the report («проверка кода сломана: <что неверно>»).

Report:

- what was created and what was deliberately left untouched;
- the environment: what is installed, what was installed now, what is missing,
  and what will not work without it;
- what was launched: the game window and the screenshot path — or straight up
  «не запустилось: <почему>, <что дальше>»;
- how the product is checked now and what already works today;
- the row «страж коммитов: работает | молчит»;
- there is a remote repository on GitHub — two About lines (Description and
  Topics) per the "About" section of `COMMITS.md`, from the «Git» section of
  `AGENTS.md`; the plugin itself changes nothing on GitHub;
- open decisions — as a list, as in `/studio/need`;
- how to work next: **two chats in this folder** — name them «<Проект> ·
  замысел» (`/studio/idea`, `/studio/roadmap`, `/studio/fault`,
  `/studio/order`, `/studio/need`) and «<Проект> · разработка»
  (`/studio/start`, `/studio/done`, `/studio/add`, `/studio/check`,
  `/studio/parallel`, `/studio/retro`, `/studio/release`); `/studio/board` —
  in either. First step: in the dev chat `/studio/start` — it will take
  Stage 1's first item. The step 7 dialog about `/studio/roadmap`: «сейчас» —
  it happens right here after the report, «позже» — the row «весь замысел на
  этапы — `/studio/roadmap`».
