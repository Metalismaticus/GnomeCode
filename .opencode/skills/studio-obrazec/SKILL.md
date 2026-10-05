---
name: studio — reference analysis
description: Protocol of reference analysis in /studio/idea (section 3) — a named game, a screenshot, “как в X” — the reference agent in parallel, what to ask, what to record. Load when the owner names a reference or sends a screenshot/link.
---

“Section N” references mean the `/studio/idea` protocol; the style concept
(section 8) — the `studio-concept` skill.

## 3. Reference: analyze before questions

**When** — per “Key points” (“снова жалуется” — ROADMAP or BUGS already has
«Не принят» or «Замечание» about the topic, the passport
`docs/refs/<тема>.md` missing or a `черновик`) and by `/studio/idea образец
<тема>`; right away, with a line to the owner “Разбираю образец <X> —
несколько минут”. Nothing to analyze (no passport, neither a game nor a
screenshot) — ask with a line for a game, screenshot, or video; for feel a
screenshot is not needed — the dialog “<тема>: есть игра-образец?” —
`Без образца, по вашим словам (Recommended)` / `Назову игру`; “без
образца” — `reference` writes the passport from the owner's words and the
template's components (in «Образцы» — “нет — выбор по вариантам”: the
variant will be chosen by `/studio/start` by the words), then — **Ask**.
Still no reference — the item `[ждёт образца]`, into «Решения» of
`BLOCKED.md` — “Образец <тема>: нужна игра (у ощущения) или скрин, видео
(у вида)”.

**Analysis** — a fresh `reference` agent, one per reference, up to three
at once (several subagent calls in one message). The message: the topic
and the work kind — judged by the eye `вид`, by playing or by ear
`ощущение`, rules and numbers `механика` (for feel the agent looks for
numbers: wikis, analyses, measurements from video — with reliability;
video — by link); the owner's words verbatim, the whole text and the
articles; images pasted into the chat — «найди свежие в папке images
сессии: <что на них>» (or paths); the named games, mods, videos; the
project's engine; the full paths of `.opencode/studio/templates` and the
technique library `.opencode/studio/reference/LOOK_TECHNIQUES.md`. For
`вид`, before the passport, the agent captures our frame of the same topic
with the stand (no stand — a screenshot with a note) and writes «Разрыв: у
нас … / у образца …» by the base's components, «У нас: приём: <имя> · <где
в коде>» or “не решено — проверить вариантом <приём A> / <приём B>”,
«Главное впечатление» first, «Чем делаем: код | файл | инструмент» in the
header; «совпадает» without `принят кадр` and a whole concept frame in
«Образец для листа» — reject (`refs_check.py` code 1). «Разрыв» is written
here once: in `/studio/start` there are no new readings of images.
Afterwards — verify that all topics are in «Темы» of `docs/refs/INDEX.md`,
add the missing lines. The result “мерить нечем: нужна Pillow” — into the
dialog the question “Поставить Pillow, чтобы мерить свет и цвет
образцов?” — `Поставить (Recommended)` / `Пропустить`; “yes” — `python -m
pip install pillow` with a time limit, a line into «Окружение» of
`docs/TESTING.md`.

**Ask** — only the unsaid. What is named in the owner's words (a text, a
spec, a parts list, an article he told you to take) — the answer:
`Важно владельцу: да — слова <дата>`, his “do not” — into «Чего не берём»;
without a dialog and `BLOCKED.md`. The dialogs “Что вам нравится в
<образец>?” and “Я вижу на снимке” — only if the words do not say what
matters to him (he gave only a game or a screenshot; otherwise what is
seen in the screenshot — `не спрошено`); the answers — components in look
words, not variants, the stand, the axes (the executor decides those). A
former reference or a topic choice (`DECISIONS.md`, the etalon,
`[предварительно]`) replaced by this message (a new topic reference,
“финальное”, “теперь”, “вместо”) — not a dispute: into the passport's
«Противоречия» — “заменено <дата> словами «…»”, into the look etalon
(`INDEX.md`, «Правила проекта», for example `docs/VISUAL_TARGETS.md`) —
“заменено <дата> словами — docs/refs/<тема>.md”, into `DECISIONS.md` — the
entry “заменяет <прежнюю>”, into «Принято по умолчанию» — “<прежний>
заменён <новым> — ваши слова; пометки: <файлы>”; the former reference's
numbers in code (grep by decision number and the former game's name) —
with a «Противоречия» line of the passport and the `[код]` item “Снять
числа старого образца <тема>” into the queue. The passport's «Чем делаем»
is disputed (changes on the fly or requires digging → code; does not
change → a file; a tool — only with a `DECISIONS.md` decision) — one dialog
“<тема>: чем делаем?” with a recommendation by the rule, the answer — into
the passport's header with the date. Against a decision about the setup or
a technique (`DECISIONS.md`, a shape rule) — not a dispute and not a
replacement: the look within its limits («Противоречия», the item's «Не
входит», «Принято по умолчанию»), changing — `/studio/idea` separately.
Words against a reference named in general (“ближе к Genshin”), or two of
his references with the difference visible to the eye — without a dialog:
“покажем оба — выбор по листу” into the passport's «Противоречия»
(`/studio/start` takes the side of his words); not visible, or it
contradicts a confirmed choice (the passport, an accepted frame,
`DECISIONS.md`) — a dialog. **Outside the reference** — only what cannot
be derived from the words, the reference, or the «Правила стиля» of
`INDEX.md` (a variant axis at an hour or angle the reference does not
have: the reference is evening, but what about daytime?), — into the
queue, with a question in the reference dialog or that of section 6
(rare; derivable — «Решено за вас [видно]»); the answer — «Слова
владельца» and `Важно владельцу: да — слова <дата>`: in `/studio/start`
there are no choice dialogs. Before the dialog — the passport's path and
images (the owner's screenshot, 2–3 reference frames; for feel — numbers)
or the file's path; the questions — «Вопрос владельцу» blocks of the
results, ≤ 4 (does not fit — «Решения» of `BLOCKED.md`), `(можно
несколько)` — `multiSelect`; the dialog — before the section 6 dialog.

**Answer** — into the passport: the chosen components — `Важно владельцу:
да`, the unchosen of the offered — `нет`; what was chosen in the
screenshot — into «Что берём» of its «Образцы» lines; the answer about a
contradiction — into the passport's «Противоречия» (between topics — and
`INDEX.md`) as resolved, with the date; the notes — into «Слова владельца»
verbatim with the date; a line into «Журнал»; the state `подтверждён
владельцем <дата>` (and without a dialog — the main thing is said in
words) — in the passport and in «Темы» of `docs/refs/INDEX.md` (and
«Главное для владельца»); the topic's items `[ждёт образца]` — `[можно]`,
if nothing else waits (`[вид]` not of the global look while light is
unaccepted — `[ждёт света]`, section 7). Empty or “пока не знаю” — the
passport stays `черновик`, into «Решения» of `BLOCKED.md`: “Образец
<тема>: что вам нравится? — `docs/refs/<тема>.md`” (`/studio/need` will
ask); the topic's item until confirmation — `[ждёт образца]`.

**A complaint about the look or feel of a topic whose passport is
confirmed or `принят кадр`** — the dialog “<тема>: что не так по сравнению
с образцом?” — `multiSelect` over the topic's four groups from «Группы для
окон» of `.opencode/studio/templates/docs/refs/_topic.md`; the selection
and the note — verbatim into the passport's «Журнал», the `[вид]` or
`[ощущение]` item — by them. A screenshot from the chat — into
`docs/refs/<тема>/owner-<дата>-<n>.<ext>` (where it lies and how to shrink
it to 2560 px — `.opencode/agents/reference.md`, steps 1–2), the path and
the place (the line via F3 from the game) — into the item's «Как увидеть».

**Пересмотр приёма** — the «Решения» line of `BLOCKED.md` “Пересмотр
приёма <тема>: «<заметка>» — `/studio/idea приём <тема>`” (written by
`/studio/done` after a rejection with a note about the способ) or
`/studio/idea приём <тема>`: not the reference, but the способ. A fresh
`reference` «концепт: приём» by the note against the sheet
(`docs/refs/<тема>/sheet-…`): the library first, the web — only when it
has no technique; the owner's words “как в реальности” — a search for
articles about the real subject (how mountains are built, where the color
of clouds comes from). It appends the next technique to «Как сделано у
образца» and «У нас:»; the item — `[можно]` (light not accepted — `[ждёт
света]`, section 7) with a new first axis “различаются приёмами: <имя> /
<имя>”, the `BLOCKED.md` line removed, into «Принято по умолчанию» —
“<тема>: следующий приём — <имя>”; light accepted after that sheet — the
first piece “переснять отвергнутые варианты в принятом свете”. No dialog
for the owner; `[ждёт образца]` — only by his words “образец другой”.
