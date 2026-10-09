---
name: studio-check
description: Follow the original studio check process with stage-local context. Use for /studio/check.
---

# /studio/check

Bind this primary chat as `development` using studio_workflow.

Checks run through the single entry `python -X utf8 tools/run_check.py
--root <путь> --mode <quick|item|affected|full|long>` (it owns the one build
dir per root/slot and the environment; the list lives in
`tools/check_plan.json`). Exit code 3 means low disk: stop and report the
printed reason, never loop rebuilds.

Read the introductory chapter, then each chapter **when that stage is reached**.
Do not load all chapters at once; cross-references use this table.

- `.opencode/studio/protocols/commands/check/00.md` — Вводные правила
- `.opencode/studio/protocols/commands/check/01.md` — 1. Прогнать
- `.opencode/studio/protocols/commands/check/02.md` — 2. Разобрать провалы
- `.opencode/studio/protocols/commands/check/03.md` — 3. Что делать с найденным
- `.opencode/studio/protocols/commands/check/04.md` — 4. Красное бывает правильным
- `.opencode/studio/protocols/commands/check/05.md` — 5. Чего проверки не видят

Original feature rules remain in force. API routing comes from the studio
coordinator and role skills; no old instruction may bypass runtime gates.
