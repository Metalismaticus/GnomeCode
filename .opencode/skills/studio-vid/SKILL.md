---
name: studio — items [вид] and [ощущение]
description: Protocol for batch items and steps tagged [вид] or [ощущение] — preconditions, stands, «основа», «выбор K/3», the «встроить вариант X» step, «Смотреть самому», rejection and «пересмотр приёма»; acceptance in /studio/done — «было / стало / образец» frames. Load when the batch has a [вид] or [ощущение] item (the coordinator of /studio/start; /studio/done — while such items are in the batch).
---

“Section N” and “step N” references mean the `/studio/start` protocol in
the coordinator context; section 3a (waves) — the `studio-wave` skill: a
wave with `[вид]`/`[ощущение]` — load it too.

## 3b. Item `[вид]` and `[ощущение]`: variants and choice

A wave — per `scout`: a single item — in the main folder, in a wave — in
its own worktree copy (3a); the stand and `[ощущение]` — as their own
wave. Screenshots go to `../<папка проекта>.wt/shots/`; the coordinator
views the sheet in the copy there, and before the commit `Партия: пункт N —
выбор K` moves the «Лист» files along the same paths into the main
folder. Steps — «стенд вида» (if needed), «основа», «выбор K/3» (no more
than three), «встроить вариант X»; each runs the cycle of section 3, steps
3–8, with its own three rounds, the step shown in the item's line
(`в работе · основа · круг R/3`). The «Стенд» — the section of
`docs/TESTING.md` (in old projects — «Стенд вида»; it has no “ощущение”
part — do not take `[ощущение]` there, into the report “нужен
`/studio/setup обновить`”). Vocabulary: «способ» = a technique from the
library `.opencode/studio/reference/LOOK_TECHNIQUES.md` (the passport line
«У нас: приём:»); «смена способа» — the next technique from the passport
line, not “invent one”; the «Способ:» line in the result names the
technique.

1. **Preconditions** (section 2): the passport from the item's «Образец» —
   `подтверждён владельцем` or `принят кадр`; `python tools/refs_check.py
   --topic <тема>` green; the “вид” part of the «Стенд» — `есть` or built
   in this batch (the stand item `готов к проверке` or the commit
   `Пункт …: стенд вида`; not ready — wait for its own wave afterwards, do
   not build your own); otherwise the first step is the stand: `reviewer`
   as `[код]`, the commit `Пункт N: стенд вида`. No passport, it is a
   `черновик`, or no images — do not take the item: into the report and
   «Найдено по ходу» “пункт X ждёт образца: <чего нет>”; no script —
   `/studio/setup обновить`. **Light — first:** a `[вид]` item of any
   topic except the global look (the «свет и атмосфера» passport) is not
   taken until that one is `принят кадр` — the `[ждёт света]` marker;
   `roadmap_check.py` and `refs_check.py` return code 1 while it is
   `[можно]`: into the report “пункт X ждёт света” (a project without a
   light topic — without the marker). The global look itself does not wait
   for the render probe, shadows, and other `[код]` items. Frames — at
   the hour of day from the passport's «Кадры» (for the stand — as an
   argument, for the sheet — `look_sheet.py --time <час>`: the hour goes
   into the JSON and the header), after the light's acceptance — on the
   «Стенд»'s `concept` preset; the probe with «Готово, когда: пара
   кадров» (section 6) — also after accepted light.
2. **The base — before the choice.** The «основа» step: everything that
   does not depend on taste — the criterion's pieces outside the «оси
   выбора» (the axes are named by the result's «Лист»), shape and mass,
   the topic's known defects from `docs/BUGS.md` and «Найдено по ходу»
   about the item, except its «Не входит», the batch's separate items, and
   `уборка:` lines; the commit `Пункт N: основа — …` (a result without
   files — no commit). The choice — only on an approved base: first shape,
   then color on it. **The distant view of the global look** — a decision
   of the picture, not of light: the distance is visible from the ground,
   aerial perspective — toward the reference's distant-view color, not
   toward a white sky, edge fog hides only the seam “area ↔ distant view”
   — «Решил сам [видно]» in «Принято по умолчанию» and a `DECISIONS:` line
   in «В документы при `/studio/done`»; cancel — at `/studio/done`.
   **«выбор K/3»:** the `executor` chain — `executor-code` makes 2–4
   variants on top of the base, `executor-finish` — screenshots and the
   sheet: at choice 1 at least two — **with different techniques** from
   the passport's «Как сделано у образца» (in the «Лист»: “A — приём
   <имя>; B — приём <имя>”), the number vocabulary of one technique — only
   at choices 2–3, narrowing around the chosen one; the axis of choice 1 —
   shape, mass, technique, color and tone — at choice 2; for the global
   look axis 1 — the distant-view and tone technique, not the sun's
   color. `reviewer` — mode `[вид]` (variants with one technique and
   different numbers while the shape is unresolved — CHANGES_REQUESTED
   «оси — числа, а не способы»); the note «основа: [criterion N] …» — the
   step's uncommitted work and the «Лист» files stashed to
   `rounds/p<N>-k<K>-возврат/` and returned by name (like “не удалось”);
   into the item's line — `· возврат с выбора K на <хеш HEAD>:
   «<замечание>»` (until choice K is approved); the item goes back to the
   «основа» step at round 2/3 with the note verbatim (diff — `git diff
   HEAD`), then choice K anew from round 1/3; a base with such a note
   counts as made only with an `основа —` commit in `<хеш>..HEAD` (same
   in §1 step 3). One rollback per choice K; a second — revert the same
   way and `не выполнен: основа — <замечание>` (for `/studio/done` — the
   reason is in the base). `APPROVED: ready for choice` — after «Смотреть
   самому» the commit `Пункт N: варианты <тема>, выбор K`, then the choice
   (step 3).
2a. **A target frame of the same camera angle** — after the base is
   approved (for the global look — after the first clean stand screenshot
   of the topic's frame from the passport's «Кадры»: no clean light
   screenshots exist before it), if the topic's «Образец для листа» does
   not yet have a target frame `target-<n>` (without the topic name;
   `target-<тема>-N` — a crop of the concept, not it): the coordinator
   assembles an `art` order “кадр-цель” from the main frame — a clean
   stand screenshot and the topic's reference, the prompt “### кадр-цель”
   of `docs/orders/art.md` with the addition “перекрась в стиль образца:
   свет, палитру, материалы; камеру, композицию и предметы не менять”.
   The executor — from the passport's `art`: `вручную` (the owner via his
   own ChatGPT) — an item in `docs/prompts/art-NN.md` with both images'
   paths and a row of the `art` table in `docs/BLOCKED.md`, the commit
   `Партия: пункт N — кадр-цель к заказу`; the prompt is handed out by
   `/studio/need`, the image accepted by `/studio/add`, “так ли должно
   выглядеть” asked by `/studio/need`; `api` — same as `вручную`:
   `/studio/start` writes the order draft (the prompt and a clean
   screenshot into `docs/prompts/`, the debt into `BLOCKED.md`) and moves
   on, the send is done by `/studio/need` or `/studio/order` in the
   concept chat — the dev chat asks the owner nothing during a run and
   opens no dialogs about images. No more than two attempts per topic.
   The chain does not wait: while there is no target frame, REF is the
   topic's crop from the concept.
3. **The choice — by the agents, no dialog** (and in single
   `/studio/start`): which variant is closer to the reference — the
   agents' work, the owner judges the result in `/studio/done`. The
   anchors — your own «Вижу:» and «Против образца», the reviewer's
   “Pairwise” and “By the gap” (their “closer to the reference — X” — if
   the pair matched in two display orders) and the sheet's numbers
   (differences from REF in the JSON); no new readings of images. Take the
   variant closest to the reference by the passport's «Главное
   впечатление», then by «Разрыв»; “don't know” — by your own «Вижу:»,
   then by the numbers. Above the reference — the owner's words (the
   passport's «Слова владельца» and «Журнал», the item's «Не принят»)
   and the «Правила стиля» of `docs/refs/INDEX.md`; the «покажем оба»
   axis — the side of his words (they are newer), the reference variant —
   «отвергнут, как образец»; a topic without a reference («Образцы»:
   “нет — выбор по вариантам”) — by the «Правила стиля» and «Главное
   впечатление». The chosen one is worse in what the reference does not
   have (a different hour of day, camera angle: “daylight bleaches the
   sand”) — the default rule from the «Правила стиля» or the passport's
   assertions (the next-closest variant that keeps it) or choice K+1 on
   this axis; do not ask the owner. Into «Принято по умолчанию» and the
   report — `Решил сам [видно]: пункт N — выбран <буква> — ближе к
   образцу <чем>; отвергнуты <буквы> — <чем>; отменить — при
   /studio/done`; into the passport's «Журнал» — `- <дата>: выбран B сам
   — <чем ближе>; отвергнуты A, C — <чем>`, for the «покажем оба» axis —
   also `- покажем оба (<составляющая>): выбран как в ваших словах
   <дата>` (by it the agents count the axis resolved); the commit
   `Партия: пункт N — выбор K` — `docs/BATCH.md`, the passport, and the
   «Лист» files: a revert will not erase the choice's history. A passport
   with an uncommitted edit from the concept chat — a «Журнал» line for
   the item into `docs/BATCH.md`, `/studio/done` will carry it over.
4. **After the choice — in the same run:** if the «Вижу:» of the chosen
   one still names the passport's main «Разрыв» and K < 3 — choice K+1
   around it; otherwise (and on the third choice) — the «встроить вариант
   X» step, `accepted-<дата>.png` — into the item's commit; then section
   3, step 7. None closer to the reference than the base (“By the gap”,
   «Вижу:») — choice K+1 with the passport's next techniques (once;
   again — step 5). The passport state `принят кадр` is set by
   `/studio/done`.
5. **Пересмотр приёма.** Again none (step 4), a second «смена способа»
   (section 3, step 6), or `не выполнен` — revert the variants' commits
   (`git revert --no-edit`, the new ones first), keep the stand and the
   base; the item — `не выполнен: пересмотр приёма`, into the passport's
   «Журнал» — `- <дата>: пересмотр приёма — «<что видно>»` (commit
   `Партия: …`); the next technique will be picked by `/studio/idea`
   after `/studio/done`, otherwise the next `/studio/start` goes the same
   round. The owner's rejection in `/studio/done` with words about the
   «способ» (“свет облаков зависит от времени суток”, “как устроены
   горы”) — also a «пересмотр приёма», not of the reference; `не
   выполнен: на пересмотр образца` (into «Журнал» — `- <дата>: на
   пересмотр — «<заметка>»`) — only by his words “образец другой”.

**Смотреть самому.** A `reviewer` result without «Вижу:» for every
screenshot and sheet variant is invalid: tell the same reviewer (a
continuation of the same child subagent session by its sessionID; none —
a fresh one with the former message) “no «Вижу:» for <image>”, do not
choose by it. At the end of each round, before `готов к проверке` and the
choice, the coordinator runs the «кадр не пустой» check of
`docs/TESTING.md` (code 1 — reject), opens (read) the sheet and the main
frame of each variant itself, and writes to the item in `docs/BATCH.md`
2–3 lines «Вижу: <кадр> — <что в нём словами продукта>» and «Против
образца: …». Clearly wrong (an empty or gray frame, the wrong subject,
edges where the reference is soft, variants not differing) — do not
choose: `executor-code` with these lines verbatim (a round or a «смена
способа», section 3, step 6). **The first line — «Вижу: REF — …»:** the
reference (and its crop) lacks the topic's subject (for the sky — a
character, for the spruce — grass; for a light topic the subject is the
whole frame: `target-<тема>-1` — a valid REF) — nothing to compare
against: do not choose, the item `ждёт образца: вырезка REF не про
<тему>`, a «Найдено по ходу» line for `/studio/idea` (fix the «Образец
для листа»), the batch moves on. Do not choose by a sheet where the
variants are nearly identical either — by the `--sanity` line “почти
одинаковы” (a pixel fraction), not by eye: the eye does not see fine tone
differences, and for light and tone those are exactly the axis; by eye —
only empty, gray, wrong subject; and a sheet where `look_sheet.py`
returned code 1 — with `--axis форма` the JSON's `defects` says “варианты
различаются только оттенком” (an edge map) — `executor-code`: “spread them
across techniques”; `warnings` (REF proportions without `--ref-crop`,
“на грани”, “только оттенком” without the axis) and `notes` (with `--axis
приём` variants of one shape, different tone — as intended for light and
tone) do not forbid the choice; where the sheet's hour (header, JSON) is
not equal to the passport's «Кадры» hour or is missing — reject as
`[спецификация]`. Taste outside the passport's «Разрыв» — still «Не
судил».

**While the choice runs**, the batch moves on: independent items — as
usual; one depending on item N's code — after its base's commit (from a
copy — after the merge), if the choice changes only what it does not touch
(a waterfall's color — in the shader, a garland over the sea — in the
mesh): a fresh `scout` decides (“Item M: does it depend on item N's
choice — the axes from the «Лист» of its result — or only on N's
committed base?”); “only on the base” — take it with the line «Решил сам:
пункт M — до выбора пункта N — <почему>» (section 4); “on the choice” and
doubt — after embedding N in the same run: the working variant — the one
chosen by the coordinator. Nothing left to take — section 6.

**`[ощущение]` differences** (judged by playing or by ear; the passport —
`Вид работы: ощущение`, images not required):

- the stand — the “ощущение” part, the step and the commit — `стенд
  ощущения`; «Смотреть самому» — only by the stand's screenshots, if
  there are any;
- the choice: `executor-code` — 2–4 presets on keys 1–4 of the debug
  build, `executor-finish` — the variants sheet
  `docs/refs/<тема>/sheet-<дата>.md` (for sound — also
  `variant-<дата>-<буква>.wav`); `reviewer` — mode `[ощущение]`; the
  coordinator — as in step 3, by the passport's assertions (“Pairwise”)
  and the sheet's numbers — closer to the reference's numbers, without a
  reference — to the owner's words; into «Журнал» — the numbers too:
  `выбран B сам (<числа>)`; the owner tries it in `/studio/done`;
- embed — the chosen one's numbers as the defaults, remove the topic's
  presets (keys 1–4, the caption and the stand's `_проба` remain);
  instead of `accepted-` in the report and `/studio/done` — the chosen
  variant with its numbers.


## Acceptance in `/studio/done` — «было / стало / образец» frames

**Frames — before the dialog, by the chat itself; without them there is
no «что принимаете?» dialog.**
For `[вид]` — «было / стало / образец» full screen: into
`../<папка проекта>.wt/done/` (delete the old ones), at original size,
without measurements and HUD, the item number in two digits so the viewer
scrolls in order: `04-1-БЫЛО.png` (the main frame before the item),
`04-2-СТАЛО.png` (the accepted frame), `04-3-ОБРАЗЕЦ.png` (the «Образец
для листа» of the same frame); for a probe — the same `-1-БЫЛО` (the
current one) and `-2-СТАЛО` (the new one) from «Как увидеть» and the line
“на вашем ПК тянет / не тянет (по замеру); на слабых — неизвестно”. Open
the first one: `Start-Process "<путь>\04-1-БЫЛО.png"` (not Windows — the
folder); before the dialog — “Открыл кадры: листайте ←→ — пункт 4
(свет): было → стало → образец; …; путь: …”.
For `[ощущение]` — open the game or the stand yourself (the «стенд
ощущения» without `--quit-after`, or the launch from `AGENTS.md` —
`Start-Process`, without waiting for it to close,
`.opencode/studio/setup-steps/finale.md`, step 5): “Открыл игру:
попробуйте <что из листа>; вариант X: <числа>; закройте окно и
ответьте”; if it did not open — how to launch it and the reason.
