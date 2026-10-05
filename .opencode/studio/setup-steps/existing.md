# An existing project: read first

Before the first question, establish the facts (a large codebase — with a
researcher subagent, so as not to pull files into the context):

- the stack and versions — from manifests and configs (`project.godot`,
  `package.json`, …), not by file extensions;
- how it launches and builds — from scripts, README, CI;
- which checks already exist, what they are called, and **whether they
  work**: run them. Trust the exit code after verification — break one on
  purpose and see whether it became non-zero;
- what the product can do — by entry points, screens, scenes, routes: this
  goes into «Что работает» of `CONCEPT.md`, every system with a path in the
  code;
- where content and assets live, what they are called; whether there are
  already reference images;
- the branch, the remote repository, the language of commit messages, whether
  `.gitattributes` exists.

Do not record the unproven as fact: `?? нужно подтверждение: …` in the
document and the question into «Решения» of `BLOCKED.md` (except code
architecture — that is technique, see step 8).

## Amendments to the steps

- **1** — do not ask «Где вы сейчас?» (there is prior work); ask «Как
  стартуем?».
- **2** — the same request, plus «что сейчас не нравится».
- **3, 4** — as in a new project.
- **5** — only what is invisible from the code and the owner's words. Do not
  ask about the stack — it exists; «проба стека» — if the owner complains
  about performance. Still ask the commit and README language (`talk.md`,
  (d)); the history's language — only in the description: «старые останутся
  как есть». A game — also the players' computers (`talk.md`, (g)) if the
  goals are not in the documents; the owner's earlier decisions about speed
  (`DECISIONS.md`, `CONCEPT.md`) — into «Цели для игроков», outweighing the
  defaults (`update.md`, p. 4).
- **6** — «Правила проекта» — from what the code already follows (scale,
  axes, import); a discrepancy with `3d.md` — by a question, not an edit.
- **8** — no existing file is overwritten; into the commit — only what
  `/studio/setup` created. An own README — blocks only by the dialog, as
  `update.md`, p. 7. `python -X utf8 tools/code_check.py --baseline` — the
  baseline of the current committed code: from this day it does not grow (no
  git — at step 12, after creating the repository and before the first
  commit). The engine's warnings (`[debug]` Godot, `Nullable` C#) — **do not
  enable silently**: the quick run will go red; that is cleanup (step 9), in
  «Здоровье кода» — the line «Типы движка: не включены». «Архитектура» of
  `CONCEPT.md` — only what the code already follows («Где что» — by entry
  points and folders; «Службы» — from `[autoload]`, empty — «нет»; «Новая
  система» — the recommendation by folders, with the «Решено за вас» line),
  otherwise `?? нужно подтверждение` — without a question into «Решения»
  (cleared by `/studio/retro` per «`[правило кода]` дважды»).
- **9** — first «Построить проверки продукта» or «Довести проверки»
  (`testing.md`; frame checks measured by a frames-per-second counter, or C#
  without optimization — the «замеры по бюджету» piece); the world judged by
  eye — «Стенд вида» next; a 3D world — «Настройки графики» (`3d.md`); then up
  to 5 `Уборка:` items (the selection — `update.md`, p. 9; the example —
  «Подробности» of `ROADMAP.md`; the testbed not `есть` — `[ждёт проверок]`);
  after that — by the owner's words, do not push a vertical slice. A
  complaint about the look with a reference — an item `[вид]` per the
  passport; about controls, camera, or sound with a reference — `[ощущение]`.
  Stage 1 — what the owner wants to see first; the systems from «Что
  работает» — as «Покрытия» rows with the state `работает` and stage `1`
  (Stage 1 stands on them; «Требует» on something working — not a forward
  dependency). The project's own plan (`*ROADMAP*.md`, `*PLAN*.md`) — also an
  occasion for the step 7 dialog about `/studio/roadmap`.
- **10** — do not create a skeleton: launch the existing project the way the
  player sees it, the screenshot `docs/refs/setup/first-frame.png` (Godot —
  `--write-movie`, `finale.md`), the dialog «Видите окно игры?». Do not touch
  the product's code; Godot without `docs/.gdignore` — create it.
