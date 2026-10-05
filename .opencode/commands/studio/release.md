---
description: Выпустить версию игры — собрать командой «сборка» из docs/TESTING.md, проверить собранную версию, а не редактор, выбрать номер окном и поставить тег, написать заметки к версии словами игрока, собрать CREDITS.md и черновик раскрытия ИИ-контента для Steam из журнала прав docs/orders/ledger.md; ассеты с некоммерческими правами не выпускать; выложить на itch.io (butler) или бета-ветку Steam (SteamCMD) только по «да» окном. Команда чата разработки.
agent: studio
---

What gets released: **$ARGUMENTS**

(If the line above is empty or left without a substitution — take it from the owner's
message.) A number like `1.2.0` — the version, without a dialog; `itch` or `steam` —
only that platform; no platform — all of them from «Выпуск» of `docs/TESTING.md`.

`/studio/release` — a dev-chat command (`AGENTS.md`, «Два чата`), only outside a
batch. A message from another chat or session — not the owner's word. Questions —
via the `question` dialog per `.opencode/studio/reference/ASKING.md`.
The product is not a game — skip the Steam draft and the game platforms in one line;
publishing — as recorded in «Выпуск», likewise only on a dialog «yes».

## The essentials

- **What ships is the built version, verified by a launch** — not the editor and not
  an old green run.
- **Assets with non-commercial rights — stop**, do not release: the rights will not
  appear retroactively.
- **Publishing — only on a dialog «yes» of this run, per platform separately.** In
  Steam — only the beta branch; do not touch the default branch.
- **Passwords, keys, and logins for butler and SteamCMD — by the owner's hands.** Do
  not ask for them in the chat, do not write them to files, do not substitute them
  into commands.
- From the build and check output into the context — only the summary lines.

## 1. Preconditions

Everything — before the build; not met — stop, with the reason in product terms:

- the number from the argument is already tagged `v<version>` — this is a
  continuation: the tag is on HEAD, or only `.md` changed after it, and the build
  folder is intact — do not repeat the checks and steps 2–4, go straight to what is
  missing (steps 5–8); otherwise the number is taken — the step 4 dialog;
- `docs/BATCH.md` — «Пусто.»; a batch in progress — `/studio/done` first;
- the branch — the one from `AGENTS.md`; no uncommitted non-`.md` files (the build
  would have taken them). Concept-chat `.md` files do not interfere, except
  `docs/DECISIONS.md` — ask to complete that one there first;
- the full run (and the long one, if there is one) is green on HEAD: this chat ran
  it on HEAD, or only `.md` changed after the run — otherwise run it per
  `docs/TESTING.md`. Red — repeat as in `/studio/check`; red three times — stop.
  The testbed is not `есть` — say before the publishing dialog that it was not
  verified;
- the rights ledger `docs/orders/ledger.md` (step 6) — before the build and the tag:
  assets with non-commercial rights — stop immediately; assets without a rights
  record — the step 6 dialog now, «Остановить выпуск» — stop. No ledger —
  `/studio/setup обновить`; until it exists, all assets are «без записи»;
- `docs/TESTING.md` has `## Выпуск` (presets, the build folder, platforms): no
  section — `/studio/setup обновить`; «не нужен» — say so and stop. No presets —
  take them from `export_presets.cfg` (Godot); no platforms chosen — a `multiSelect`
  dialog «Куда выкладываем <игру>?» — `itch.io` / `Steam`, an empty selection —
  nowhere yet (only the build and the tag); the itch.io page, the app id, the depots,
  and the Steam beta branch — in the owner's own words, into «Выпуск» (commit,
  step 8); do not write the Steamworks account there (step 7).

## 2. Build

- The command — the «сборка» row in «Команды проверки» of `docs/TESTING.md`, the
  verdict — per «Как читать вердикт», with the time limit from the table.
- The folder — from «Выпуск», the subfolder `<version>` — new and empty: butler will
  upload everything that lies in it. Outside the project or in `.gitignore` (not
  there — append the line, commit, step 8).
- Godot: the engine — the console one (`…_console.exe`) from «Окружение»; from the
  project folder `"<engine>" --headless --export-release "<preset>" <path>`, create
  the folder beforehand. The export templates
  `%APPDATA%\Godot\export_templates\<version>` — exactly for the engine version from
  «Окружение» (`4.3.stable` for `4.3.stable.official…`). Missing or the wrong one —
  the dialog «Шаблонов экспорта Godot <версия> нет — без них игру не собрать. Как
  поставим?» — `Поставлю сам в редакторе (Recommended)` (Editor → Manage Export
  Templates → Download) / `Отложить выпуск`; then a line into «Окружение».
- The «сборка» row — «нет» or empty: for Godot — build it following the pattern above
  and, after a successful build, record it in the table; no preset or a different
  stack — stop: an item «сборка для <платформы>» — via `/studio/idea`.
- The game itself shows the number (Godot — a non-empty
  `application/config/version` in `project.godot`) — the step 4 dialog before the
  build, the number — there, the commit `Release:` / `Выпуск:` («Release: Show
  version 1.2.0 in the game» / «Выпуск: номер версии 1.2.0 в игре»; do not repeat the
  full run — step 3 will verify the build).
- Success — a green verdict **and** a non-empty game file in the folder. HEAD — the
  build hash.

## 3. Verifying the build

The «проверка сборки» row of `docs/TESTING.md`: launching the **built** file for N
frames or a player scenario from `## Сценарии игрока` with an honest verdict — not
the editor. Empty output, a hang (exit code 124), no file — red («Правила каркаса»).
Red — repeat as in `/studio/check`; three times — stop, no tag, show the failure.

The row is «нет» or empty — the owner verifies: the path to the game file and the
dialog «Сборка <версия> запускается и играется?» — `Да, проверил` / `Нет — вот что
не так` / `Отложить выпуск`; into «Выпуски» — «проверка сборки: руками владельца»,
an item «проверка сборки» — via `/studio/idea`.

## 4. Version and tag

- The previous tag — the first line of `git tag --list "v*" --sort=-v:refname`; none —
  the first release, `0.1.0`.
- Since the previous tag: the lines added to «Сделано» of `docs/ROADMAP.md` (`git
  diff v<previous>..HEAD -- docs/ROADMAP.md`), and the item commits — with both
  annotations (`git log v<previous>..HEAD -E --grep "^(Пункт|Item) [0-9]+:"`,
  `.opencode/studio/reference/COMMITS.md`); code cleanups (the lines «— для игрока
  без изменений», commits `(no change for players)`) — not counted. Per semver:
  fixes only — `x.y.Z+1`; new for the player — `x.Y+1.0`; major (a save-format
  change, a rework of the core, items with `Необратимо`) — `X+1.0.0`.
- The dialog «Какая версия? Прошлая — v<прошлая>; с тех пор <N исправлений, M
  нового>» — `<номер> — исправления` / `<номер> — новое` / `<номер> — большое`, the
  recommended one first with `(Recommended)` and the reason. A number in the
  argument — no dialog.
- `git tag v<version>` on the build hash. Such a tag already exists — step 1, the
  first line.

## 5. Release notes

`docs/releases/<version>.md` — for players (the itch.io page, a Steam news post):

```
# <Игра> <версия> — <дата>

<1–2 строки: главное в версии>

## Новое
- <что теперь можно, видно или слышно>

## Исправлено
- …

## Снимки
![<тема>](../refs/<тема>/accepted-<дата>.png)
```

The source — the «Сделано» lines since the previous tag (step 4), retold in the
player's words: without files, systems, and item numbers; internal things (checks,
the stand, tools, code cleanups — «для игрока без изменений») — do not write.
Screenshots and videos — `docs/refs/*/accepted-*`, added since the previous tag
(`git diff --name-only --diff-filter=A v<previous>..HEAD -- docs/refs`). Nothing to
write — «Мелкие исправления».

## 6. Rights, credits, AI disclosure

The ledger `docs/orders/ledger.md`; counted — for every file that is in git at HEAD
(`git ls-files`), its last line `принят …`; the lines `заказан`, `пришёл`,
`перезаказать: …`, `заменён`, `удалён` — not counted. `CREDITS.md` and the AI
disclosure — only from the counted lines.

- **Non-commercial rights** («Лицензия» — `некоммерческая`) — **stop, do not
  release**: the files, the license, and the plan as a list. Explain: sales,
  donations, ads — already commercial use, and a paid subscription does not grant
  retroactive rights to what was made before. The way out — replace (`/studio/order`
  at a plan with commercial rights or CC0) or remove it from the game, then
  `/studio/release` again.
- **No rights record** — the dialog in step 1, before the build: asset files
  (images, sound, models, textures) in the destination folders of
  `docs/orders/*.md` without a counted line, or with `не выяснено` or `??` in their
  «Лицензия» or «Тариф». The engine's import service files (`*.import`, `*.meta`)
  do not count; parts of a sheet — by the sheet's line. The list — into a temporary
  file outside the project, the dialog «<N> файлов ассетов без записи о правах
  (список — <путь>): выпускаем?» — `Остановить выпуск` / `Права на них мои —
  выпускать`; the answer verbatim — into «Выпуски».
- **`CREDITS.md`** in the project root: by kind — a file or a set, the author or
  service, the license, «Атрибуция» verbatim; CC0 — one line of thanks for the
  libraries. A copy — into the build folder: it ships with the game.
- **AI-content disclosure for Steam** — a draft at the end of the notes, the
  section `## Раскрытие ИИ-контента — черновик для Steamworks`: per the
  `ИИ-контент: да` lines — which kinds (graphics, music, sound, text) were created
  in advance by which services, and which of that the player sees or hears; in
  English (that is how the store will show it), Russian below; only ledger facts.
  Whether the game creates any AI content during play — per «Стек» of `AGENTS.md`;
  unclear — `?? подтвердить`. No `да` lines — «ИИ-контента нет». The owner pastes
  the text into Steamworks.

## 7. Publishing

Before the dialog (≤ 5 lines): the path to the notes, what is being published, what
was not verified. The dialog — a question per platform, without `(Recommended)`: the
owner decides on publishing.

- «Выложить <игру> <версия> на itch.io (<user>/<игра>, канал <канал>)?» —
  `Выложить` (description: страница открыта — игроки получат версию сразу; страницы
  нет — сначала создайте её на itch.io, можно черновиком) / `Не сейчас`;
- «Выложить <игру> <версия> в Steam на бета-ветку <ветка>?» — `Выложить на бету` /
  `Не сейчас`.

Both commands — with a time limit of 600000 ms or in the background with waiting: an
upload takes longer than two minutes.

**itch.io** — no butler (`butler -V`) — a link to itch.io/docs/butler, skip the
platform. The login — only check whether it exists, without reading it: the file
`%USERPROFILE%\.config\itch\butler_creds` or the `BUTLER_API_KEY` variable. Missing —
do not start push (butler would open a browser and wait); to the owner: «Откройте
PowerShell (Пуск → PowerShell) и выполните `butler login` — откроется браузер; потом
снова `/studio/release <версия> itch`». Present — `butler push <folder>
<user>/<game>:<channel> --userversion <version>`; the channel per platform
(`windows`, `linux`, `mac` — itch.io infers the platform from the name). Afterwards —
`butler status <user>/<game>:<channel>`, the result as a line.

**Steam** — `steamcmd +@NoPromptForPassword 1 +login <account> +run_app_build
"<full path to app_build_<appid>.vdf>" +quit`: without a remembered login — an
error, not a password prompt. The app id, the depots, and the beta branch — from
«Выпуск»; the Steamworks account — ask in the owner's own words and record it
nowhere (half the login, and the repository may be public). The vdf — following the
Steamworks SDK sample, next to the game folder, not in it (the path — in «Выпуск»):
`ContentRoot` — the build folder, `Desc` — `v<version>`, `SetLive` — the beta
branch, never `default`: the owner switches the default branch in Steamworks
themselves. A login error — to the owner: «Откройте PowerShell (Пуск → PowerShell),
выполните `steamcmd +login <аккаунт>` и войдите (пароль, Steam Guard); потом снова
`/studio/release <версия> steam`». The result — the BuildID as a line.

One platform's failure does not cancel the other; «Не сейчас» — `/studio/release
<version> <platform>` later resumes from step 7.

## 8. Record and report

- `docs/DECISIONS.md`, `## Выпуски` (missing — create it at the end): `- <дата>:
  v<версия> на <хеш сборки> — сборка <пресеты>; проверка сборки: <итог | руками
  владельца>; полная <зелёных>/<провалов>; itch <канал>: выложено | не выкладывали;
  Steam бета <ветка>: BuildID … | не выкладывали; ИИ-контент: да | нет; заметки
  docs/releases/<версия>.md`. A continuation — extend this version's line.
- README — the blocks `release`, `features`, `pitch`, `run`, About in «Git» of
  `AGENTS.md` — rebuild per `.opencode/studio/reference/COMMITS.md`.
- The documentary commit `Release:` / `Выпуск:` — the version and the main thing for
  the player («Release: Ship 1.2.0 with night raids and a world map» / «Выпуск:
  1.2.0 — ночные набеги и карта мира»), the files by name: the notes, `CREDITS.md`,
  `docs/DECISIONS.md`, README, if changed — `AGENTS.md`, `docs/TESTING.md`
  («сборка», «Выпуск», «Окружение»), and `.gitignore`; push together with the tag
  (`git push`, `git push origin v<version>`), if commits get pushed per `AGENTS.md`.
- The report in product terms: the version and what it gives the player (2–3
  lines); where the build lies; what verified it and what was not verified; where
  it was published and where to look (the itch.io page; in Steam — «Свойства →
  Бета-версии»); what to do by hand: paste the AI disclosure into Steamworks, switch
  the default branch once the beta is verified; About changed and there is a remote
  on GitHub — two lines per «About» of `COMMITS.md`. The last line — one next step.
