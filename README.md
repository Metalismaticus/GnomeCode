# GnomeCode

Русская версия: [README.ru.md](README.ru.md)

<!-- studio:begin pitch -->
Desktop AI coding client for Windows: multi-model chat over the OpenCode core, tied to your projects, with two-click plugins and per-chat security.
<!-- studio:end pitch -->

- **Now:** Stage 1 is done and accepted — the window, streaming chat over the OpenCode core, project files, plugins with first-use approval, persistence across restarts.
- **Next:** Stage 2 — the full plugin experience: the plugin section, permissions, and automatic GitHub updates at launch.
<!-- studio:end status -->
<!-- studio:begin features -->
## What works

- App window in three columns; dark and light themes switch the whole window.
- Chat with the OpenCode engine: the answer streams into the feed; tool calls
  and a dropped connection show as lines, not silence.
- Pick a project folder, browse its files in the panel and attach them to a question.
- Plugins from chat: the plus menu offers Connect plugin, commands become
  header buttons, and each command asks for approval on first use
  (Allow / Allow for this chat / Deny).
- Chat, theme and project folder survive an app restart; the engine session continues.
- One quick check command verifies the whole product; a built copy lands in `builds/`.
<!-- studio:end features -->

<!-- studio:begin run -->
## How to run

Requires Windows 10/11 x64, Node 22 and npm, Rust (rustup), Python 3.13 with Pillow, and the OpenCode CLI for the AI core.

```bash
npm install
npm run tauri dev    # opens the app window
```

Quick check of everything: `npm run check`. Full check suite: `python -X utf8 tools/run_checks.py`.
Built copies for trying without the dev setup land in `builds/`.
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
