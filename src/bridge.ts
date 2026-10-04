// Единственное место вызова Tauri: приложение и UI-сценарий идут через него и не знают,
// что за окном. Вне окна Tauri (страница vite, снимок и сценарий) признака нет —
// отдаём фикстуру, чтобы проверка видела ту же ленту, что продукт.

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fixture } from "./fixture";

export type RowKind = "user" | "assistant" | "tool" | "notice";

/** Строка ленты: `row` — новая строка, `append` — дописать к существующей. */
export type FeedEvent =
  | { type: "row"; id: string; kind: RowKind; text: string }
  | { type: "append"; id: string; delta: string };

export type FeedRow = { id: string; kind: RowKind; text: string };

type Listener = (event: FeedEvent) => void;

type Bridge = {
  send(text: string): Promise<void>;
  listen(listener: Listener): Promise<() => void>;
  version(): Promise<string>;
};

/** Канал Tauri, по которому лента получает строки (src-tauri/src/opencode/mod.rs). */
const FEED_CHANNEL = "chat-feed";

const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Живой мост в окне Tauri: ответ приходит событиями ленты, а не телом команды. */
const tauriBridge = (): Bridge => ({
  async send(text: string) {
    await invoke("chat_send", { text });
  },
  async listen(listener: Listener) {
    return listen<FeedEvent>(FEED_CHANNEL, (event) => listener(event.payload));
  },
  async version() {
    return (await invoke<string>("app_version")) as string;
  },
});

/** Заглушка вне окна: лента идёт по фикстуре, отправка уходит в пустоту. */
const fixtureBridge = (): Bridge => ({
  async send(text: string) {
    fixture.push(text);
  },
  async listen(listener: Listener) {
    return fixture.play(listener);
  },
  async version() {
    return "снапшот интерфейса";
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