---
name: studio-godot
description: Work with the project's actual Godot version, scene graph, resource imports and player-input verification. Use only on Godot tasks.
---

# Godot project discipline

Read AGENTS, TESTING «Окружение», «Ловушки стека», launch/check commands and
the exact engine version. Godot documentation must match that version:
Context7 if connected, otherwise the matching official docs or engine-notes.
Inspect existing scenes, autoloads, resource ownership and node paths first.
Respect axes, scale, typed data, chunk lifecycle, save format and code ratchets.
Use load_all.gd or the project's actual quick check for parser/resource errors;
headless checks cannot prove rendering or gameplay feel. Player actions use
input scenarios. Screenshots use the owner's location, seed, time and preset.
GPU tests follow the project's no-focus/no-sound window policy and heavy-test
limit. Measure only with the documented protocol; no average FPS as a substitute
for its frame-time criteria. Shader tasks also load studio-godot-shaders.
Do not introduce an engine upgrade, second camera per effect or heavy simulation
unless the task and measured budget justify it. Technical details stay in the
card/report; the owner's question concerns what the player experiences.
