# GnomeCode

Русская версия: [README.ru.md](README.ru.md)

<!-- studio:begin pitch -->
Desktop AI coding client for Windows: multi-model chat over the OpenCode core, tied to your projects, with two-click plugins and per-chat security.
<!-- studio:end pitch -->

<!-- studio:begin status -->
- **Now:** Stage 1 — the app window opens: three columns, chat with a streaming model, project files, plugin buttons in the chat header.
- **Next:** Stage 2 — the full plugin experience: the plugin section, permissions, and automatic GitHub updates at launch.
<!-- studio:end status -->

<!-- studio:begin features -->
## What works

- Nothing playable yet: Stage 1 is in progress.
<!-- studio:end features -->

<!-- studio:begin run -->
## How to run

Requires Windows 10/11 x64, Node 22 and npm, Rust (rustup), Python 3.13 with Pillow, and the OpenCode CLI for the AI core.

```bash
npm install
npm run tauri dev    # opens the app window
```

Quick build check: `npm run build` and `cargo check` (in `src-tauri/`).
<!-- studio:end run -->

<!-- studio:begin shots -->
<!-- studio:end shots -->

<!-- studio:begin release -->
<!-- studio:end release -->

<!-- Your own text goes anywhere outside the studio:begin / studio:end
markers: studio never changes it. -->

## Docs

- `docs/SPEC/plugins.md` — plugin system spec (installation, chat-level attachment, scopes, security)
- `docs/SPEC/phase2.md` — Phase 2 spec: workspaces, skills, context packs, tasks, Legal/GameDev domains
- `docs/DECISIONS.md` — architecture decisions (ADR)
