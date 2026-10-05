# Step 10 — skeleton and a live window

This step runs **only in the dev chat**: the concept chat's setup stops
before it — the plan is carried by `docs/SETUP-PLAN.md` (see `setup.md`,
"Главное"/the essentials).

At the end of `/studio/setup` the owner sees their game's window — grey as
it may be. This is infrastructure, not product code: no mechanics, only a
scene for scale. Code after this — only through the queue.

No engine (installation skipped) — skip the step and say why in the report.
A stack without a window, or web — the skeleton by the stack's generator
(`npm create …`, `dotnet new …`); launch the way the user sees it; the
screenshot in the same manner.

Types for any stack — per «Здоровье кода» of `docs/TESTING.md`: Godot —
below; C# (and Godot .NET) — the `.csproj` from there; web / TS — the
«типы» line (no tooling — installation only by dialog, as in `env.md`). The
`tools/code_check.py --baseline` baseline is written by `/studio/setup`
step 12 — after the repository is created, before the first commit (without
git the script has nothing to measure against): the skeleton goes into it,
everything within limits.

## Godot

Paths — full, in quotes. For output — the console build (`*_console.exe`);
the owner's window — the windowed build. What the installed version
understands — per `--help`, not from memory.

1. **Project:** a minimal `project.godot` — name, main scene, version, and
   rendering method as in the installed engine; in `[debug]` — types at
   level 2 per «Здоровье кода» of `docs/TESTING.md`
   (`gdscript/warnings/untyped_declaration`, `…/unsafe_property_access`,
   `…/unsafe_method_access`, `…/unsafe_call_argument`);
   `tools/load_all.gd`; a `.gitignore` with `.godot/`; an empty
   `docs/.gdignore`.
2. **Main scene** `main.tscn`: a 1.8 m capsule (center at 0.9 m), a 1 m cube
   beside it, floor, a sun with shadows, sky, a camera at eye height looking
   at the capsule and the cube. Nodes named (`Capsule`, `Cube`, `Floor`):
   player scenarios find them by name. Build it with an engine script
   (`--headless --script`, saving via `ResourceSaver`), not by writing the
   `.tscn` by hand — the format changes from version to version. The
   one-off script — fully typed (under the step 1 settings it will not load
   otherwise); delete it afterwards.
3. **Import without a window:** `--headless --path "<проект>" --import` (no
   such flag — `--headless --editor --quit`), with a time limit. The
   verdict — not by the exit code (Godot gives 0 even on errors), but by the
   output: `ERROR`, `SCRIPT ERROR`, `Parse Error`, `Failed` — red. The
   command and the verdict words — into «Команды проверки» of
   `docs/TESTING.md` as the «быстрая» line; proving the honesty is the
   business of the «Каркас и быстрая проверка» item. Import does not compile
   scripts: then `--headless --path "<проект>" --script tools/load_all.gd`
   — no `Parse Error` and no `SCRIPT ERROR` in the output; in «Итог:» —
   «с ошибками 0» (the command and the measured time — by the «типы» line).
4. **Screenshot:** create the `docs/refs/setup` folder before launching;
   `--path "<проект>" --write-movie
   "<проект>/docs/refs/setup/first-frame.png" --quit-after 120` writes
   frames in sequence: keep the last one as `first-frame.png`, delete the
   other frames and the sound. The screenshot window — per «Как
   открывается окно» of `docs/TESTING.md`: not on top of everything;
   beyond the screen edge — only by the screenshot's own input script; do
   not write it into the game scene.
5. **The owner's window:** the windowed build with `--path "<проект>"` —
   via `Start-Process`, without waiting for it to close; from Bash —
   `powershell -NoProfile -Command "Start-Process '<exe>'
   -ArgumentList '--path','<проект>'"`.

The screenshot path — to the owner (or the file path), then the dialog
«Видите окно игры — серую капсулу и куб на полу?»:

- «Да (Recommended)» — then the journal and the report;
- «Не запустилось» — I will investigate the cause and write it down;
- «Запустилось, но не то» — describe what you see.

The answer — as the «Первый запуск окна» line in «Окружение» of
`docs/TESTING.md` and into the start journal.

## Did not launch, or not right

Investigate, don't hide:

- Cyrillic or spaces in the path — the same launch from a copy in a
  temporary folder with a Latin path; confirmed — into «Окружение» and
  «Ловушки стека»;
- the build — console or windowed, the right version;
- the GPU and driver (a Vulkan or D3D error in the output) — try
  `--rendering-driver opengl3`; if it helped — into «Окружение»: which
  rendering method works on this computer;
- the exe is blocked by antivirus or SmartScreen — tell the owner what to
  press.

The cause — into the same «Первый запуск окна» line; in the report —
plainly «окно не запустилось: <почему>, <что дальше>». The skeleton stays;
the item «Каркас и быстрая проверка» starts from this cause.

## Unity, Unreal

Unity — a project by the editor found in step 3: `-batchmode -quit
-createProject "<проект>"`; the scene — a piece of the «Каркас» item. Unreal
cannot create a project without the editor window — the skeleton entirely
as a queue item; there is no window today — tell the owner.
