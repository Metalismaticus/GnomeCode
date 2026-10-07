# Task contract (internal; the owner does not fill it)

The coordinator derives this card from the agreed original ROADMAP/BATCH,
using code facts from scout/architect. Source locations replace chat history.
Technical interpretation never overwrites the owner's words or prior rejection.

```json
{
  "action": "create",
  "card": {
    "id": "b20261007-p2-base",
    "batch": "2026-10-07",
    "item": 2,
    "step": "основа",
    "kind": "code",
    "title": "Дерево реагирует на удары",
    "owner_words": "Хочу, чтобы рубить дерево было приятно",
    "goal": "Игрок видит понятную реакцию на каждый удар",
    "player_result": "Удар оставляет зарубку; прочность уменьшается",
    "acceptance": ["Удар топором создаёт зарубку в месте попадания"],
    "invariants": ["Генерация и сохранение леса работают как прежде"],
    "out_of_scope": ["Падение дерева и распил — следующие пункты"],
    "sources": ["docs/BATCH.md#Пункт 2", "docs/ROADMAP.md#Подробности"],
    "references": [],
    "skills": ["studio-godot"],
    "depends_on": [],
    "files": ["game/trees/tree_damage.gd", "tests/tree_damage.gd"],
    "checks": [{"name": "быстрая", "command": "<реальная команда из TESTING.md>", "timeout_ms": 120000}],
    "how_to_see": "Лес у спавна: ударьте топором по стволу"
  }
}
```

Allowed kinds: code, bug, ui, visual, feel, data, cleanup, measurement.
`sources` must exist. Concrete files are planned internally; a required new
file is amended by the coordinator, with a reason, before the executor edits it.
No dirty pre-existing file may be included. Sources in Markdown remain authoritative
for meaning; the machine owns stage/round/roles/check evidence.
`checks:[]` requires `verification_limit`, visible in the final report.
Do not copy fake example paths or the placeholder command into a real card.
For setup scaffolding use batch "setup" and the existing SETUP-PLAN as source.
Visual/feel stand, base and choice cards use `owner_result:false`; the final
embedding uses `owner_result:true`. Dependencies on intermediate checkpoints
do not require the owner to accept every construction step separately.

Executor `submit` report:

```json
{
  "action": "submit", "id": "b20261007-p2-base",
  "report": {
    "files": ["game/trees/tree_damage.gd", "tests/tree_damage.gd"],
    "summary": "Ствол реагирует на удар",
    "red_proof": "<команда и симптом до исправления; либо причина неприменимости>",
    "checks": "<что реально запускалось и результат>",
    "how_to_see": "Лес у спавна: ударьте топором по стволу",
    "decisions": ["[техника] Повторно использована существующая система урона"],
    "limitations": [],
    "artifacts": ["<путь кадра, если критерий видимый>"],
    "visual_review": "Вижу: <реальное наблюдение; либо вид не проверен>"
  }
}
```

Card/report ids are returned by `studio_workflow get`; an agent has no permission
to masquerade as another role by putting `agent` or exit codes into this input.
Already implemented: `files:[]` needs `nothing_to_change` with the grounded
reason. Independent review and checks still apply; checkpoint records the
unchanged existing HEAD, without an empty commit or invented work.
Owner rework of the same batch/item/step uses `supersedes:<old-id>` and the
observed `owner_quote` in create. A fresh id alone cannot reset three failed
rounds. The old result remains in history and cannot be accepted instead.
