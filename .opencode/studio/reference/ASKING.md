# How to ask the owner

Shared rules for all studio commands that involve questions. The skill references this file in one line and does not copy the rules. The owner is not a programmer. The environment is OpenCode: **the `question` dialog — the built-in `question` tool**: a short `header`, the question and the options (label + description «что будет, если выбрать»), `multiple` — selecting several, a free-form answer («напишите словами») is always available. All rules about the "dialog" below are understood this way.

## Rules

1. Any question with a choice — the dialog: the `question` tool. Before the dialog — only a short explanation (≤ 5 lines) and a summary after. Anything long — into a file; into the chat — its path.
2. Ask only about the owner's decisions: concept, taste, priority, acceptance, money, the irreversible; the order of stages and the makeup of the first version are his too. The irreversible — player saves and data, what is released, money; deleting code, a worktree copy, or a file that stays in git and can be reverted — is not it. Find the facts yourself; decide the technique yourself and name it with the «Решено за вас» line. Technical queue items — checks, bugs, measurements, code cleanup (`Уборка:` — moving, one worktree copy instead of two, a file in parts, the record type of a single entity), including those from dev notes, — are not offered to the owner in a dialog: the chat sets them itself and names them in one line in «Принято по умолчанию». Rewriting the whole system is not cleanup but an owner decision via `/studio/roadmap`. Order and manner of work — what first, how to show it, which frame to capture, how to get around an obstacle — also not a question: in `/studio/start` the coordinator takes the recommended option and writes it into «Принято по умолчанию» in `docs/BATCH.md`, and into the report the line `Решил сам: пункт N — <что> — <почему>; отменить — при /studio/done` (for a whole batch — `партия` instead of the number; the agent — in «Решено за вас»). Player hardware after the render trial is also that: a consequence of the new render for the project rules (the minimum per measurement) is named with the «Решил сам» line, not asked in a dialog. **Which variant is closer to the reference is not a question**: comparing against the reference is the agents' work; the coordinator chooses the `[вид]` and `[ощущение]` variant (`/studio/start`, 3b); the owner judges the result in `/studio/done` — accept or reject in his own words.
3. Dialog: 1–4 questions, 2–4 options. Do not add «Другое» — it exists by itself, with a note field. Several selectable — `multiple` on the question. More than four options — split across questions evenly (5 = 3 + 2); one left over — a plain question «<суть>: …?» with two options. In a `multiSelect` where «ничего» is a legal answer («что оспорить», «какие пункты принимаете»), **«ничего» — an explicit option**, not an empty selection: an empty `Submit` is unclear to the owner. If «ничего» is the expected answer («Всё так, ничего не менять»), it is first and `(Recommended)`; otherwise — last («Ничего из этого»). Then the other options in the question — up to three. Chosen together with others — the others count. Do not ask an abstract «что вам не нравится?» without a concrete choice in a dialog: a question — only with options understandable without explanations; otherwise — lines as text and «Не так — напишите …» (`/studio/done`, «Решено без вас»). The owner named the answer himself («только 1», «кроме 3») — no dialog about it.
4. The question is self-sufficient (`header` — not a retelling of the question): the item number and the gist in the question text. Question texts within one dialog differ — answers are bound to the text. `header` required: ≤ 12 characters.
5. label — 1–5 words; description — one line «что будет, если выбрать».
6. The recommended option — first, the label ends with `(Recommended)`, the reason — in the description. A taste that can be derived neither from words nor from the reference (`/studio/idea`) — without `(Recommended)`.
7. «Пока не знаю» — a legal answer: the question goes to «Решения» `BLOCKED.md`; the irreversible is not done by default.
8. No more than two dialogs in a row if the next does not follow from the answer to the previous; after that — a summary "recorded thus-and-so". A chain where a question follows from an answer (`/studio/done`: choice → reasons → pass over the items) is not limited. `/studio/roadmap` — no more than two question dialogs and the «Принять» dialog (with a question about someone else's plan file); a contradiction in the concept core or «Какой замысел главный?» — one more dialog; «Поправить …» and «Ещё поговорить» after «Принять» follow from the answer; the rest — as assumptions.
9. After an answer — the line «Понял: …» and the entry **verbatim** into the needed document (the owner's notes — verbatim too).
10. Images — never in the dialog: first the file path (the owner opens it himself, full size); then the dialog. `[вид]` frames and trials in `/studio/done` — full screen in the viewer; the game or the `[ощущение]` stand — opened by the chat itself before the «что принимаете?» dialog (`/studio/done`, section 2).
11. Subagents do not ask: they have no tool. An answer needed — a «Вопрос владельцу» block at the end of the summary; the coordinator turns it into a dialog without retelling (in `/studio/start` — first per steps 2 and 12):

    ```
    Вопрос владельцу: <вопрос одной строкой, самодостаточный, словами продукта>
    - <вариант> (Recommended) — <что будет, если выбрать>
    - <вариант> — <что будет>
    Пока нет ответа: <что агент сделал или что делать дальше без ответа>
    ```

    `Вопрос владельцу (можно несколько): …` — a question with `multiple`; several options can be chosen at once; `(Recommended)` in such a block is not required.
12. **`/studio/start all` runs unattended:** the owner gave the command and left. After a batch is taken there are no dialogs until the end of the run, and the work does not wait for an answer:
    - a "what to do" question (concept, taste not from a picture, priority, money, the irreversible) that surfaces in a batch — the item `ждёт: <вопрос>`, the question — as a line into «Решения» `docs/BLOCKED.md` for the scenarist — the concept chat (`— /studio/need`; needs an analysis or a new reference — `— /studio/idea …`), the batch proceeds with other items; in the report — «Вопросы в сценарист: N — /studio/need», not a dialog. A single `/studio/start` asks immediately;
    - dialogs — only at the end of the run, no more than two, and only what can neither be decided without the owner nor postponed (rare). Choosing a variant and a pair of trial frames is not among them — neither at the end nor along the way: the coordinator chooses the variant (step 2; the «покажем оба» axis — per the owner's words), the owner judges the look in `/studio/done`. Measurements — no dialog: the coordinator measures himself. Questions accumulate in «Вопросы владельцу» `docs/BATCH.md`; unanswered ones stay there, `/studio/done` moves them to `BLOCKED.md`.

    For a batch to have something to do, "what to do" questions are asked by the scenarist before the run: `/studio/idea` sets `[можно]` only for an item without open questions (the `[предварительно]` caveat — also a question); a preference that can be derived neither from words, nor from the reference, nor from «Правил стиля» — there too, before the queue (rare).
13. **The look — in product words, no technique.** A pair of trial frames (a render change, an expensive capability) — not a dialog: `/studio/done` opens it full screen with the line «на вашем ПК тянет / не тянет (по замеру); на слабых — неизвестно», the number table — into the report. The target frame (`/studio/need`, once per frame, in the concept chat): «Кадр-цель <тема>: это место должно выглядеть так?» — `Да` / `Нет: …` (a note — what is wrong) / `Без кадра-цели`; before the dialog — the paths of the target frame and our screenshot; the target frame — direction on light, palette, material and mood, not on geometry: geometry discrepancies — not a ground for `Нет`. No technical questions.

## Fallback path

- The dialog unsupported by the client or cancelled — the same question as a numbered list in the chat plus «или напишите словами».
- An empty answer or a cancel — repeat once; empty again — treat as «пока не знаю». Except `multiple`, where the skill named an empty selection as the answer («ничего»): that is an answer, do not repeat.
- «Другое» without text — ask in words and stop.
- A free-form answer instead of a choice — outweighs the options.

## Example

```
Пункт 3, ночь в игре: опасна?                   ← the question, header «Ночь»
- Да, выходят монстры (Recommended) — как в вашем замысле «выживание»
- Нет, только темнее — спокойная прогулка
```

Reports and questions — in product words: not "rebase", "ff-only", constant and code-file names, but what is visible and what will change in the game or app.
