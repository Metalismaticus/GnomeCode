---
name: studio-architecture
description: Ground a technical plan in the existing project and translate an agreed player outcome into a small task card. Use for uncertain or cross-system work, not routine fixes.
---

# Technical translation

Read the agreed owner words and criteria, AGENTS, relevant CONCEPT architecture,
DECISIONS, TESTING stack traps and the source files themselves. Verify facts by
code; do not design from filenames or remembered APIs. Search for reusable
implementations before introducing a system. Use studio-godot for Godot.

Return a card per `.opencode/studio/workflows/task-card.md`: existing entry
points and facts with paths, exact proposed files, practical implementation,
dependencies, automatic checks from TESTING and unresolved risks. Preserve
player criteria verbatim; do not replace "pleasant to chop" by "method exists".
For a large feature split into playable, independently reviewable slices.
No unnecessary design document or new abstraction for a one-file fix.
Choose nodes/algorithms yourself. Ask the owner only if the consequence changes
the agreed behavior, taste, priority, scope, money or irreversible user data.
No writes or test runs: this role maps and plans. Do not claim measured facts.
