# Commits, README and the project's About

Shared rules for all studio commands and agents that write commit messages, the project's `README.md`, or the About line. The skill references this file in one line and does not copy the rules. The commit history and the README are what people see on GitHub: from the first line of a commit it is clear what changed in the game; from the README — what the project is and what already works in it.

## Language

The line `Язык коммитов: English | Русский` in the «Git» section of the project's `AGENTS.md`; `/studio/setup` writes it (and `/studio/setup обновить`) after a dialog, the recommendation — `English`. No line — the language of the item's latest commit (`git log -1 -E --grep "^(Пункт|Item) [0-9]+:" --format=%s`): Cyrillic — Русский, otherwise English; no item commits — English. `/studio/start` writes the batch's language into the header of `docs/BATCH.md` (`Язык коммитов: …`), the executor takes it from there. The commit body — in the same language. The old history stays as is, so search — always with both markers (section "Search").

## Markers

The first word of the first line:

| Who commits | English | Russian |
|---|---|---|
| batch item (`/studio/start`, reworks) | `Item N:` | `Пункт N:` |
| the batch table, run results | `Batch:` | `Партия:` |
| acceptance (`/studio/done`: documents from the results and the code-health base) | `Accept:` | `Приёмка:` |
| queue and concept (`/studio/idea`, `/studio/need`) | `Queue:` | `Очередь:` |
| reference (`/studio/idea`, `/studio/need` — references only; a style concept in `/studio/idea` — with the queue and the orders too; the `reference` agent does not commit, the commit — by whoever invoked it) | `Reference:` | `Образец:` |
| bug (`/studio/fault`) | `Bug:` | `Баг:` |
| order (`/studio/order`) | `Order:` | `Заказ:` |
| incoming files (`/studio/add`) | `Assets:` | `Ассеты:` |
| process (`/studio/setup`, `/studio/parallel`, `/studio/check`, `/studio/retro`) | `Process:` | `Процесс:` |
| map (`/studio/roadmap`) | `Roadmap:` | `Карта:` |
| release (`/studio/release`) | `Release:` | `Выпуск:` |
| revert | `Revert "…"` — as git writes it | the same |

An item marker carries one number: reworking two items at once — two commits, one commit per item (`Пункт 4 и 9:` — search does not find it).

## First line

- No longer than 72 characters together with the marker.
- After the marker — **what changed for the player or the user**, in plain words. English — the imperative, capitalized after the marker ("Item 3: Let players dig through stone with a pickaxe"); Russian — "what was done" («Пункт 3: копать камень киркой»).
- **Forbidden:** metaphors and "artfulness" ("keep the other nine moving"); empty words (`fix`, `update`, `changes`, `misc`, `wip`, «правки»); constant, file and function names — they go in the body.
- A service commit (`Batch:`, `Process:` …) — what happened to the work, just as plainly; numbers — in the body.
- An `Уборка:` item does not change the game — say so after the "what": `Item 7: Keep shield rules in one place (no change for players)` · `Пункт 7: правила щита в одном месте — для игрока без изменений`.

| Don't | Do |
|---|---|
| `Item 4: Bake the light into the faces, countable before the press` | `Item 4: Add a Bake button that paints outline and shading into colours` |
| `Process: Keep the other nine moving` | `Queue: Put the desktop app on hold until its toolchain is chosen` |
| `Партия: итоговые прогоны — полная 66/0, быстрая 1/0` | `Партия: итог запуска`, the numbers — in the body |
| `Item 2: fix water` · `Пункт 2: правки` | `Item 2: Stop water from flooding the cave` · `Пункт 2: вода не заливает пещеру` |
| `Item 5: Raise JUMP_HEIGHT in player.gd` | `Item 5: Let the hero jump onto crates` |

## Body

After an empty line, lines up to ~72 characters, 1–5 lines: why; what is now visible (from «Как увидеть»); checks (`Checks: full 66/0, quick 1/0` / `Проверки: полная 66/0, быстрая 1/0`); which item or bug it answers. Technical details — here. The owner's words — verbatim, in quotes, in his language. **Never start a body line with a marker**: search finds any line. The body — with successive `-m`, one paragraph per `-m`. Do not use a message file (`-F`): PowerShell writes it with a BOM, the first line stops starting with the marker, and search will not find the commit. After committing, verify with `git log -1 --format=%s`: the line starts with the marker.

```
Item 3: Let players dig through stone with a pickaxe

Stone breaks after three hits and cracks after each one.
To see: new world, seed 42, cave at 10,5 - hit the wall three times.
Checks: full 66/0, quick 1/0.
For batch item 3, "Mining" in the queue.
```

```
Пункт 3: копать камень киркой

Камень ломается с трёх ударов, после каждого видна трещина.
Как увидеть: новый мир, seed 42, пещера у 10,5 — ударить стену трижды.
Проверки: полная 66/0, быстрая 1/0.
К пункту 3 партии, «Добыча» в очереди.
```

One rework — one commit; files — by name.

## Permanent messages of `/studio/start` and `/studio/done`

| What | English | Russian |
|---|---|---|
| stand | `Item N: Add the look stand` · `Item N: Add the feel stand` | `Пункт N: стенд вида` · `Пункт N: стенд ощущения` |
| base before the choice | `Item N: Base — <что изменилось>` | `Пункт N: основа — <что изменилось>` |
| variants for the choice | `Item N: Offer <тема> variants, choice K` | `Пункт N: варианты <тема>, выбор K` |
| rework per the owner's words | `Item N: Rework — <что изменилось>` | `Пункт N: поправка — <что изменилось>` |
| batch taken | `Batch: Take N items from the queue` | `Партия: снято N пунктов из очереди` |
| wave | `Batch: Start wave W with items N, M` | `Партия: волна W — пункты N, M` |
| item ready | `Batch: Mark item N ready for review` | `Партия: пункт N готов к проверке` |
| question — to the scenarist | `Batch: Hold item N for the owner's answer` | `Партия: пункт N ждёт ответа` |
| choice recorded | `Batch: Record choice K for item N` | `Партия: пункт N — выбор K` |
| run results | `Batch: Record run results` | `Партия: итог запуска` |
| acceptance | `Accept: <что теперь может игрок>` | `Приёмка: <что теперь может игрок>` |

The batch-taking commit has waves in the body; run results — the run numbers; acceptance — the final-check numbers
and the line «Items kept: 1, 3; reverted: 2 — <причина>» / «Пункты оставлены: 1, 3; откат: 2 — <причина>».

## Search

Always `-E` and both markers. Commits of batch item N (the hash — from the line «Снята … на <хеш>» in `docs/BATCH.md`):

```
git log <hash>..HEAD -E --grep "^(Пункт|Item) N:"
```

- all item commits — `-E --grep "^(Пункт|Item) [0-9]+:"`;
- reverts of item N — `-E --grep "^Revert .(Пункт|Item) N:"`: the item search does not find them; which commit a revert is paired with — the line `This reverts commit <hash>` in its body;
- stands — `-E --grep "^(Пункт|Item) [0-9]+: (стенд|Add the (look|feel) stand)"`;
- the base of item N — `-E --grep "^(Пункт|Item) N: (основа|Base) — "`;
- the other markers — likewise as a pair: `"^(Партия|Batch):"`,
  `"^(Приёмка|Accept):"`.

`^` — the start of any line of the message: for what is found, check the first line
(`--format="%h %s"`) — a commit where the marker is only in the body does not count.

## README

- Files: `README.md` (English) and `README.ru.md` (Russian); the line in «Git» of
  `AGENTS.md`: `README: en + ru | en | ru` (no line — `en + ru`). At the top of each — a link to the other: «Русская версия: README.ru.md» /
  «English: README.md». One `en` or `ru` — only `README.md` in that language (GitHub shows it), without a link.
- The updated parts — between the markers `<!-- studio:begin <name> -->` and
  `<!-- studio:end <name> -->`. Everything outside the markers — the owner's text, **never
  touch it**. Blocks:

  | Block | What goes in it | Source |
  |---|---|---|
  | `pitch` | one or two lines: what it is and for whom | «Одной строкой» `docs/CONCEPT.md` |
  | `status` | "Now: Stage N — <what the player will see>", "Next: …" (in Russian — «Сейчас», «Дальше») | «Этапы» `docs/ROADMAP.md`; no stages — «Очередь» in one line |
  | `features` | "What works" / «Что уже умеет»: up to 10 lines in the player's words | «Что работает» `docs/CONCEPT.md` and «Сделано» `docs/ROADMAP.md` (except the lines «— для игрока без изменений») |
  | `run` | requirements and how to run, without paths containing the user name | «Запуск и проверка» `AGENTS.md`, «Окружение» `docs/TESTING.md` |
  | `shots` | up to 3 screenshots with relative links; none — the block is empty | `docs/refs/*/accepted-*` |
  | `release` | the latest version and a link to `docs/releases/<version>.md`; no releases — the block is empty | `docs/releases/` |

- Who updates: `/studio/done` — `features`, `status`, `shots` in the closing
  documentation commit of the acceptance; `/studio/roadmap` — `status` when recording the map and
  `Next`, and when «Одной строкой» changes — also `pitch`; `/studio/release` —
  `release`, `features`, `pitch`, `run`; `/studio/setup` — creates both files from
  templates; `/studio/setup обновить` — updates the blocks, and in a README without
  markers inserts them only with the owner's consent.
- Both files change together, in one commit, identical in meaning: in
  `README.md` — in English, in `README.ru.md` — in Russian. In the player's words,
  without the internal kitchen (rounds, batches, code-file names).
- No file or markers — do not insert the blocks themselves: one line into the report
  «README без блоков studio — `/studio/setup обновить`»; if in «Как ведётся работа»
  `docs/DECISIONS.md` there is the line `README — без блоков studio` — silently, without
  a line in the report.

## About

About on GitHub — two fields. Description: English, ≤ 350 characters, `pitch`
in English (what it is, for whom, the platform), without stage and version. Topics: 3–6,
lowercase Latin with hyphens (`godot`, `voxel`,
`procedural-generation`). Stored in «Git» `AGENTS.md`: `About: <description>
· Topics: <topics>`. `/studio/setup`, `/studio/roadmap` (when «Одной строкой» changes) and
`/studio/release` rebuild them; if they changed and there is a remote repository on
GitHub (`git remote -v` contains `github.com`) — two lines in the report:
«Обновите About на GitHub (шестерёнка справа от About) — Description:
<описание>» and «Topics: <темы через пробел>». Nothing is changed on GitHub itself
and GitHub CLI is not installed for this.
