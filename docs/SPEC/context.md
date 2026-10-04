# Сценарий: Управление контекстом (Фаза 2.5)

> Заметка владельца от 2026-10-04, сохранена по образцу phase2.md.
> Дополняет: [Фаза 2](phase2.md) · [ADR-0001 — ядро OpenCode](../DECISIONS.md)
> Статус: принята владельцем, место — Этап 4 «Контекст без границ» (С-20…С-22).
> Правило: реализуется поверх компакции OpenCode server, не своим движком.

---

## 0. Сдвиг продукта

Управление контекстом — ядро Experience: пользователь ведёт **чрезвычайно
длинный проектный разговор**, не бросая его из-за дорогого контекста.

Целевое ощущение (слова владельца):

> «Keep working for months, but pay context costs as if the conversation
> were much younger.»

В любой момент: «Continue in new chat» — чистое продолжение с переносом
только важного; «Pin as important» — гарантия, что оптимизация не выбросит
критичное.

## A. Continue in new chat

Первоклассное действие. Сбрасывает активное окно контекста модели, **не**
копируя старый разговор. Новый чат создаётся из компактного состояния:

1. Текущий валидированный Working State.
2. Закреплённое (Pinned).
3. Состояние Task/Subtask.
4. Активные Skills и их исполнение.
5. Релевантный Project Knowledge.
6. Ссылки на важные Artifacts.
7. Релевантные файлы и важные символы кода.
8. Нерешённые ошибки и отложенные действия.
9. Релевантные ограничения безопасности.
10. Релевантные источники.

Старый разговор остаётся в Archive. Пример:

```
Старый чат: 2.4M archived tokens · 420K active context

Continue in new chat →

Новый чат:
Working State      14K
Relevant Knowledge  9K
Active Skills        5K
Relevant Files      47K
Pinned Context       4K
Recent Context      20K
Итого: ~99K active tokens
```

Предпросмотр переноса перед созданием:

```
Continue in new chat
Transfer:
✓ Current goal          ✓ Relevant files
✓ Pending tasks         ✓ Pinned context
✓ Important decisions   ✓ Security policy
✓ Relevant knowledge    ✓ Active Skills
Опционально:
○ Last 10 raw messages  ○ Selected attachments
[Create new chat]
```

## B. Pin as important

Явное действие закрепления. Можно закрепить: сообщения, решения,
инструкции, ссылки на файлы, фрагменты кода, источники, Artifacts, заметки
задач, выводы AI. Закреплённое **защищено от автосжатия** и живёт, пока
пользователь не открепит или не перенесёт сам. Примеры:

- «This architectural requirement must never be forgotten.»
- «Never use a second camera for waterfalls.»
- «This document is the authoritative version.»
- «All generated assets must use project scale 1 unit = 1 meter.»

UI: `📌 8 pinned items` → панель «Pinned Context» со списком; действия:
Unpin · Edit note · Move to Project Knowledge · Convert to Skill ·
Attach to another Task.

## C. Pinning vs Project Knowledge

Не путать два понятия:

| Понятие | Значение |
|---|---|
| **Pinned Context** | «Держать это важное внутри текущего разговора» |
| **Project Knowledge** | «Это должно переиспользоваться в будущих разговорах проекта» |

Явное действие **Move to Project Knowledge**: закреплённое становится
персистентным знанием проекта и перестаёт зависеть от чата.

## D. Умная подсказка сохранить важное

GnomeCode может распознавать информацию, вероятно важную за пределами
разговора: крупное архитектурное решение, стабильное правило проекта,
проверенный воркфлоу, важная юридическая интерпретация, правило пайплайна
ассетов. Ненавязчивая подсказка:

> «This looks like a reusable project decision.»
> [Save to Knowledge] [Pin only] [Ignore]

**Не сохранять автоматически.**

## E. Предпросмотр сжатия

Когда автосжатие соберётся убрать большой кусок активного контекста —
опциональный «Preview compression»:

```
KEEPING                          ARCHIVING
Current goal                     384 old messages
14 important decisions           42 resolved errors
6 pending tasks                  19 obsolete code snippets
8 relevant files                 Large terminal logs
3 active Skills                  Duplicate tool output
7 pinned items

Tokens: 486K → 103K (saved 383K, 79%)
```

Пользователь может отменить сжатие.

## F. История состояний контекста

```
Context History
v8  Current — 103K active
v7  188K active — compressed 14:32
v6  347K active — compressed 11:04
```

Действия: Inspect · Compare · Restore. **Восстановление версии не удаляет
новые сообщения чата** — меняется только активный Working State для контекста модели.

## G. «Что было удалено?»

После сжатия — ненавязчивый статус:

```
Context optimized: 486K → 103K   [Details]
```

Детали: 383K в архиве; удалено из активного контекста (решённые логи
отладки, устаревшие попытки реализации, дубли чтения файлов, старые планы);
сохранено (текущая задача, решения проекта, активные ошибки, закреплённое,
Skills, состояние задач).

## H. Context Lock

Опционально: автосжатие временно выключено. Полезно при отладке сложной
проблемы, юридическом анализе, сравнении версий. Предупреждение у предела:

```
Context Lock enabled · 89% context used
Automatic compression is paused.
[Compress manually] [Disable lock]
```

## I. Контроль на уровне сообщения

Меню каждого сообщения: Pin as important · Exclude from active context ·
Save to Knowledge · Create Skill from this · Create Artifact · Start branch
here · Continue from here in new chat. Управление контекстом понимается без
отдельной панели настроек.

## J. Свежесть контекста

Working State понимает, что новые решения заменяют старые:

> Старое: «Use Waterways plugin.»
> Новое: «Do not use Waterways runtime; reuse only the geometry idea.»

Сжатие сохраняет **новое авторитетное решение**, старое помечает
superseded. Противоречивые устаревшие решения не сохранять как равнозначные
факты. Где неясно — сохранить оба с явным статусом: «Previous approach: … /
Current approach: …».

## K. Приоритеты сборки контекста

1. Текущий явный запрос пользователя
2. Security Policy
3. Pinned Context
4. Состояние Task
5. Активные инструкции Skill
6. Working State
7. Релевантный Project Knowledge
8. Релевантные файлы/код
9. Недавний сырой разговор
10. Retrieved Archive

Старый текст разговора **не** перекрывает текущие инструкции пользователя и
политику проекта.

## L. Словарь интерфейса (решение владельца)

| Значок | Термин | Смысл для пользователя |
|---|---|---|
| 📌 | **Pinned** | важно прямо для текущей работы |
| 🧠 | **Knowledge** | проект должен помнить это в будущем |
| ⚙ | **Skill** | проект знает, как это делать |
| 📦 | **Artifact** | результат уже выполненной работы |
| 📚 | **Archive** | старая история, которую можно достать при необходимости |

При огромном проекте трудно запутаться, что куда сохраняется.

## Открытые вопросы

- [ ] Поверх какой механики OpenCode строится сжатие (compact/summarize сессий) — выяснить при пробе Этапа 4
- [ ] Хранение версий контекста (F): формат снимков Working State и место
- [ ] «Start branch here» (I): ветвление разговоров — связь с чатами Workspace
