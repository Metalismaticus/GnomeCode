# Steps 1, 2, and 5 — the conversation

Dialogs — per `ASKING.md` (`.opencode/studio/reference/ASKING.md`): the
question is self-sufficient, 2–4 options, the recommended one first with a
reason; after the answer — «Понял: …» and the entry into
`docs/SETUP-PLAN.md`. Facts (hardware, versions, what is installed, what can
be found by searching) — do not ask.

## Step 1. What the owner arrives with

One dialog, two questions:

- «Где вы сейчас с идеей игры?» (header «Замысел»):
  - «Идеи нет» — I will ask what you like to play and offer 3 short concepts;
  - «Идея смутная» — we will assemble it by choosing from options;
  - «Идея ясная» — I will ask only what is missing;
  - «Уже есть наработки» — I will read them first, then ask.
- «Как стартуем: быстро или подробно?» (header «Старт»):
  - «Быстрый старт (Recommended)» — up to 4 rounds of questions, a one-page
    brief, a game window today;
  - «Подробно» — up to 7 rounds, all documents filled in.

An app or a service instead of a game — the same questions in its words. The
existing material — read it before the questions (there is code — the
"existing" mode, `existing.md`).

## Step 2. The story

In one message, not a dialog (the answer is free-form): «Расскажите своими
словами и принесите всё, что есть: игры, на которые похоже, скрины (можно
вставить в чат), ссылки, заметки». With «Идеи нет» add: «во что любите играть
и что в этом цепляет».

The answer — **verbatim** into `docs/SETUP-PLAN.md`, section «Слова
владельца» (a temporary file will survive context compaction and a break).
Write out alongside: the games, mods, films, videos, links named — references
for step 4 ("like in X" about controls, camera, sound — feel references); how
many images were pasted into the chat; hedges («наверное», «кажется») — with
the `[предварительно]` tag on the phrase.

## Step 5. Rounds of dialogs

A round — one dialog, ≤ 4 questions. Options — guesses from the story, the
reference passports, and the facts of step 3, not a generic list; do not
re-ask what was said. The next round follows from the previous answers
(ASKING, p. 8). The concept contradicts itself, the platforms, or the
hardware — say so in «Понял» and ask in the next round.

| Round | Questions |
|---|---|
| (a) | genre; camera and angle (first-person / over-the-shoulder / top-down / side view); platforms — what must work from day one; size (an evening / a week / months of play) |
| (b) | the 30-second loop: player verbs (`multiSelect`); the goal and the failure; session length |
| (c) | references — `refs.md`, p. 4: per theme, where the owner's words do not say what matters to him — «что вам нравится» (`multiSelect` of components in the look's words); the main reference; the stylization scale (Мультяшно / Стилизованно / Полуреализм / Реализм). ≤ 2 dialogs, counted as one round |
| (d) | the stack — a recommendation from the step 3 facts (what is already installed, which GPU) with a reason and a backup with its price, do not push; «проба стека» as the first item if the core is constrained by performance (large worlds, voxels, crowds); for a game — the players' computers (below). An engine chosen that is not in `env_check` — immediately the installation dialog per `env.md`, p. 3–4 |
| (e) | order executors; how many items to write at once, when checks will run (2 (Recommended) / one at a time); git — the language of commits and README (below), repository privacy (only if there is a remote and `gh` did not tell — `env.md`, p. 5), large files into LFS — only if git-lfs exists. ≤ 2 dialogs, counted as one round |

The players' computers (round (d)), a game only — this is the owner's
decision (who will be able to play), not technique. Two questions; options,
numbers for descriptions, and the source — «Цели для игроков» of the
`docs/TESTING.md` template («Бюджет производительности»); the answer — there
at step 8, with a date, and into `levels` of `tools/perf_ref.json` (the level
benchmarks change together). Example:

- «На каком самом слабом компьютере игра должна идти — 1080p, низкие
  настройки, 30 кадров/с?» (header «Слабый ПК») — «Класс GTX 1060 / RX 580
  (Recommended)» — 4 ядра, 8 ГБ; так ставят планку похожие игры / «Слабее:
  GTX 1650, встроенная графика» — играть смогут больше людей, на низких
  проще картинка / «Сильнее: RTX 2060 / 3050» — низкие красивее, часть
  игроков отпадёт;
- «На каком компьютере игра должна идти плавно на высоких — 1080p, 60
  кадров/с?» (header «Хороший ПК») — «Класс RTX 3060 / 4060 (Recommended)» —
  6–8 ядер, 16 ГБ; самые частые видеокарты в Steam / «Класс RTX 2060 / 3050»
  — плавно у большего числа людей, высокие скромнее / «RTX 4070 и выше» —
  высокие богаче, плавно — у меньшего числа людей.

The level CPUs in `levels` do not depend on the option (as in Minecraft Java
2026): the weak one — i3-10100 / Ryzen 3 3100, the good one — i5-12400 /
Ryzen 5 5600. A benchmark not in the table — a row from PassMark with a URL
and date, the note «оценка».

Do not ask about the owner's machine (ultra, at his monitor's refresh rate) —
from step 3, with the «Решено за вас» line; his earlier decision about speed
(`DECISIONS.md`, `CONCEPT.md`) outweighs the default. He has another, weaker
machine (a laptop) — the line «Не блокер» in `BLOCKED.md`: «калибровка на
<машине>: `/studio/check замеры` на ней, когда под рукой» (without a dialog).

Order executors (round (e)) — what the owner has: manual orders only; an
OpenAI API key in the environment (`api` for images — paid and separate from
the ChatGPT subscription); a Claude Design login (`claude-design` for
mockups). Enable only what is named; do not ask for keys or passwords. Music
is made by a generator — a question about its plan (follows from an answer —
can be the next dialog): the free one has non-commercial rights, a paid
subscription does not grant them retroactively; the answer — into the
passport `docs/orders/music.md`.

Git (round (e)) — two questions; the answers — into «Git» of `AGENTS.md` (the
rules — `.opencode/studio/reference/COMMITS.md`):

- «На каком языке писать описания изменений (коммиты) в истории проекта?»
  (header «Коммиты») — «English (Recommended)» — на GitHub историю поймёт
  любой, отчёты вам — всё равно по-русски / «Русский» — история по-русски;
- «Описание проекта для GitHub (README) — на каких языках?» (header
  «README») — «en + ru (Recommended)» — README.md и README.ru.md,
  обновляются вместе / «en» — только английский / «ru» — только русский.

A project with a commit history — add to the «English» description «старые
останутся как есть».

**«Идеи нет»** — the first round is the dialog «Какой замысел ближе?» of 3
pitches from the owner's favorite games (one line each: genre, the main verb,
what hooks); mixing them — as a note.

**Quick start** (≤ 4 rounds): (a), (b), (c), then (d) and (e) in one dialog —
the stack, executors, the commit language, README; privacy needed (`env.md`,
p. 5) — it replaces README, and README — `en + ru` `[допущение]`. For a game
the players' computers — as one question instead of README: «Для каких
компьютеров делаем игру?» — «Как у большинства игроков (Recommended)» (both
levels by default) / «Ниже: слабые ноутбуки» (the weak level — GTX 1650,
smooth — RTX 2060 / 3050) / «Выше: новые видеокарты» (the weak level — RTX
2060 / 3050, smooth — RTX 4070); privacy then — instead of the commit
language (`English` `[допущение]`). The rest — «Решено за вас» (write in
twos, without LFS). The chosen stack's engine is missing — after this dialog
the installation per `env.md`, p. 3–4. What is not done, look and sound — as
assumptions `[допущение]` in the plan: the owner will amend them at step 7.

**Detailed** (≤ 7): (a)–(d) plus up to two own rounds — «чего не делаем»
(`multiSelect` of 3–4 candidates, the checked ones — deliberate rejections);
«что нужно из графики, музыки, звуков, макетов, текстов — и чем вы это
делаете»; concept contradictions.

The branch — `main` unless the owner named another: «Решено за вас».
