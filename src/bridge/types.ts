// Типы моста: то, что окно получает от движка и отдаёт ему. Формы движка
// разобраны в Rust (ADR-0001), здесь — их зеркала для интерфейса и фикстуры.
// Части моста — src/bridge/tauri.ts и src/bridge/fixture.ts; точка импорта
// интерфейса — src/bridge.ts.

import type { WindowState, WindowPatch } from "../appstate";
import type { CatalogEntry } from "../catalog";
import type { CompareSnapshot } from "../compare";

/** Выбранная модель чата: имя стоит на бейдже шапки, идентификатор уходит движку
 *  — та же пара, что у `state.rs::ChatModel` (ADR-0001). */
export type ChatModelChoice = { name: string; id: string };

export type RowKind = "user" | "assistant" | "tool" | "notice";

/** Строка ленты: `row` — новая строка, `append` — дописать к существующей;
 *  строка вызова плагина несёт его id (`plugin`) — клик по строке открывает
 *  детали вызова (сцена J); строка вопроса несёт приложенные файлы (`files`),
 *  строка исполненного вызова инструмента — прочитанный файл (`file`): это
 *  источники ответа (phase2.md, раздел 9.1), блок «Sources used» их показывает. */
export type FeedEvent =
  | { type: "row"; id: string; kind: RowKind; text: string; plugin?: string; files?: string[]; file?: string }
  | { type: "append"; id: string; delta: string }
  /** Новый чат: лента чистится целиком, следующие строки — нового чата. */
  | { type: "reset" };

export type FeedRow = {
  id: string;
  kind: RowKind;
  text: string;
  plugin?: string;
  /** Файлы вопроса путями от папки проекта: поле, а не разбор строки «Файлы: …». */
  files?: string[];
  /** Файл исполненного вызова инструмента (ключ filePath/path входа). */
  file?: string;
};

/** Строка дерева файлов: папка или файл, полный путь — чтобы читать содержимое. */
export type TreeNode = { name: string; path: string; kind: "dir" | "file"; loaded: boolean };

/** Команда плагина: `name` зовёт движок, `label` стоит на кнопке в шапке;
 *  `category` — категория прав из декларации, по ней слой прав ищет правило
 *  (src-tauri/src/plugins/rules.rs); без категории вызов всегда спрашивает. */
export type PluginCommand = { name: string; label: string; description: string; category?: string };

/** Чем кончилось обновление плагина (src-tauri/src/plugins/updates.rs): обновлено
 *  молча; ждёт решения о новых правах; плагина нет в каталоге; новая версия не
 *  загрузилась — откат на предыдущую. */
export type PluginUpdateStatus = "applied" | "held" | "outside" | "broken";

/** Запись обновления из updates.json: версии «от → до» и новые права, если
 *  изменились, — то, что карточка вкладки Updates показывает и что сводка прав
 *  переносит решением владельца. */
export type PluginUpdate = {
  from: string;
  to: string;
  status: PluginUpdateStatus;
  /** Новые права вида «Категория: значение» — изменённые права; пусто — не менялись. */
  permissions?: string[];
};

/** Удержанная правами запись updates.json с id плагина (updates.rs::Held):
 *  по ней сводка новых прав открывается сама при старте (сцена K). */
export type HeldUpdate = { id: string } & PluginUpdate;

/** Ответ о проверке обновлений при старте: пометка каталога — строке вкладки,
 *  удержанные — сводке, которую интерфейс открывает без клика (решение
 *  владельца 2026-10-06). Читается без движка — сеть фонового хука старт
 *  окна не блокирует. */
export type UpdatesNote = {
  /** «каталог недоступен — работаем на текущих»; null — каталог отвечал. */
  note: string | null;
  /** Записи «ждёт прав»: id плагина, версии «от → до» и новые права. */
  held: HeldUpdate[];
};

/** Скоуп подключения плагина (docs/SPEC/plugins.md, сцена E): «once» — до конца
 *  запроса, «chat» — только этот чат, «project» и «global» вернут кнопки в новых
 *  чатах (файл скоупов, src-tauri/src/plugins/scopes.rs). */
export type PluginScope = "once" | "chat" | "project" | "global";

/** Tool Set (phase2.md, раздел 11): сохранённая группа плагинов: имя → id в
 *  порядке их подключения к чату (toolsets.json, src-tauri/src/plugins/toolsets.rs). */
export type ToolSet = { name: string; ids: string[] };

/** Счётчик из usage.json (src-tauri/src/plugins/usage.rs): сколько исполненных
 *  вызовов было у плагина и когда последний (unix-миллисекунды, формат для
 *  человека делает карточка). */
export type PluginUsage = { count: number; last: number };

/** Плагин проекта глазами интерфейса: форма движка разобрана в Rust (ADR-0001). */
export type Plugin = {
  id: string;
  /** Готов ли плагин работать: `active` или `failed`. */
  state: string;
  /** Причина, если плагин не запустился, — словами, а не пустота. */
  error: string;
  commands: PluginCommand[];
  connected: boolean;
  /** Скоуп подключения к этому чату: полоса у подключённой строки показывает
   *  его предвыбранным; нет — плагин не подключён. */
  scope?: PluginScope;
  /** Поля карточки раздела «Плагины» (docs/SPEC/plugins.md, сцена A) — из реестра
   *  установленного; их нет у плагина движка, поэтому поля необязательные. */
  name?: string;
  author?: string;
  version?: string;
  description?: string;
  /** Права в виде «Категория: значение» — так их показывает сводка установки. */
  permissions?: string[];
  /** У карточки есть Uninstall: плагин записан в реестре установленного,
   *  у плагина движка записи нет — удалять его этой кнопкой запрещено. */
  uninstallable?: boolean;
  /** Выключен владельцем: карточка во вкладке Disabled, кнопок команд в чатах нет,
   *  сам плагин установлен. */
  disabled?: boolean;
  /** Правила категорий из rules.json: `категория → allow/ask/deny`; нет правила —
   *  панель Configure показывает умолчание ask (src-tauri/src/plugins/rules.rs). */
  rules?: Record<string, string>;
  /** Что updates.json помнит об обновлении плагина (src-tauri/src/plugins/updates.rs):
   *  версии «от → до», пометка и новые права; нет — обновлений не было. */
  update?: PluginUpdate;
  /** Счётчик исполненных вызовов (usage.json): карточка показывает «Вызовов: N»;
   *  нет — плагин ещё ни разу не вызывали (src-tauri/src/plugins/usage.rs). */
  usage?: PluginUsage;
};

/** Что сказал слой прав о вызове команды плагина (docs/SPEC/plugins.md,
 *  «Утверждённый UX одобрения»). */
export type PluginRun =
  /** Разрешено: команда уходит движку, строка запуска идёт в ленту. */
  | { kind: "started" }
  /** Вызов чувствительный: окно одобрения ждёт ответа владельца. */
  | { kind: "approval" }
  /** Запрещено правилом категории: строка «⚠ … denied» уже в ленте,
   *  окна одобрения не будет — denied-категории не спрашиваются никогда. */
  | { kind: "denied" };

/** Ответ владельца в окне одобрения: один вызов, правило на чат или отказ. */
export type ApprovalDecision = "allow" | "chat" | "deny";

/** Провайдер раздела «Провайдеры и ключи» (provider_list): провайдер движка
 *  (активированный ядром) или свой endpoint; моделей — сколько отдал
 *  `/api/model` (у endpoint'а — сколько сохранили); включённость — из
 *  providers.json. */
export type ProviderRow = {
  id: string;
  name: string;
  models: number;
  endpoint: boolean;
  enabled: boolean;
};

/** Строка умолчаний прав (секция «default» rules.json): категория и значение. */
export type RuleEntry = { category: string; value: string };

export type Listener = (event: FeedEvent) => void;
export type Bridge = {
  /** Вопрос владельца; `files` — пути файлов, которые уйдут с ним движку. */
  send(text: string, files: string[]): Promise<void>;
  /** Новый чат: лента чистится событием `reset`, движку поднимается новая сессия. */
  newChat(): Promise<void>;
  listen(listener: Listener): Promise<() => void>;
  /** Повтор строк ленты, рождённых до первой подписки окна («движок
   *  поднимается…» идёт раньше монтирования интерфейса). */
  feedReplay(): Promise<void>;
  version(): Promise<string>;
  /** Выбрать папку проекта системным диалогом; `null` — владелец передумал. */
  pickFolder(): Promise<string | null>;
  /** Содержимое одной папки: одна папка за клик по её стрелке. */
  readTree(path: string): Promise<TreeNode[]>;
  /** Установленные плагины проекта с командами; пустой список — законное состояние. */
  listPlugins(): Promise<Plugin[]>;
  /** Подключить плагин к чату со скоупом (сцена E): по умолчанию «этот чат»,
   *  «проект» и «глобально» вернут кнопки в новых чатах. */
  connectPlugin(id: string, scope?: PluginScope): Promise<Plugin[]>;
  /** Снять плагин с чата без деинсталляции (панель «Plugins in this chat»):
   *  кнопки уходят из этого окна, установка и скоупы остаются. */
  disconnectPlugin(id: string): Promise<Plugin[]>;
  /** Tool Sets списка: сохранённые группы плагинов — окно ToolSetPicker. */
  listToolsets(): Promise<ToolSet[]>;
  /** Сохранить Tool Set из подключённого сейчас к чату (реестр чата): имя. */
  saveToolset(name: string): Promise<ToolSet[]>;
  /** Подключить Tool Set одним пунктом меню со скоупом: недоступные пропускаются. */
  connectToolset(name: string, scope?: PluginScope): Promise<Plugin[]>;
  /** Удалить Tool Set: ярлык группы — плагины и скоупы не трогаются. */
  deleteToolset(name: string): Promise<ToolSet[]>;
  /** Отключить плагин (Enable/Disable в разделе «Плагины»): кнопки команд уходят
   *  из всех чатов, установка не тронута; отдаёт обновлённый список. */
  setPluginEnabled(disabled: boolean, id: string): Promise<Plugin[]>;
  /** Удалить плагин после подтверждения: запись реестра и файл плагина уходят. */
  uninstallPlugin(id: string): Promise<Plugin[]>;
  /** Пометка последней проверки каталога и удержанные правами обновления:
   *  «каталог недоступен — работаем на текущих» и записи, по которым сводка
   *  новых прав открывается сама при старте (updates.rs, сцена K). */
  updatesNote(): Promise<UpdatesNote>;
  /** Сменить правило категории плагина (панель Configure): действует на следующий
   *  вызов без перезапуска — слой прав перечитывает правила на каждом вызове. */
  setPluginRule(plugin: string, category: string, value: string): Promise<Plugin[]>;
  /** Карточки каталога «Available» — индекс с GitHub (raw, не api.github.com). */
  catalogList(): Promise<CatalogEntry[]>;
  /** Каталог моделей сравнения: свежий с opencode.ai, недоступный сайт — из кэша
   *  с пометкой (`stale`). Ошибка — кэша нет вовсе, панель сказала об этом. */
  compareList(): Promise<CompareSnapshot>;
  /** Перечитать каталог с сайта («Обновить»): тот же путь, что и первый запрос. */
  compareRefresh(): Promise<CompareSnapshot>;/** Установить плагин каталога и подключить к текущему чату — «Разрешить»
   *  сводки прав: установка, тихий перезапуск движка, подключение, список;
   *  «Keep enabled for this project»/«Enable by default» ставят скоуп сразу. */
  installPlugin(id: string, scope?: PluginScope): Promise<Plugin[]>;
  /** Клик по кнопке команды: слой прав решает, спросить владельца или исполнить. */
  runPlugin(plugin: string, command: string, label: string): Promise<PluginRun>;
  /** Ответ в окне одобрения: правило на чат сохраняет слой прав, не интерфейс. */
  decidePlugin(
    plugin: string,
    command: string,
    label: string,
    decision: ApprovalDecision,
  ): Promise<void>;
  /** Что окно помнит о себе: сессия, титул чата, папка, тема (src-tauri/src/state.rs). */
  stateGet(): Promise<WindowState>;
  /** Правка названных полей состояния: тема папку и чат не затирает. */
  statePatch(patch: WindowPatch): Promise<WindowState>;
  /** Провайдеры окна настроек: движок плюс свои endpoint'ы; ошибка — движок не отвечает. */
  providerList(): Promise<ProviderRow[]>;
  /** Включить или выключить провайдера/endpoint: модели выключенного уходят
   *  из переключателя чата; отдаёт свежий список. */
  providerSetEnabled(id: string, enabled: boolean): Promise<ProviderRow[]>;
  /** Добавить свой endpoint: имя + база URL (+ ключ), модели спрашиваются с
   *  самого endpoint'а, ключ — в хранилище ОС; тихий рестарт несёт его движку. */
  endpointAdd(name: string, baseUrl: string, key: string): Promise<ProviderRow[]>;
  /** Удалить свой endpoint: строка и его модели уходят. */
  endpointRemove(id: string): Promise<ProviderRow[]>;
  /** Статусы ключей: «задан» у провайдера или нет; секрет наружу не идёт. */
  keyStatuses(providers: string[]): Promise<Record<string, boolean>>;
  /** Сохранить ключ и тихо перезапустить движок — читается только при старте. */
  saveKey(provider: string, secret: string): Promise<Record<string, boolean>>;
  /** Убрать ключ провайдера; нет записи — уже чисто, а не ошибка. */
  removeKey(provider: string): Promise<Record<string, boolean>>;
  /** Умолчания прав секции rules.json: строка на категорию. */
  defaults(): Promise<RuleEntry[]>;
  /** Сменить умолчание одной категории: действует на следующий вызов плагина. */
  setDefault(category: string, value: string): Promise<RuleEntry[]>;
  /** Полный путь папки данных: показ вкладки «Папка данных»; смены пути здесь нет. */
  dataFolder(): Promise<string>;
  /** Свои кнопки окна без рамки: системные действия текущего окна. */
  windowMinimize(): Promise<void>;
  /** Свернуть ↔ вернуть: `true` — окно теперь развёрнуто. */
  windowToggleMaximize(): Promise<boolean>;
  windowClose(): Promise<void>;
};
