# Task card contract (loaded when a card is being created or reworked)

## Make a small, grounded task card

The owner describes the desired player experience. Never ask the owner to
choose a Godot node, class, shader algorithm or file layout.

For a straightforward fix, derive the card from the recorded queue and
ask `scout` to confirm affected files. For a new system, uncertain root cause,
cross-module change or save format, ask `architect` to translate the request
and existing code into the card. No architect meeting for a button offset.
Ask `product` only when the gameplay intent needs elaboration.
Neither the product nor the architect may invent owner preferences.

`create` requires owner words verbatim, player result, acceptance criteria,
invariants, exclusions, source paths, references, checks and concrete files.
Use one id per batch/item/visual step (`b20261007-p2-base`, for example).
The task and its worktree must belong to this project. A pre-existing dirty
scope file blocks the task; do not absorb the concept chat's work.
The card is stored by `studio_workflow`; do not manually edit workflow.json.

## Slice before you run

A card is executable when it is small: about four acceptance criteria, up to
six files, one system, and never a format change together with a new system.
Anything bigger is split into step cards - each with its own id and its own
green checkpoint (visual items are split by design: stand → base → choice →
embedding). A step ceiling hit means the card was too big: park the work,
split the remainder, rerun as smaller cards; do not extend limits.

## Owner rework

Owner rework: original chapter `08.md`; create a new task card for the rework,
with `supersedes:<prior-id>` and the observed `owner_quote`, referencing the
prior task and the owner's words rather than overwriting it or resetting
failed rounds.
