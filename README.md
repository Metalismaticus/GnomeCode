# GnomeCode

> Идеи. Код. Результат. — ИИ-партнёр в разработке: несколько моделей, единое рабочее пространство.

GnomeCode — настольное приложение: чат с AI-моделями, привязанный к проектам,
с системой плагинов (включая OpenCode/MCP-совместимые) и политикой безопасности на уровне чата.

## Структура

- `docs/` — документация проекта
  - `docs/SPEC/` — сценарии и спецификации фич
  - `docs/refs/` — дизайн-референсы
- `.opencode/` — agents/commands/skills для разработки через OpenCode

## Ключевые документы

- [Спека: система плагинов](docs/SPEC/plugins.md) — установка, подключение из чата, скоупы, безопасность
- [Спека: Фаза 2](docs/SPEC/phase2.md) — Workspaces, Skills, Context Packs, Tasks, Artifacts, домены Legal/GameDev
- [Решения (ADR)](docs/DECISIONS.md) — ядро, бренд, стек

## Стек

- **Ядро:** OpenCode server (HTTP API) — агентный движок
- **Клиент:** Tauri 2 (Rust) + React + TypeScript
- **Темы:** тёмная (Codexis-референс) и светлая (OpenCode PRO-референс)
