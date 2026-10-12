// Живой список чатов ядра — кусок моста для сайдбара (спека сайдбара §7):
// одна команда при старте окна, формы элемента списка интерфейс не знает
// (ADR-0001). Реализации Bridge не тронуты: сайдбару не нужен целый мост,
// а окно без движка отвечает пустотой, не поломкой.

import { invoke } from "@tauri-apps/api/core";

import { inTauri } from "./tauri";
import type { ChatRow } from "./types";

/** Загруженные сессии ядра одним запросом (`chat_list`); вне окна Tauri сессий
 *  ядра нет — пусто, сайдбар живёт тем, что уже передало окно. */
export async function chatList(): Promise<ChatRow[]> {
  if (!inTauri()) {
    return [];
  }
  return (await invoke<ChatRow[]>("chat_list")) as ChatRow[];
}
