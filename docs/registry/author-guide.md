# Гайд автора плагина

Как попасть в каталог GnomeCode и что несёт запись реестра.

## 1. Что такое плагин

Один TypeScript-файл — плагин формата OpenCode: хуки `tool`/`command` и
`event`. Движок читает файл при старте; GnomeCode скачивает его из вашего
репозитория по записи каталога.

## 2. Декларация в каталоге

Каталог — `index.json` в репозитории
[Metalismaticus/gnomecode-catalog](https://github.com/Metalismaticus/gnomecode-catalog).
Запись:

```json
{
  "id": "github",
  "version": "1.4.2",
  "artifact_url": "https://raw.githubusercontent.com/…/index.ts",
  "sha256": "<64 hex — хэш файла артефакта>",
  "permissions": [
    { "category": "Network", "value": "api.github.com" },
    { "category": "Write", "value": "ask" }
  ],
  "scopes": ["chat", "project"],
  "commands": [
    { "name": "issues", "description": "Показать issues", "category": "Network" }
  ],
  "icon_url": "https://…/icon.png",
  "permission_descriptions": {
    "Network": "ходить в сеть — читать issues через api.github.com"
  }
}
```

Поля:

| Поле | Обязательное | Что это |
|---|---|---|
| `id` | да | Имя npm-пакета: латиница/цифры/дефис, можно `@scope/name` |
| `version` | да | Semver (2.10.0 > 2.9.0; prerelease младше релиза) |
| `artifact_url` | да | Ссылка на файл плагина (raw-ссылка на main) |
| `sha256` | да | Хэш файла; клиент сверяет перед установкой/обновлением/откатом |
| `permissions` | нет | Права сцены H: категория (`Read`/`Write`/`Network`/`Terminal`) + значение |
| `scopes` | нет | Скоупы подключения: `once`, `chat`, `project`, `global` |
| `commands` | да (≥1) | Команды-кнопки шапки чата; `category` — правило вызова |
| `icon_url` | нет | Иконка карточки |
| `permission_descriptions` | нет | «Зачем» по категориям — текст сводки прав |

## 3. Подача

PR в репозиторий каталога: запись в `index.json` + файл плагина в вашем
репозитории. CI проверяет `index.json` против
[registry.schema.json](./registry.schema.json). Права объявляйте честно —
сводка прав показывает их владельцу до включения, а слой прав исполняет
вызовы по правилам категорий.
