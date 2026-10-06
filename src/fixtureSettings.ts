// Настройки вне окна Tauri (docs/specs/2026-10-06-12-nastrojki.md): провайдеры
// и их ключи, умолчания прав и папка данных — та же форма, что отдают команды
// окна (src-tauri/src/providers.rs, plugins/commands.rs). Память страницы:
// ключ после сохранения остаётся «задан» до перезагрузки (Диспетчер учётных
// данных в окне её тоже не меняет), правила — до перезагрузки.

import { params } from "./viewparams";
import type { ProviderRow, RuleEntry } from "./bridge";

/** Полный путь данных фикстуры: длинный Windows-путь — кадр «Папка данных»
 *  проверяет перенос по словам (спека «Где снимать»). */
export const DATA_FOLDER = "C:\\Users\\Metalismatic\\AppData\\Roaming\\com.gnomecode.app\\data";

/** Провайдеры минимальные и настоящие: у ZhipuAI ключ задан (модели отдаёт),
 *  у Anthropic и OpenAI не задан (спека, «Где снимать»). */
const ROWS: { id: string; name: string; models: number }[] = [
  { id: "zhipuai", name: "ZhipuAI", models: 12 },
  { id: "anthropic", name: "Anthropic", models: 8 },
  { id: "openai", name: "OpenAI", models: 16 },
];

/** Ключи страницы: «задан» у ZhipuAI с самого начала. */
const keys = new Map<string, boolean>([["zhipuai", true]]);

/** Умолчания прав: ask везде, у Terminal задан deny (кадр «настройки-плагины»). */
const defaults: Record<string, string> = {
  Read: "ask",
  Write: "ask",
  Network: "ask",
  Terminal: "deny",
};

/** Провайдеры настройками: список от движка; движок недоступен — ошибка. */
export function providers(): ProviderRow[] {
  if (!params.feed.startsWith("настройки")) {
    return [];
  }
  if (params.feed === "настройки-движок") {
    throw new Error("движок не отвечает");
  }
  return ROWS.map((one) => ({ id: one.id, name: one.name, models: one.models }));
}

/** Статусы ключей перечисленных провайдеров. */
export function keyRows(ids: string[]): Record<string, boolean> {
  const held: Record<string, boolean> = {};
  for (const id of ids) {
    held[id] = keys.get(id) ?? false;
  }
  return held;
}

/** Сохранить ключ: память страницы — «задан»; в состоянии ошибки движок
 *  отвечает отказом — строка «Не принято: …» остаётся на экране (кадр). */
export function saveKey(provider: string, secret: string): Record<string, boolean> {
  if (!secret.trim()) {
    throw new Error("ключ пустой: вставьте ключ провайдера");
  }
  if (params.feed === "настройки-ключ-ошибка") {
    throw new Error("провайдер отклонил ключ: 401 unauthorized");
  }
  keys.set(provider, true);
  return { [provider]: true };
}

export function removeKey(provider: string): Record<string, boolean> {
  keys.delete(provider);
  return { [provider]: false };
}

/** Умолчания прав списком: порядок — как на кнопках PluginConfig. */
export function defaultsList(): RuleEntry[] {
  if (!params.feed.startsWith("настройки")) {
    return [];
  }
  return ["Read", "Write", "Network", "Terminal"].map((category) => ({
    category,
    value: defaults[category] ?? "ask",
  }));
}

export function setDefault(category: string, value: string): RuleEntry[] {
  defaults[category] = value;
  return defaultsList();
}
