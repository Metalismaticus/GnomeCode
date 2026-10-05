# Step 4 — reference analysis before questions

Arrive at the dialog rounds with the references on disk, broken down into
components, not with three adjectives. The owner decides — by choosing, not
the agent with words.

## 1. Prepare

A product without a world and without references (screens only) — from this
step only the researcher (p. 3).

- `tools/look_sheet.py` and `tools/refs_check.py` — from `templates/tools/` if
  missing; `docs/refs/INDEX.md` — from `templates/docs/refs/INDEX.md` if
  missing (before the agents: they append their themes' rows to it).
- Images pasted into the chat: the app saves them to
  `%TEMP%\claude\<папка проекта, где не-латиница и знаки заменены на ->\<id
  сессии>\images\<n>.webp|png`; the freshest `images` folder of this project —
  the current session. Check the count against how many the owner pasted.
  Not found — ask to drag the file into `docs/refs/<тема>/` or name the path.

## 2. Themes

A theme — what the owner brought a reference for: «лес как в Valheim» —
trees, a grass screenshot — grass. A whole game as the reference — the theme
«общий вид» (light and sky, palette, stylization). A reference for controls,
camera, or sound («прыгает как в X», «камера как в Y») — a theme of the work
kind `ощущение` (jump, camera, hit): the reference is a game, not a
screenshot; the agent looks for numbers and a description of the mechanics.
More than three references — the three main ones by the owner's words, the
rest — into the plan for later. Not a single one — do not call the agents:
the researcher (p. 3) will offer 2–4 games of the genre as candidates for
the main reference; what is chosen in round (v) is analyzed the same way.

**A style concept (the look of the whole game)** — a picture of a whole frame
and/or a style spec (several themes, shared rules, prohibitions): the same
mode as in `/studio/idea` — section 8 "Style concept" of
`.opencode/commands/studio/idea.md`, not the per-theme agents; it changes only
the look; spec lines about genre, mechanics, and tone — «вне стиля» (the
concept — from rounds (a) and (b)). Its p. 1–5 — here as is (the «Лестницы
качества» p. 5 price — `оценка` without a link to the budget: it is written at
step 8); the p. 6 dialogs — round (v) instead of the questions about the
concept's themes (the main reference — from the answer; the scale — from the
spec; not in the spec — by a question of the same dialog); the p. 7 layout —
at step 8. Into the slice — only «Первый кадр по образцу» (matching the
concept; the pieces — from light, sky, and haze), the other themes — as a
`[Потом]` line into «Задумано» of `CONCEPT.md`; «Вид» there — the main
reference and the scale in one line; in detail — `docs/refs/INDEX.md`. The
doubt "the style of the whole game, a reference for one theme, or the concept
— what is being made in the game?" — by a question of round (a): before the
answer — only p. 1 (save into `_concept/`); after that — the layout into
themes, the `reference` agents or, if it is the concept, rounds (a) and (b).

## 3. Run in parallel

To the owner, one line, without asking: «Разбираю образец <X> — несколько
минут». Then in one message (several subagent calls), in the background:
while they run — rounds (a) and (b); round (v) — after their results.

- per theme the `reference` agent (`reference`). Input: the theme; the
  owner's words verbatim, with hedges; explicit paths to that theme's images
  from the owner (p. 1; "find the fresh ones in the session's `images`
  folder: <what is on them>" — only if there are no paths); the named games,
  mods, videos, links; the kind of work (`вид` / `ощущение` / `механика`);
  the full path `.opencode/studio/templates`;
- a shared researcher — a subagent with web search: the genre and engine
  traps of this version (step 3) — what usually breaks, what is expensive,
  what to settle before code (large worlds — precision far from the origin;
  voxels — the mesh not on the main thread …), 5–10 lines with links. An
  owner answer needed — as a «Вопрос владельцу» block.

Into the context — only the agents' results (the passport, findings,
contradictions, «Вопрос владельцу»); do not retell passports and sheets.
Afterwards — verify that every theme is in «Темах» of `INDEX.md` (the agents
appended them all at once). The researcher's traps — into the plan (the 3–5
main ones, also the grounds for «пробы стека»), at step 8 — into «Ловушки
стека» of `TESTING.md` with the note «из исследования, не проверено».

Until the owner has answered, the passport — `черновик`, and the queue item
about this look — `[ждёт образца]`.

## 4. Round (v): show, then ask

First the paths to the passport, the owner's screenshots, and 2–3 frames of
the reference or the sheet `docs/refs/<тема>/sheet-*.png` (or the file path;
for a feel theme — the path to the passport with the reference's numbers),
then the dialog. Questions — from the agents' «Вопрос владельцу» blocks,
without retelling; the block `(можно несколько)` — `multiSelect`. In
`/studio/setup`, per theme — only «Что вам нравится в <образец>?» (one
question; more than four components — the four most important) and «Я вижу на
снимке» (the main theme only), and only if the owner's words do not say what
matters to him (otherwise — `да — слова <дата>`, as in `/studio/idea`,
section 3); the agents' other questions — into «Открытые решения» of the plan
(`/studio/need` will ask them). Then the main reference and the stylization
scale (`talk.md`). ≤ 4 questions in a dialog, no more than two dialogs.

## 5. Record the answers

- Passport: the chosen components — `Важно владельцу: да`; of the offered
  ones, the unchecked — `нет`; named in words — `да — слова <дата>`; the
  rest — `не спрошено`; what was chosen on the screenshot — into «Что берём»
  of its «Образцов» row; notes — into «Слова владельца» verbatim with a date;
  a row into «Журнал»; the state — `подтверждён владельцем <дата>`. An answer
  with a hedge — the `[предварительно]` tag on the row.
- `INDEX.md`: in «Темах» — the state and «Главное для владельца»; the main
  reference and the stylization scale — in the owner's words with a date; the
  line «Репозиторий:» — private or public (step 3).
- Empty or «пока не знаю» — the passport stays `черновик`; the question — into
  «Открытые решения» of the plan (at step 8 — into «Решения» of
  `BLOCKED.md`).
- Check: `python tools/refs_check.py` — every passport path on disk.
