# Сценарий: Фаза 2 — Workspaces, Skills, Context Packs, Tasks, домены

> Расширение существующей архитектуры GnomeCode.
> Базируется на: [спека плагинов](plugins.md) · [ADR-0001 — ядро OpenCode](../DECISIONS.md)
> Статус: спека принята, реализация не начата.
> Правило: оригинальную спеку не переизобретаем — интегрируем модульно.

---

## 0. Сдвиг продукта

GnomeCode перестаёт быть «AI-чатом» и становится **персистентной AI-рабочей средой**:

- проекты хранят знания;
- повторяемые воркфлоу становятся **Skills**;
- AI сам находит нужный Skill;
- профессиональные домены изолированы друг от друга;
- результаты работы становятся **Artifacts**;
- работа тянется через много чатов.

Ключевая идея: **Workspace важнее чата**. Чат — одна рабочая ветка внутри большого Workspace.

## 1. Сцена «Продолжение работы»

Пользователь открывает GnomeCode → выбирает Workspace (не чат). Внутри Workspace:

```
Workspace
├── Chats                — рабочие ветки
├── Tasks                — задачи, живущие дольше чатов
├── Artifacts            — значимые результаты
├── Knowledge            — что AI должен знать
├── Skills / Playbooks   — как выполнять работу
├── Resources            — файлы и материалы
├── Plugins              — подключённые возможности
├── Security Policy      — политика безопасности
├── Usage history
├── Project instructions
├── Model preferences
└── Context Packs
```

Одна тема работы тянется через много чатов — контекст не пересобирается каждый раз.

**Профили Workspace:** `General · Development · GameDev · Godot · Legal`.
Профиль задаёт дефолты, но **не хардкодит бизнес-логику в UI**. Новые типы Workspace добавляются без переписывания чат-системы.

## 2. Сцена «Изоляция доменов»

Критическое правило: домены не смешиваются.

- Legal Workspace не видит GameDev-навыки и знания.
- Godot Workspace не показывает процедуры проверки договоров.
- General не наследует узкоспециализированные воркфлоу автоматически.

Изоляция действует на: Skills, Knowledge, Context Packs, Resources, дефолтные плагины,
Project instructions, ранжирование поиска, рекомендации.

Пользователь может **явно** расшарить объект между доменами. Автоматический переход границ запрещён.

## 3. Персистентный контекст и Context Packs

### 3.1 Project Context

Живёт между чатами: описание проекта, архитектура, конвенции кода, техрешения,
правила геймдизайна, арт-стиль, юридическая терминология, правила компании,
ограничения, шаблоны, известные проблемы, одобренные подходы.

**Не заливается целиком в каждый промпт.** Только retrieval: AI подгружает релевантное, когда нужно.

### 3.2 Context Pack — первоклассное понятие

Переиспользуемый пакет знаний/навыков/ресурсов домена или проекта.

```
Context Pack: 3D Assets
├── Knowledge   → визуальный стиль, low-poly требования, naming conventions
├── Skills      → Create 3D model from reference, Create animal, Export to Godot
├── Resources   → Blender-шаблон, пресеты материалов, настройки экспорта
├── References  → примеры изображений, одобренные ассеты
├── Plugins     → Blender, Godot
└── Variables   → game_scale, target_polycount, output_folder
```

Уровни: **Global · Workspace · Project**. Пакет включается/выключается для проекта.

## 4. Knowledge ≠ Skills ≠ Resources

Не сваливать всё в одну кучу Markdown-файлов:

| Тип | Что это | Пример |
|---|---|---|
| **Knowledge** | что AI должен *знать* | архитектура, арт-дирекшн, терминология, конвенции |
| **Skills / Playbooks** | *как* выполнить задачу | «создать 3D-животное», «экспорт в Godot», «проверить договор» |
| **Resources** | *материалы* для работы | шаблоны, скрипты, референсы, датасеты, пресеты |

Три отдельных понятия в архитектуре и UI.

## 5. Skills — настоящие AI-навыки

### 5.1 Сцена «Автодисковери»

```
Пользователь: «Создай медведя для игры»
↓ AI понимает тип работы
↓ Skill Resolver ищет по метаданным реестра
↓ Найдены: Create Animal, Low Poly Game Asset, Quadruped Rigging, Godot Export
↓ Загружаются знания/ресурсы/плагины нужных Skills
↓ AI выполняет задачу по готовому воркфлоу
```

Пользователь **не говорит** «открой create_animal.md и следуй ему».

Правило для агента — перед импровизацией нетривиальной процедуры:
понять задачу → проверить, есть ли подходящий Skill → искать по метаданным →
загрузить релевантные → следовать/адаптировать → импровизировать только если ничего нет.

**Не** запускать Skill Search для тривиальных действий («переименуй переменную», «открой файл»).

### 5.2 Skill Registry и резолвер

AI **не** грузит полный текст всех Skills ради поиска. Лёгкие метаданные:

`name · description · category · tags · version · scope · compatible_workspaces ·
inputs · outputs · required_plugins · required_permissions · dependencies ·
last_updated · usage_stats · estimated_cost`

Сервисы (вне UI-компонентов чата):

```
SkillRegistry · SkillIndexer · SkillResolver
SkillLoader · SkillExecutor · SkillValidator · SkillVersionStore
```

### 5.3 Скоупы и поиск

Приоритет: **Chat → Project → Workspace → Global**.
Фильтрация по Workspace — **до** семантического ранжирования: не ищем в чужих доменах вообще.

Skill может поддерживать несколько Workspace:

```yaml
# Export Blender Asset To Godot
compatible_workspaces: [GameDev, Godot]

# Analyze PDF
compatible_workspaces: [Global]

# Review Supply Contract
compatible_workspaces: [Legal]
```

Global — только действительно универсальные навыки.

### 5.4 Формат Playbook

**Markdown — источник истины**, редактируется человеком. Опциональный frontmatter:

```markdown
---
name: Create 3D Model From Reference
version: 1.4
category: 3D
compatible_workspaces: [GameDev, Godot]
tags: [blender, modeling, game-asset]
plugins: [Blender, Godot]
permissions:
  filesystem: project
  terminal: ask
inputs: [reference_image, asset_name]
outputs: [blend_file, glb_file, godot_import]
---

# Goal
# Preconditions
# Procedure (Step 1..N)
# Validation (чек-лист)
# Recovery (если экспорт упал)
```

Никаких непрозрачных проприетарных форматов.

### 5.5 Параметризация вместо клонов

Не `create_bear.md / create_wolf.md / create_fox.md`, а один **Create Animal** с параметрами:
`species · reference · visual_style · polycount · scale · rig_type · animation_set · output_folder`.

### 5.6 Композиция

Skills зависят друг от друга. Create Animal использует: Create Base Mesh →
Validate Game Asset → Quadruped Rigging → Export To Godot.
Поддержать: зависимости, композицию, валидацию зависимостей, обнаружение циклов.

### 5.7 Режимы исполнения

| Режим | Поведение |
|---|---|
| **REFERENCE** | Skill — руководство, AI может адаптировать |
| **GUIDED** | AI делает шаги, останавливается на контрольных точках |
| **AUTOMATIC** | AI идёт до конца: успех / запрос прав / провал валидации / ошибка |

У каждого Skill — рекомендуемый дефолт; пользователь перекрывает.

### 5.8 Прозрачность

Если Skill влияет на исполнение — показать в чате:

```
Using Skills:
  Create Animal v1.7
  Godot Asset Export v2.1
```

Клик → почему выбран, версия, процедура, зависимости, права, ресурсы + «Disable for this run».
AI не следует скрытым сложным процедурам молча.

### 5.9 Валидация

«Done» от AI — не критерий завершённости. Skill определяет правила валидации:

- **GameDev:** модель существует, поликаунт в норме, нет non-manifold, масштаб верный, GLB экспортирован, Godot импортирует.
- **Код:** проект собирается, тесты зелёные, нет новых ошибок, изменены ожидаемые файлы.
- **Legal:** все секции проверены, даты/суммы извлечены, таблица рисков создана, утверждения с источниками, факты не выдуманы.

Статус валидации виден пользователю.

### 5.10 Самоулучшение и версии

После прогона сравнивается «процедура по Skill» с «что было на самом деле».
Если потребовались шаги, которых нет в Skill — предложение «Улучшить Skill?»
(Review / Ignore / Never again). Канонический Skill **никогда** не перезаписывается молча.

История версий: compare, rollback, «спроси AI что изменилось»; хранить автора,
время, summary, связанный прогон. Опциональные метрики: использований, успехов,
% валидации, ручные вмешательства, средняя длительность/токены/стоимость.

## 6. Создание и редактирование Skills с AI

### 6.1 Сцена «Save as Skill»

40 минут с AI дали рабочий воркфлоу → кнопка **Save as Skill** → GnomeCode извлекает
из разговора: цель, входы, выходы, плагины, права, ключевые решения, процедуру,
валидацию, частые ошибки, recovery, переменные → генерирует Markdown-Skill →
**дифф на ревью перед сохранением**. Молча канонические Skills не создаются.

### 6.2 AI-редактор Skills

Действия: Improve with AI · Normalize structure · Make reusable · Extract variables ·
Find missing steps · Add validation · Add recovery · Find ambiguity · Simplify ·
Explain · Compare versions.

Пример отчёта по старому файлу: «Шаг 4 без критерия завершения; Blender требуется,
но не объявлен; выходная папка захардкожена; recovery отсутствует; Godot-валидации нет».
Изменения — только через предпросмотр.

## 7. Task и Artifact — работа длиннее чата

### 7.1 Tasks

Задача живёт независимо от чатов, охватывает много чатов/моделей/дней:

```
Task: Improve procedural waterfalls
Subtasks: analyze → design → shader → test → optimize
```

Хранит: цель, статус, подзадачи, связанные чаты, артефакты, использованные Skills,
изменённые файлы, модели, стоимость, заметки о прогрессе. Сервис: **TaskStore**.

### 7.2 Artifacts

Персистентные значимые результаты: договор, заключение, техспека, 3D-модель,
архитектурный документ, отчёт, экспортированный ассет, код-пакет, анализ.
Метаданные: чат-создатель, проект, задача, модель, дата, исходники, Skills, версия, стоимость.
**Не** путать с временными вложениями чата. Сервис: **ArtifactStore**.

### 7.3 Checkpoints

Перед крупными AI-изменениями — checkpoint (git commit / stash / снапшот файлов).
После — review / accept / rollback. Откат плохой AI-операции должен быть простым.

## 8. Модели

### 8.1 Model Roles

Проект задаёт роли: Primary Developer · Vision · Code Reviewer · Cheap Worker · Research.
Назначение прозрачно: **никогда** не переключаться на платную модель молча.

### 8.2 Ask another model

Для важных ответов — «спросить вторую модель»: Compare · Critique · Merge best answers.
Где возможно — показывать ожидаемую доп. стоимость до отправки.

## 9. Provenance и Legal-домен

### 9.1 Источники

Для значимых выводов — «Sources used»: сообщение пользователя, файл проекта,
Knowledge, Skill, Context Pack, сайт, MCP, плагин, GitHub, правовая база.
В Legal-домене — обязательно.

### 9.2 Legal Workspace

Свои виды: Documents · Sources · Versions · Citations · Risks.
Воркфлоу: Review Contract · Compare Versions · Disagreement Protocol ·
Legal Research · Draft Document · Procurement Review · Package Review.

Три режима:

| Режим | Поведение |
|---|---|
| **Evidence Mode** | не выдумывать факты; разделять «источник / интерпретация / допущение»; при нехватке данных — сказать прямо |
| **Official Sources Only** | исследование только по настроенным авторитетным источникам; левые веб-источники молча не используются |
| **Confidentiality** | интернет по умолчанию выключен для конфиденциальных проектов; внешние плагины только по approval; чувствительные документы не уходят наружу без разрешения |

Всё — через существующую Security-архитектуру, не параллельную систему.

## 10. GameDev / Godot Workspace

Детект Godot-проектов. Специализированные виды: Files · Scenes · Nodes · Errors ·
Git · Runtime · Assets · Visual History.

Цикл разработки — **расширяемый воркфлоу**, не хардкод-скрипт:

```
правка кода → запуск Godot → сбор логов → скриншот → анализ → фикс → повторная валидация
```

- **Scene Context:** «спроси про эту сцену» — AI сам собирает .tscn, связанные скрипты,
  шейдеры, зависимости, ошибки рантайма, свежие логи, последний скриншот.
  Аналогично «добавь ассет в контекст» (модели, текстуры, шейдеры, материалы, скрипты, сцены).
- **Visual History:** визуальные чекпоинты (v12 → v13 → v14) со сравнением — для UI,
  террейна, воды, света, эффектов, персонажей, процедурной генерации.

## 11. «+» меню v2 и Tool Sets

Композер становится центральным способом добавления возможностей:

```
+
├── Files        → Attach file / folder / image
├── Context      → Context Pack · Knowledge · Skill / Playbook
└── Capabilities → Plugin · MCP Server · Tool Set · Internet · Terminal
```

- Рекомендованное — сверху; композер **не** захламлять постоянными кнопками.
- **Tool Sets** — сохранённые группы: «Godot Dev» = Godot + GitHub + Blender + Browser;
  «Legal Research», «3D Asset Pipeline», «Database Debugging».
- Скоупы плагинов, favorites/recent, Browse Plugins…, пресеты проектов — см. [спеку плагинов](plugins.md) (не дублируем).
- Новое в скоупах:installed ≠ enabled everywhere; дефолт подключения — текущий чат.

## 12. Ручной и автоматический контекст

Оба режима обязательны:

- **Автоматический:** AI сам находит релевантные Skills/Knowledge.
- **Ручной:** пользователь явно прикладывает Pack/Skill/Knowledge/Plugin — **приоритет выше** автоматических рекомендаций.

## 13. Capability Discovery

Агент умеет проверять собственные возможности. На «Можешь создать 3D-модель?» —
запрос к системе: какие Skills / Plugins / Tools / Permissions реально есть — и честный ответ.
В работе: «нужно экспортировать в Godot» → есть ли Skill? плагин? право?
**Не прикидываться** способным, когда возможности нет.

Плюс ненавязчивые **Recommended Skills** под композером («Create this bear in Blender…»
→ Create Animal, Godot Asset Export).

## 14. Экономия контекста — архитектурное требование

Не грузить в промпт: весь Knowledge, все Skills, все Packs, всю документацию плагинов.

```
Задача → фильтр Workspace → релевантность проекта →
→ поиск по метаданным Skills → retrieval знаний → загрузка только выбранного
```

Поиск уважает домен: Legal ищет в правовых источниках, Godot — в сценах/скриптах/ассетах.

## 15. Архитектура

### 15.1 Границы пакетов

```
workspaces/  context/  knowledge/  skills/  playbooks/
plugins/     tasks/    artifacts/
domain/
  ├── legal/
  └── gamedev/  (godot внутри)
```

### 15.2 Сервисы

```
WorkspaceRegistry
ContextPackRegistry   KnowledgeRetriever
SkillRegistry  SkillIndexer  SkillResolver  SkillLoader
SkillExecutor  SkillValidator  SkillVersionStore
PluginRegistry  PluginInstaller  PluginRuntime
TaskStore  ArtifactStore
```

Бизнес-логика — вне визуальных компонентов чата.

### 15.3 Интеграция с ADR-0001 (ядро OpenCode)

- Чаты, tools, MCP, permissions-хуки — берём от OpenCode server.
- **Наши новые слои:** WorkspaceRegistry, Context Packs, весь Skills-стек, TaskStore,
  ArtifactStore, доменные профили. Это та часть, которой у OpenCode нет.
- SkillExecutor вызывает tools чата (в т.ч. плагинные) — всё через permission layer.

### 15.4 Расширяемость (не реализуем сейчас, но не мешаем)

Marketplace Skills, командные библиотеки, remote Context Packs, импорт/экспорт,
подпись, trust levels, регресс-тесты Skills, agent teams, cost-aware routing,
локальные модели, remote dev.

Правила поддерживаемости: маленькие файлы, композиция, типизированные интерфейсы,
централизованные схемы, адаптеры, изоляция фич. Разработчик добавляет новый тип
Workspace / скоуп Skill / валидатор / тип плагина **без** переписывания чата.

## 16. Сцена-цель (приёмочный критерий фазы)

**GameDev:**
«Создай это животное и добавь в игру» → Workspace: Godot → Skills: Create Animal,
Quadruped Rigging, Godot Asset Export → Knowledge: стиль, масштаб, naming →
Plugins: Blender, Godot → Security: project FS + Blender + Godot разрешены → выполнение.

**Legal:**
«Проверь договор» → Workspace: Legal → Skill: Review Supply Contract →
Knowledge: политика договоров → Resources: шаблоны → Research: Official Sources Only →
Evidence Mode: on. **Ни один GameDev Skill не участвует.**

## 17. Открытые вопросы

- [ ] Формат хранения Knowledge (markdown-файлы vs БД vs гибрид) и механизм retrieval (эмбеддинги? grep+ранжирование?)
- [ ] Где живут Skills на диске (структура каталогов, git-friendly?)
- [ ] Исполнение Skill поверх OpenCode: сессия OpenCode + наши оркестрации или свой мини-раннер шагов?
- [ ] Схема переменных Skills (типизация, дефолты, наследование из Context Pack)
- [ ] Метрики прогонов: откуда берём стоимость/токены (usage API OpenCode?)
- [ ] Checkpoints: git-коммиты в проекте пользователя — как не мешать его истории
- [ ] Legal-источники: конкретный список официальных баз и доступ к ним
- [ ] Visual History: частота скриншотов, где хранить, дедупликация
