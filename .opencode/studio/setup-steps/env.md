# Step 3 — checking the computer

Hardware, versions, and what is installed — facts: find out, do not ask, do
not take from memory. Report to the owner only what affects his decision.

## 1. Collect the facts

```
powershell -NoProfile -ExecutionPolicy Bypass -File ".opencode/studio/env_check.ps1"
```

Read-only, the output — JSON: OS, CPU, GPU and VRAM, RAM, monitor refresh
rate, power, disk space; git (`core.autocrlf`, git-lfs), python (Pillow),
dotnet, ffmpeg, Blender, gh, winget; the engines Godot, Unity, Unreal and
Godot export templates; for the installable ones — `winget_id`. «не удалось
определить» — not "no": search more (`where`, known folders) or give the owner
«Покажу, где лежит». The script is missing or failed — the same facts with
commands one at a time (`git --version`, `python --version` …), the
unrecognized — «не удалось определить».

## 2. What the chosen path needs

| Needed | When |
|---|---|
| git | always |
| python | always: the commit guard runs on it (must be in PATH) and `tools/` |
| Pillow | there are references or a world judged by eye (`tools/look_sheet.py`), or image orders (`tools/asset_check.py`) |
| engine | a game on an engine — the version round (g) will choose |
| git-lfs | 3D or a lot of audio, if the owner is not against LFS |
| gh | there is a remote GitHub repository — to learn its visibility |
| ffmpeg, Blender | only if the path requires them (frames from video, model editing; ffmpeg — also music or sound from generators: MP3 into the passport's format) |

The stack is not yet clear — the engine dialogs after round (g), the rest —
now.

## 3. What is missing — via a dialog

One question per program, up to 4 in a dialog: «<Программа> не найдена — она
нужна, чтобы <зачем словами продукта>. Поставить?» (header — the program's
name):

- «Поставить через winget (Recommended)» — description: id `<winget_id>`,
  size if known; the installation accepts the program's license;
- «Покажу, где лежит» — the owner names the path, verify with `--version`;
- «Пропустить» — what will not work then.

Only after a "yes", one program at a time, with a time limit of 600000 ms (or
in the background, waiting): `winget install --id <winget_id> -e
--accept-package-agreements --accept-source-agreements`; Windows may ask for
confirmation — that is expected. Timed out — run `env_check.ps1` again, do not
retry blind. Pillow — the same dialog, the options «Поставить
(Recommended)» / «Пропустить», the command `python -m pip install pillow`
(without it the scripts exit with code 2 and the line «нужна Pillow: …»). No
winget — a link to the official download page instead of the first option.

After installation — `env_check.ps1` again: a new program may be invisible to
this chat until a restart (PATH); it is also looked up in
`%LOCALAPPDATA%\Microsoft\WinGet\Links`; write the path in full. «Пропустить»
and a failure — as a line into «Окружение», do not hide.

## 4. The engine and its version

- The version — from the installed one's `--version`, not from memory.
  Several versions — recommend the newest stable one found in round (g).
- The version is newer than your knowledge (not sure you know its changes) —
  a subagent with web search, in the background, assembles
  `docs/engine-notes.md` from the official changelog: what changed in API,
  settings, and import compared to the version you know, with links; the
  result ≤ 15 lines. The executor reads the file before working.
- The same reason, or a stack you barely know — the question (header
  «Context7»): «<Движок или библиотека> <версия> новее того, что я знаю.
  Подключить Context7 — документацию ровно этой версии?»: «Подключу сам
  (Recommended)» — in the app this is **a connector, not a plugin**: Customize
  → Connectors → search «Context7» → Connect (there is a tool that shows
  connectors — show the button with it), then a new chat; the executor checks
  an unfamiliar API against this version / «Не нужно» — `docs/engine-notes.md`
  and the official site will do. Only the owner connects it. Whether it is
  there — this chat has the `resolve-library-id` and `query-docs` tools (the
  connector's server name is digits and letters) or with `context7` in the
  name; connected but not visible — «проверить в следующем чате».
- Godot: the export templates in
  `%APPDATA%\Godot\export_templates\<версия>` must match the engine version
  exactly. Missing or wrong — a line into «Окружение» and «Ловушки стека»;
  install — when it reaches the build.

## 5. The repository

- There are `gh` and a remote repository — `gh repo view --json visibility`;
  there is a remote but no `gh` — the question of round (d). Public — other
  people's frames into `.gitignore`, in the passport a link to the source
  (`plan.md`, files).
- No remote — do not ask: into `INDEX.md` the line «Репозиторий: только на
  этом компьютере — образцы в git; публикуя на GitHub, выберите «Private»
  или скажите, чтобы `ref-*` ушли в `.gitignore`».
- `core.autocrlf=true` — `.gitattributes` is mandatory (step 8).

## Result

Before step 8 — into `docs/SETUP-PLAN.md`; at step 8 — `## Окружение` in
`docs/TESTING.md` (a table of tools and versions, the engine path, what was
installed and when: date, «через winget» / «указал владелец»), the engine path
— as one line in `AGENTS.md`, «Стек»; Context7 — yes / no / not needed. The
GPU, RAM, and monitor refresh rate — for the stack recommendation (round (g))
and budgets (`3d.md`); for a game the machine's fingerprint (CPU and cores,
GPU and VRAM, driver, OS, screen and refresh rate, power) — as a line into
«Машины замера» of «Бюджет производительности» in `docs/TESTING.md`, the
coefficients — from `tools/perf_ref.json` with the note «оценка»; a machine
not in the table — a row from PassMark with a URL and date, «оценка» (the
table's `match_rule`).
