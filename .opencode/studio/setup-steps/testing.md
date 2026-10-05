# How to check the product — for steps 7–9

This is `/studio/setup`'s work, not a question for the owner. Think about
**this** product and **this** stack and write the answers into
`docs/TESTING.md`:

1. **Quick run** — learn in seconds that the product launches without
   errors: a headless launch, a build, an import, a linter. It must work
   today, before any testbed.
2. **Honest verdict** — is the exit code honest for every launch method? The
   stack returns 0 with errors in the log — write down by which output words
   the verdict is made, and build your own honest exit code into the
   testbed.
3. **Testbed** — behavior, not lines of code: the checks launch the real
   product (or its real systems) and compare numbers and states. Where it
   lives, what the check and the group are called, how long a full run takes,
   what goes into «долгие». A game — determinism: seed, a fixed step, a
   headless run, and **player scenarios via input** (`## Сценарии игрока` of
   the template: they press actions and buttons by text, assert by object
   names) — with what the stack can deliver input and where `tests/scenarios/`
   lives; not a game — the line «не нужен: <почему>». A service — bringing it
   up with test data; an interface — screenshots in the set place and from
   canonical angles.
4. **«Замеры»** — with what to take a number from the running product: frame
   time, memory, response time, build size — what the constraints name. A
   real-time world — the section «Бюджет производительности» per the
   template: «Цели для игроков» — round (d)'s answers with a date and source;
   «Машины замера» — `env.md`, Result; «Бюджет систем» — this core's systems
   (world streaming, crowds …). Frames are measured by frame time, not a
   frames-per-second counter — how to measure, «Как мерить — группа
   „замеры“» of the template. The owner's other machine (a laptop) — the
   line «Не блокер» in `BLOCKED.md` about calibration («Машины замера»).
5. **What the checks will not see** — layout, sound, real devices, the
   network.
6. **«Данные пользователя»** — saves, profiles, databases outside the project
   folder: where they live, how to copy them, how to run checks on separate
   ones.
7. **«Параллельная работа»** — the subsections of the template's
   «Параллельная работа»: preparing a fresh worktree copy (everything it
   puts down — into `.gitignore`: the copies are reused), separate data,
   shared hubs, no simultaneous runs. `пишут` — from round (e), default 2;
   `тяжёлых проверок` — 1. An existing project with checks — **verify for
   real**: a copy, preparation, a quick run, the data landed separately,
   delete the copy. Worked — «проверено · пишут: 2 · тяжёлых проверок: 1»;
   not — «не проверено» and why; the data cannot be separated —
   «невозможно» (everything one at a time, this is not an error).
8. **«Стенд»** — the `## Стенд` section of the template, the parts have their
   own state: «вид» — if the world is judged by eye (light and sky, water,
   vegetation, terrain, buildings, characters, effects, animation), `нет`,
   built by the queue item «Стенд вида»; «ощущение» — if the game has
   controls or a camera, `нет`, built by the first step of the first item
   `[ощущение]`. An unneeded part — «не нужна: <почему>».
9. **Build and release** — the lines «сборка» (in Godot — `--headless
   --export-release "<пресет>" <путь>`, export templates exactly matching
   the version from «Окружение») and «проверка сборки» (a built exe for N
   frames or a player scenario on the build, with an honest verdict) and the
   section `## Выпуск`: presets, where it is put (the folder — into
   `.gitignore`), platforms. What does not exist yet — «нет — до первого
   выпуска»: `/studio/release` builds and publishes. A product without a
   player build — «не нужен: <почему>».
10. **«Как открывается окно»** — fill the template's line with this engine's
    flags, verified by a 1-frame launch of the installed version (not by
    `--help`): logic checks — without a window; agents' screenshots and the
    stand (with `--quit-after N`) — a window beyond the screen edge (Godot —
    the startup script does `window_set_position(Vector2i(-6000, -6000))`
    first; `--position` and a minimized window do not fit), without focus,
    sound, and not on top of everything; measurements — on screen; the
    owner's window (the feel stand without N, step 10's first window) —
    ordinary, with focus and sound; the engine cannot draw without focus —
    write exactly that.
11. **«Здоровье кода»** — the template's section: of the «Типы» blocks — the
    own stack's blocks (Godot with C# — both); the line «Типы движка» —
    `включены` (a new project, the stack has a type check; no — «не
    включены — <чем поставить>»); do not write thresholds as numbers. The
    lines «здоровье кода» and «типы» — into «Команды проверки»; time it by
    measurement, but later: «типы» — at step 10 (`finale.md`, after the
    skeleton), «здоровье кода» — at step 12, after the repository and the
    baseline (before them the script answers with code 2); before the
    measurement in the column — «замер — шаг 10» / «замер — шаг 12». Another
    stack without a type check — install it only by a "yes" via a dialog
    (`env.md`); until then «типы: нет — <чем поставить>». An existing
    project — do not silently enable the engine's warnings (`existing.md`).

The testbed's state: `нет` — no checks; `есть` — they exist and the verdict
can be trusted; `строится` — in between. «Что проверяется уже сейчас» — only
**launched and worked** during `/studio/setup` (step 10's import and
`load_all.gd`, if they passed); in a new project without code — the honest
«ничего: продукта ещё нет».

## The «Построить проверки продукта» item

The state is not `есть` — the item into the queue (in a new project — second,
after «Каркас и быстрая проверка»; in an existing one — first):

```
- **[можно] [код] Построить проверки продукта.** Без них `reviewer` одобряет
  только «запускается без ошибок», а `/studio/start all` не видит, какой пункт сломал
  следующий; подробности ниже, «Подробности ближайших пунктов».
```

The pieces — for this stack, for example:

1. the testbed's skeleton per «Правила каркаса» of `docs/TESTING.md`: all the
   checks, one by name, the group; exit code 0 / 1 / 2 (green / failure / no
   such check); the result «зелёных / провалов» with every failure by name;
   **every check — its own file** (`tests/checks/<имя>.*`), shared helpers —
   `tests/lib/`, the runner finds the checks itself, without a shared list:
   otherwise every item edits one file and parallel items collide (it
   happened in one project: 64 checks in one `runner.gd`, a batch of 20
   items went one at a time); checks with a frame or time threshold — in the
   group «замеры», the runner can skip it with an explicit line («Нельзя
   одновременно» of `docs/TESTING.md`); a time limit on every command;
   windows — per «Как открывается окно»;
2. the first real check of the core's main system — red if the system is
   broken on purpose;
3. for a game — the player scenario runner (`## Сценарии игрока`, codes 0 / 1
   / 2) and **a scenario of the core's main action via input: goes red if
   the controls are broken**. In a new project there is no action yet — here
   a scenario on the skeleton (the scene loaded, the capsule stands on the
   floor), and the main-action scenario — a piece of «Серая коробка». The
   full run and the `сценарии` group run every scenario in the folder, the
   failures — by name: otherwise the core scenario does not guard the
   controls from the following items;
4. a screenshot with one command in the set place (screen, seed,
   coordinates) and from canonical angles — if the product has a screen;
5. the section «Как добавить проверку» with an example (for a game — a
   scenario too); the testbed's state — `есть`;
6. a product with a real-time world — **measurements per the budget**: the
   group «замеры» per «Как мерить — группа „замеры“» («Бюджет
   производительности» of `docs/TESTING.md`) — a scenario over frames during
   streaming, its own run per preset, a pre-check («замер не состоялся», not
   red), `--занят` (busyness — a note, without a baseline and red), a trial
   mode; the machine's first baseline is taken by the group's first run at
   the end of a `/studio/start` run («Замеры»);
7. the parallel copy: preparation and separate data recorded, the quick run
   green in a fresh copy, the copy's data did not get into the main one —
   «проверено · пишут: 2 · тяжёлых проверок: 1».

A quick run with an honest verdict (a deliberate error gives red) — in a new
project a piece of «Каркаса», in an existing one — the first piece of this
item. Checks exist, but the verdict cannot be trusted or the core is not
covered (for a game — the controls with a scenario via input too) — the item
is called «Довести проверки» and consists of the missing pieces.

## The «Стенд вида» item

For a world judged by eye — right after the checks, `[можно] [код]`. The
pieces — per the «вид» part of the template's `## Стенд` section: a separate
scene or mode; named frames from the passports `docs/refs/`; stopping time
and wind; light presets (neutral and target); variants — as an argument; a
1.8 m capsule and a 1 m cube; the screenshot — an error if the object is not
in the frame; a screenshot of the owner's place by seed and coordinates. The
command `снимок кадра <имя> [вариант] [--seed … --место …]` — into «Команды
проверки»; done — the state `есть`.
