// Единственное место вызова Tauri: приложение и UI-сценарий идут через него и не знают,
// что за окном. Вне окна Tauri (страница vite, снимок и сценарий) признака нет —
// отдаём фикстуру, чтобы проверка видела ту же ленту и то же дерево, что продукт.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fixture } from "./fixture";
import {
  connect as connectFixture,
  plugins as fixturePlugins,
} from "./fixturePlugins";
import {
  granted as fixtureGranted,
  launch as fixtureLaunch,
  remember as fixtureRemember,
  refuse as fixtureRefuse,
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

/** Команда плагина: `name` зовёт движок, `label` стоит на кнопке в шапке. */
export type PluginCommand = { name: string; label: string; description: string };

/** Плагин проекта глазами интерфейса: форма движка разобрана в Rust (ADR-0001). */
export type Plugin = {
  id: string;
  /** Готов ли плагин работать: `active` или `failed`. */
  state: string;
  /** Причина, если плагин не запустился, — словами, а не пустота. */
  error: string;
  commands: PluginCommand[];
  connected: boolean;
};

/** Что сказал слой прав о вызове команды плагина (docs/SPEC/plugins.md,
 *  «Утверждённый UX одобрения»). */
export type PluginRun =
  /** Разрешено: команда уходит движку, строка запуска идёт в ленту. */
  | { kind: "started" }
  /** Вызов чувствительный: окно одобрения ждёт ответа владельца. */
  | { kind: "approval" };

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
  /** Клик по кнопке команды: слой прав решает, спросить владельца или исполнить. */
  runPlugin(plugin: string, command: string, label: string): Promise<PluginRun>;
  /** Ответ в окне одобрения: правило на чат сохраняет слой прав, не интерфейс. */
  decidePlugin(
    plugin: string,
    command: string,
    label: string,
    decision: ApprovalDecision,
  ): Promise<void>;
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
  async runPlugin(plugin: string, command: string, label: string) {
    const allowed = fixtureGranted(command);
    if (allowed) {
      fixtureLaunch(plugin, label);
      return { kind: "started" };
    }
    return { kind: "approval" };
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
});

let chosen: Bridge | undefined;

/** Мост приложения: живой в окне Tauri, фикстура на странице vite. */
export function bridge(): Bridge {
  if (!chosen) {
    chosen = inTauri() ? tauriBridge() : fixtureBridge();
  }
  return chosen;
}