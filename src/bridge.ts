// Единственное место вызова Tauri: приложение и UI-сценарий идут через него и не знают,
// что за окном. Вне окна Tauri (страница vite, снимок и сценарий) признака нет —
// отдаём фикстуру, чтобы проверка видела ту же ленту и то же дерево, что продукт.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fixture } from "./fixture";
import { children as fixtureChildren, project as fixtureProject } from "./fixtureTree";

export type RowKind = "user" | "assistant" | "tool" | "notice";

/** Строка ленты: `row` — новая строка, `append` — дописать к существующей. */
export type FeedEvent =
  | { type: "row"; id: string; kind: RowKind; text: string }
  | { type: "append"; id: string; delta: string };

export type FeedRow = { id: string; kind: RowKind; text: string };

/** Строка дерева файлов: папка или файл, полный путь — чтобы читать содержимое. */
export type TreeNode = { name: string; path: string; kind: "dir" | "file"; loaded: boolean };

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
});

let chosen: Bridge | undefined;

/** Мост приложения: живой в окне Tauri, фикстура на странице vite. */
export function bridge(): Bridge {
  if (!chosen) {
    chosen = inTauri() ? tauriBridge() : fixtureBridge();
  }
  return chosen;
}