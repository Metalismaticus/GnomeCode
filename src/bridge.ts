// Единственное место вызова Tauri: приложение и UI-сценарий идут через него и не знают,
// что за окном. Вне окна Tauri (страница vite, снимок и сценарий) признака нет —
// отдаём фикстуру, чтобы проверка видела ту же ленту и то же дерево, что продукт.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fixture } from "./fixture";
import type { WindowState, WindowPatch } from "./appstate";
import type { CatalogEntry } from "./catalog";
import type { CompareSnapshot } from "./compare";
import { readFixtureState, writeFixtureState } from "./fixtureState";
import {
  applyUpdate as applyUpdateFixture,
  connect as connectFixture,
  detach as detachFixture,
  disable as disableFixture,
  enable as enableFixture,
  plugins as fixturePlugins,
  takeOnce as takeOnceFixture,
  uninstall as uninstallFixture,
} from "./fixturePlugins";
import { params } from "./viewparams";
import { entries as fixtureCatalog, install as installFixture } from "./fixtureCatalog";
import { list as fixtureCompare } from "./fixtureCompare";
import { providers as settingsProviders, keyRows as keyFixture, saveKey as saveKeyFixture, removeKey as removeKeyFixture, defaultsList as defaultsFixture, setDefault as setDefaultFixture, DATA_FOLDER } from "./fixtureSettings";
import {
  granted as fixtureGranted,
  launch as fixtureLaunch,
  remember as fixtureRemember,
  refuse as fixtureRefuse,
  ruleOf,
  setRule,
  denyByRule,
} from "./fixtureApprovals";
import { children as fixtureChildren, project as fixtureProject } from "./fixtureTree";
import {
  connect as connectToolsetFixture,
  list as listToolsetsFixture,
  remove as deleteToolsetFixture,
  save as saveToolsetFixture,
} from "./fixtureToolsets";

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

/** Провайдер движка (GET /api/provider, строка раздела «Модели»): имя на строке,
 *  идентификатор — он же имя записи ключа в Credential Manager; модели —
 *  сколько отдаёт список движка (число в статусе «Ключ принят — …»). */
export type ProviderRow = { id: string; name: string; models: number };

/** Строка умолчаний прав (секция «default» rules.json): категория и значение. */
export type RuleEntry = { category: string; value: string };

type Listener = (event: FeedEvent) => void;

type Bridge = {
  /** Вопрос владельца; `files` — пути файлов, которые уйдут с ним движку. */
  send(text: string, files: string[]): Promise<void>;
  /** Новый чат: лента чистится событием `reset`, движку поднимается новая сессия. */
  newChat(): Promise<void>;
  listen(listener: Listener): Promise<() => void>;
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
  /** Пометка последней проверки каталога: «каталог недоступен — работаем на
   *  текущих»; `null` — каталог отвечал, пометки нет. */
  updatesNote(): Promise<string | null>;
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
  /** Провайдеры движка: строки раздела «Модели» настроек; ошибка — движок не отвечает. */
  providerList(): Promise<ProviderRow[]>;
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

/** Канал Tauri, по которому лента получает строки (src-tauri/src/opencode/mod.rs). */
const FEED_CHANNEL = "chat-feed";

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Живой мост в окне Tauri: ответ приходит событиями ленты, а не телом команды. */
const tauriBridge = (): Bridge => ({
  async send(text: string, files: string[]) {
    await invoke("chat_send", { text, files });
  },
  async newChat() {
    await invoke("chat_new");
  },
  async listen(listener: Listener) {
    return listen<FeedEvent>(FEED_CHANNEL, (event) => listener(event.payload));
  },
  async version() {
    return (await invoke<string>("app_version")) as string;
  },
  async pickFolder() {
    return (await invoke<string | null>("project_pick_folder")) ?? null;
  },
  async readTree(path: string) {
    return (await invoke<TreeNode[]>("project_read_tree", { path })) as TreeNode[];
  },
  async listPlugins() {
    return (await invoke<Plugin[]>("plugin_list")) as Plugin[];
  },
  async connectPlugin(id: string, scope?: PluginScope) {
    return (await invoke<Plugin[]>("plugin_connect", { id, scope: scope ?? null })) as Plugin[];
  },
  async disconnectPlugin(id: string) {
    return (await invoke<Plugin[]>("plugin_disconnect", { id })) as Plugin[];
  },
  async listToolsets() {
    return (await invoke<ToolSet[]>("plugin_toolsets")) as ToolSet[];
  },
  async saveToolset(name: string) {
    return (await invoke<ToolSet[]>("plugin_toolset_save", { name })) as ToolSet[];
  },
  async connectToolset(name: string, scope?: PluginScope) {
    return (await invoke<Plugin[]>("plugin_toolset_connect", { name, scope: scope ?? null })) as Plugin[];
  },
  async deleteToolset(name: string) {
    return (await invoke<ToolSet[]>("plugin_toolset_delete", { name })) as ToolSet[];
  },
  async setPluginEnabled(disabled: boolean, id: string) {
    return (await invoke<Plugin[]>("plugin_set_enabled", { disabled, id })) as Plugin[];
  },
  async uninstallPlugin(id: string) {
    return (await invoke<Plugin[]>("plugin_uninstall", { id })) as Plugin[];
  },
  async updatesNote() {
    return (await invoke<string | null>("plugin_updates_note")) ?? null;
  },
  async setPluginRule(plugin: string, category: string, value: string) {
    return (await invoke<Plugin[]>("plugin_set_rule", { plugin, category, value })) as Plugin[];
  },
  async catalogList() {
    return (await invoke<CatalogEntry[]>("catalog_list")) as CatalogEntry[];
  },
  async compareList() {
    return (await invoke<CompareSnapshot>("compare_list")) as CompareSnapshot;
  },
  async compareRefresh() {
    return (await invoke<CompareSnapshot>("compare_refresh")) as CompareSnapshot;
  },
  async installPlugin(id: string, scope?: PluginScope) {
    // «Разрешить» сводки прав — два шага моста: установка (файл + реестр +
    // тихий перезапуск) и подключение к чату, затем свежий список; скоуп
    // «Keep enabled for this project»/«Enable by default» идёт в подключение.
    await invoke("plugin_install", { id });
    return (await invoke<Plugin[]>("plugin_connect", { id, scope: scope ?? null })) as Plugin[];
  },
  async runPlugin(plugin: string, command: string, label: string) {
    return (await invoke<PluginRun>("plugin_run", { plugin, command, label })) as PluginRun;
  },
  async decidePlugin(
    plugin: string,
    command: string,
    label: string,
    decision: ApprovalDecision,
  ) {
    await invoke("plugin_decide", { plugin, command, label, decision });
  },
  async stateGet() {
    return (await invoke<WindowState>("state_get")) as WindowState;
  },
  async statePatch(patch: WindowPatch) {
    return (await invoke<WindowState>("state_patch", { patch })) as WindowState;
  },
  async providerList() {
    // `/api/provider` отдаёт {all, connected}; строкам настроек нужны все
    // — ключ заводят и у ещё не подключённого провайдера.
    const raw = await invoke<{ all?: { id: string; name?: string; models?: Record<string, unknown> }[] }>(
      "provider_list",
    );
    return (raw.all ?? []).map((one) => ({
      id: one.id,
      name: one.name ?? one.id,
      models: one.models ? Object.keys(one.models).length : 0,
    }));
  },
  async keyStatuses(providers: string[]) {
    // Проверка ключа — по одному провайдеру: мост знает только запись целиком.
    const held: Record<string, boolean> = {};
    await Promise.all(
      providers.map(async (id) => {
        held[id] = await invoke<boolean>("key_status", { provider: id });
      }),
    );
    return held;
  },
  async saveKey(provider: string, secret: string) {
    await invoke<boolean>("key_save", { provider, secret });
    return { [provider]: true };
  },
  async removeKey(provider: string) {
    await invoke<boolean>("key_remove", { provider });
    return { [provider]: false };
  },
  async defaults() {
    return (await invoke<RuleEntry[]>("settings_defaults")) as RuleEntry[];
  },
  async setDefault(category: string, value: string) {
    return (await invoke<RuleEntry[]>("settings_set_default", { category, value })) as RuleEntry[];
  },
  async dataFolder() {
    return (await invoke<string>("data_folder")) as string;
  },
  async windowMinimize() {
    await invoke("window_minimize");
  },
  async windowToggleMaximize() {
    return (await invoke<boolean>("window_toggle_maximize")) as boolean;
  },
  async windowClose() {
    await invoke("window_close");
  },
});

/** Заглушка вне окна: лента и дерево идут по фикстуре, диалога на странице нет —
 *  папкой проекта становится та, что в фикстуре (src/fixture.ts). */
const fixtureBridge = (): Bridge => ({
  async send(text: string, files: string[]) {
    fixture.push(text, files);
    // Скоуп «Once» (сцена E): соединение служит текущему запросу — следующий
    // вопрос снимает плагин с чата, как registry.take_once (plugin_send).
    takeOnceFixture();
  },
  async newChat() {
    fixture.reset();
  },
  async listen(listener: Listener) {
    return fixture.play(listener);
  },
  async version() {
    return "снапшот интерфейса";
  },
  async pickFolder() {
    return fixtureProject();
  },
  async readTree(path: string) {
    return fixtureChildren(path);
  },
  async listPlugins() {
    return fixturePlugins();
  },
  async connectPlugin(id: string, scope?: PluginScope) {
    return connectFixture(fixturePlugins(), id, scope);
  },
  async disconnectPlugin(id: string) {
    return detachFixture(id);
  },
  async listToolsets() {
    return listToolsetsFixture();
  },
  async saveToolset(name: string) {
    return saveToolsetFixture(name);
  },
  async connectToolset(name: string, scope?: PluginScope) {
    return connectToolsetFixture(name, scope);
  },
  async deleteToolset(name: string) {
    return deleteToolsetFixture(name);
  },
  async setPluginEnabled(disabled: boolean, id: string) {
    return disabled ? disableFixture(id) : enableFixture(id);
  },
  async uninstallPlugin(id: string) {
    return uninstallFixture(id);
  },
  async updatesNote() {
    // Каталог в состоянии фикстуры отвечал: пометки о недоступности нет.
    return null;
  },
  async catalogList() {
    return fixtureCatalog();
  },
  async compareList() {
    return fixtureCompare();
  },
  async compareRefresh() {
    return fixtureCompare();
  },
  async installPlugin(id: string, scope?: PluginScope) {
    // В состоянии обновлений «Разрешить» сводки новых прав — принять обновление
    // (Held → Applied), как plugin_install + refresh (src-tauri/src/plugins/updates.rs):
    // живой путь тот же мост, вне окна — память фикстуры.
    if (params.feed === "plugins-updates") {
      return applyUpdateFixture(id);
    }
    return installFixture(id, scope);
  },
  async runPlugin(plugin: string, command: string, label: string) {
    // Зеркало plugin_run (src-tauri/src/plugins/commands.rs): deny по категории
    // старше всего — строка «denied» и конец; грант чата или allow — молча;
    // иначе окно одобрения (правила нет — умолчание ask).
    const category = fixturePlugins().find((one) => one.id === plugin)?.commands.find(
      (one) => one.name === command,
    )?.category;
    const rule = category ? ruleOf(plugin, category) : undefined;
    if (rule === "deny") {
      denyByRule(plugin, label);
      return { kind: "denied" };
    }
    if (fixtureGranted(command) || rule === "allow") {
      fixtureLaunch(plugin, label);
      return { kind: "started" };
    }
    return { kind: "approval" };
  },
  async setPluginRule(plugin: string, category: string, value: string) {
    // Правила — память страницы: карточка получит свежие правила тем же списком,
    // каким мост отвечает на Enable/Disable.
    setRule(plugin, category, value);
    return fixturePlugins();
  },
  async decidePlugin(
    plugin: string,
    command: string,
    label: string,
    decision: ApprovalDecision,
  ) {
    if (decision === "deny") {
      fixtureRefuse(plugin, label);
      return;
    }
    if (decision === "chat") {
      fixtureRemember(command);
    }
    fixtureLaunch(plugin, label);
  },
  async stateGet() {
    // Зеркало state.json для страницы (src/fixtureState.ts) с одной разницей:
    // папку «?состояние=проект» фикстура считает выбранной — сценарий дерева
    // и полного цикла открывают её с уже готовым проектом.
    const saved = readFixtureState();
    const theme = windowState(saved.theme);
    return {
      session: null,
      chatTitle: saved.chatTitle || null,
      project: saved.project || fixtureProject(),
      theme,
      pluginFavorites: saved.pluginFavorites,
      pluginRecent: saved.pluginRecent,
      chatModel: saved.chatModel || null,
      defaultModel: saved.defaultModel || null,
      chatTime: saved.chatTime || null,
    };
  },
  async statePatch(patch: WindowPatch) {
    const saved = readFixtureState();
    const next = {
      chatTitle: patch.chatTitle ?? saved.chatTitle,
      project: patch.project ?? saved.project,
      theme: patch.theme ?? saved.theme,
      pluginFavorites: patch.pluginFavorites ?? saved.pluginFavorites,
      pluginRecent: patch.pluginRecent ?? saved.pluginRecent,
      chatModel: patch.chatModel ?? saved.chatModel,
      defaultModel: patch.defaultModel ?? saved.defaultModel,
      chatTime: patch.chatTime ?? saved.chatTime,
    };
    writeFixtureState(next);
    return {
      session: null,
      chatTitle: next.chatTitle || null,
      project: next.project || fixtureProject(),
      theme: windowState(next.theme),
      pluginFavorites: next.pluginFavorites,
      pluginRecent: next.pluginRecent,
      chatModel: next.chatModel || null,
      defaultModel: next.defaultModel || null,
      chatTime: next.chatTime || null,
    };
  },
  async providerList() {
    return settingsProviders();
  },
  async keyStatuses(ids: string[]) {
    return keyFixture(ids);
  },
  async saveKey(provider: string, secret: string) {
    return saveKeyFixture(provider, secret);
  },
  async removeKey(provider: string) {
    return removeKeyFixture(provider);
  },
  async defaults() {
    return defaultsFixture();
  },
  async setDefault(category: string, value: string) {
    return setDefaultFixture(category, value);
  },
  async dataFolder() {
    return DATA_FOLDER;
  },
  async windowMinimize() {
    // Рамку и системные действия страница не показывает (WebView2 Playwright не
    // водит живое окно) — вызов записывается, сценарий стережёт сам ход кнопки.
    recordWindowCall("minimize");
  },
  async windowToggleMaximize() {
    recordWindowCall("maximize");
    return maximizedFixture;
  },
  async windowClose() {
    recordWindowCall("close");
  },
});

/** Вызовы кнопок окна, зафиксированные фикстурой: сценарий окна без рамки
 *  читает их с страницы (`window.__windowCalls`) — иначе клик не заметен. */
function recordWindowCall(action: string): void {
  maximizedFixture = action === "maximize" ? !maximizedFixture : maximizedFixture;
  const holder = window as unknown as { __windowCalls?: string[] };
  holder.__windowCalls = [...(holder.__windowCalls ?? []), action];
}

/** Состояние «развёрнуто» у фикстуры: Toggle возвращает его же наизнанку. */
let maximizedFixture = false;

/** Тема строки зеркала, если она названа. */
function windowState(theme: string): WindowState["theme"] {
  return theme === "light" || theme === "dark" ? theme : null;
}

let chosen: Bridge | undefined;

/** Мост приложения: живой в окне Tauri, фикстура на странице vite. */
export function bridge(): Bridge {
  if (!chosen) {
    chosen = inTauri() ? tauriBridge() : fixtureBridge();
  }
  return chosen;
}