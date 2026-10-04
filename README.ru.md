# GnomeCode

English: [README.md](README.md)

<!-- studio:begin pitch -->
Десктопный ИИ-клиент для разработки на Windows: чат с моделями поверх ядра
OpenCode, привязанный к проектам, с плагинами «в два клика» и безопасностью
на уровне чата.
<!-- studio:end pitch -->

<!-- studio:begin status -->
- **Сейчас:** Этап 1 — приложение открывается окном: три колонки, чат со
  стримингом модели, файлы проекта, кнопки плагинов в шапке чата.
- **Дальше:** Этап 2 — полный сценарий плагинов: раздел «Плагины», права,
  автообновление с GitHub при запуске.
<!-- studio:end status -->

<!-- studio:begin features -->
## Что уже умеет

- Пока ничего: идёт Этап 1.
<!-- studio:end features -->

<!-- studio:begin run -->
## Как запустить

Нужны Windows 10/11 x64, Node 22 и npm, Rust (rustup), Python 3.13 с Pillow
и OpenCode CLI для ядра.

```bash
npm install
npm run tauri dev    # открывает окно приложения
```

Быстрая проверка: `npm run build` и `cargo check` (в `src-tauri/`).
<!-- studio:end run -->

<!-- studio:begin shots -->
<!-- studio:end shots -->

<!-- studio:begin release -->
<!-- studio:end release -->

<!-- Свой текст — где угодно вне меток studio:begin / studio:end: studio его
не меняет. -->

## Документы

- `docs/SPEC/plugins.md` — спека плагинов: установка, подключение из чата, скоупы, безопасность
- `docs/SPEC/phase2.md` — спека Фазы 2: Workspaces, Skills, Context Packs, Tasks, домены Legal/GameDev
- `docs/DECISIONS.md` — архитектурные решения (ADR)
