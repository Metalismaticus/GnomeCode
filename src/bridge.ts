// Единственное место вызова Tauri: приложение и UI-сценарий идут через него и не знают,
// что за окном. Вне окна Tauri (страница vite, снимок и сценарий) признака нет —
// отдаём фикстуру, чтобы проверка видела ту же ленту и то же дерево, что продукт.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fixture } from "./fixture";
import type { WindowState, WindowPatch } from "./appstate";
import type { CatalogEntry } from "./catalog";
import { readFixtureState, writeFixtureState } from "./fixtureState";
import {
  connect as connectFixture,
  disable as disableFixture,
  enable as enableFixture,
  plugins as fixturePlugins,
  uninstall as uninstallFixture,
} from "./fixturePlugins";
import { entries as fixtureCatalog, install as installFixture } from "./fixtureCatalog";
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

export type RowKind = "user" | "assistant" | "tool" | "notice";

/** Строка ленты: `row` — новая строка, `append` — дописать к существующей. */
export type FeedEvent =
  | { type: "row"; id: string; kind: RowKind; text: string }
  | { type: "append"; id: string; delta: string };

export type FeedRow = { id: string; kind: RowKind; text: string };

/** Строка дерева файлов: папка или файл, полный путь — чтобы читать содержимое. */
export type TreeNode = { name: string; path: string; kind: "dir" | "file"; loaded: boolean };

/** Команда плагина: `name` зовёт движок, `label` стоит на кнопке в шапке;
 *  `category` — категория прав из декларации, по ней слой прав ищет правило
 *  (src-tauri/src/plugins/rules.rs); без категории вызов всегда спрашивает. */
export type PluginCommand = { name: string; label: string; description: string; category?: string };

/** Плагин проекта глазами интерфейса: форма движка разобрана в Rust (ADR-0001). */
export type Plugin = {
  id: string;
  /** Готов ли плагин работать: `active` или `failed`. */
  state: string;
  /** Причина, если плагин не запустился, — словами, а не пустота. */
  error: string;
  commands: PluginCommand[];
  connected: boolean;
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

type Listener = (event: FeedEvent) => void;

type Bridge = {
  /** Вопрос владельца; `files` — пути файлов, которые уйдут с ним движку. */
  send(text: string, files: string[]): Promise<void>;
  listen(listener: Listener): Promise<() => void>;
  version(): Promise<string>;
  /** Выбрать папку проекта системным диалогом; `null` — владелец передумал. */
  pickFolder(): Promise<string | null>;
  /** Содержимое одной папки: одна папка за клик по её стрелке. */
  readTree(path: string): Promise<TreeNode[]>;
  /** Установленные плагины проекта с командами; пустой список — законное состояние. */
  listPlugins(): Promise<Plugin[]>;
  /** Подключить плагин к чату: он появляется кнопками в шапке без перезапуска. */
  connectPlugin(id: string): Promise<Plugin[]>;
  /** Отключить плагин (Enable/Disable в разделе «Плагины»): кнопки команд уходят
   *  из всех чатов, установка не тронута; отдаёт обновлённый список. */
  setPluginEnabled(disabled: boolean, id: string): Promise<Plugin[]>;
  /** Удалить плагин после подтверждения: запись реестра и файл плагина уходят. */
  uninstallPlugin(id: string): Promise<Plugin[]>;
  /** Сменить правило категории плагина (панель Configure): действует на следующий
   *  вызов без перезапуска — слой прав перечитывает правила на каждом вызове. */
  setPluginRule(plugin: string, category: string, value: string): Promise<Plugin[]>;
  /** Карточки каталога «Available» — индекс с GitHub (raw, не api.github.com). */
  catalogList(): Promise<CatalogEntry[]>;
  /** Установить плагин каталога и подключить к текущему чату — «Разрешить»
   *  сводки прав: установка, тихий перезапуск движка, подключение, список. */
  installPlugin(id: string): Promise<Plugin[]>;
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
};

/** Канал Tauri, по которому лента получает строки (src-tauri/src/opencode/mod.rs). */
const FEED_CHANNEL = "chat-feed";

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Живой мост в окне Tauri: ответ приходит событиями ленты, а не телом команды. */
const tauriBridge = (): Bridge => ({
  async send(text: string, files: string[]) {
    await invoke("chat_send", { text, files });
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
  async connectPlugin(id: string) {
    return (await invoke<Plugin[]>("plugin_connect", { id })) as Plugin[];
  },
  async setPluginEnabled(disabled: boolean, id: string) {
    return (await invoke<Plugin[]>("plugin_set_enabled", { disabled, id })) as Plugin[];
  },
  async uninstallPlugin(id: string) {
    return (await invoke<Plugin[]>("plugin_uninstall", { id })) as Plugin[];
  },
  async setPluginRule(plugin: string, category: string, value: string) {
    return (await invoke<Plugin[]>("plugin_set_rule", { plugin, category, value })) as Plugin[];
  },
  async catalogList() {
    return (await invoke<CatalogEntry[]>("catalog_list")) as CatalogEntry[];
  },
  async installPlugin(id: string) {
    // «Разрешить» сводки прав — два шага моста: установка (файл + реестр +
    // тихий перезапуск) и подключение к чату, затем свежий список.
    await invoke("plugin_install", { id });
    return (await invoke<Plugin[]>("plugin_connect", { id })) as Plugin[];
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
});

/** Заглушка вне окна: лента и дерево идут по фикстуре, диалога на странице нет —
 *  папкой проекта становится та, что в фикстуре (src/fixture.ts). */
const fixtureBridge = (): Bridge => ({
  async send(text: string, files: string[]) {
    fixture.push(text, files);
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
  async connectPlugin(id: string) {
    return connectFixture(fixturePlugins(), id);
  },
  async setPluginEnabled(disabled: boolean, id: string) {
    const list = fixturePlugins();
    return disabled ? disableFixture(list, id) : enableFixture(list, id);
  },
  async uninstallPlugin(id: string) {
    return uninstallFixture(fixturePlugins(), id);
  },
  async catalogList() {
    return fixtureCatalog();
  },
  async installPlugin(id: string) {
    return installFixture(id);
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
    };
  },
  async statePatch(patch: WindowPatch) {
    const saved = readFixtureState();
    const next = {
      chatTitle: patch.chatTitle ?? saved.chatTitle,
      project: patch.project ?? saved.project,
      theme: patch.theme ?? saved.theme,
    };
    writeFixtureState(next);
    return {
      session: null,
      chatTitle: next.chatTitle || null,
      project: next.project || fixtureProject(),
      theme: windowState(next.theme),
    };
  },
});

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