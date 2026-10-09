---
name: studio-retro
description: Follow the original studio retro process with stage-local context. Use for /studio/retro.
---

# /studio/retro

Bind this primary chat as `development` using studio_workflow.

Read the introductory chapter, then each chapter **when that stage is reached**.
Do not load all chapters at once; cross-references use this table.

- `.opencode/studio/protocols/commands/retro/00.md` — Вводные правила
- `.opencode/studio/protocols/commands/retro/01.md` — 1. Собрать факты
- `.opencode/studio/protocols/commands/retro/02.md` — 2. Найти повторяющееся
- `.opencode/studio/protocols/commands/retro/03.md` — 3. Развести уроки по адресам
- `.opencode/studio/protocols/commands/retro/04.md` — 4. Показать и принять

**Фазы пунктов по данным.** Before reading opinions, compute where the batch's
time went: for each closed task take `studio_workflow get` and diff the
`history` timestamps — `begin→submit` is implementation, `submit→review` is
review, `verify-start→verify-finish` is verification (wall clock). Present one
line per item: `id · impl Xm · review Ym · verify Zm · rounds N`; items with
2+ rounds and review-dominant time are the circle suspects: check whether the
notes lacked the four parts or the round re-opened scope instead of verifying
the stored notes. Fix propagation goes to the delta-review rules, not to
opinions.

**Токены на пункт.** Run `python -X utf8 tools/ops_report.py --tokens`: it
sums the model-token ledger (`usage/studio-usage.jsonl`, rotation included)
per agent and per session. Map sessions to items through each task's history
(`studio_workflow get`): `begin` entries are the worker sessions, `review`
entries the reviewer sessions; the coordinator session spans the whole
batch — report it as one batch line. Extend each item line with
`· worker+reviewer <tokens>`, show the coordinator total once, and compare
plugin versions by these numbers, not vibes.

**Дефекты → проверки.** List every user bug fixed in this batch and ask for
each: which permanent check now fails on this defect class (a file the
registry finds by itself)? A fix without its check leaves the circle open —
it goes into the report as a debt, not an opinion.

Original feature rules remain in force. API routing comes from the studio
coordinator and role skills; no old instruction may bypass runtime gates.
