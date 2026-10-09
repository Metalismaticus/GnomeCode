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

/** Свои endpoint'ы страницы: память фикстуры, как Credential Manager и
 *  providers.json в окне — до перезагрузки страницы. */
type EndpointRow = { id: string; name: string; baseUrl: string; models: string[] };
const endpoints: EndpointRow[] = [];

/** Выключенные провайдеры и endpoint'ы: тот же список, что в providers.json. */
const disabled = new Set<string>();

/** Ключи страницы: «задан» у ZhipuAI с самого начала. */
const keys = new Map<string, boolean>([["zhipuai", true]]);

/** Идентификатор endpoint'а из базы URL — зеркало правила моста
 *  (src-tauri/src/providers_store.rs::id_from): хост нижним регистром,
 *  всё кроме латиницы и цифр — в дефис, занятый растёт вторым номером. */
function idFrom(baseUrl: string): string {
  const host = baseUrl.split("://")[1] ?? "";
  const bare = (host.split("/")[0] ?? "").split(":")[0] ?? "";
  let slug = "";
  let dash = false;
  for (const letter of bare.toLowerCase()) {
    if (/[a-z0-9]/.test(letter)) {
      slug += letter;
      dash = false;
    } else if (!dash && slug) {
      slug += "-";
      dash = true;
    }
  }
  while (slug.endsWith("-")) {
    slug = slug.slice(0, -1);
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slug.length > 64) {
    slug = "endpoint";
  }
  let candidate = slug;
  let number = 1;
  while (endpoints.some((one) => one.id === candidate)) {
    number += 1;
    candidate = `${slug}-${number}`;
  }
  return candidate;
}

/** Умолчания прав: ask везде, у Terminal задан deny (кадр «настройки-плагины»). */
const defaults: Record<string, string> = {
  Read: "ask",
  Write: "ask",
  Network: "ask",
  Terminal: "deny",
};

/** Провайдеры настройками: движок плюс свои endpoint'ы; движок недоступен — ошибка. */
export function providers(): ProviderRow[] {
  if (!params.feed.startsWith("настройки")) {
    return [];
  }
  if (params.feed === "настройки-движок") {
    throw new Error("движок не отвечает");
  }
  const engine: ProviderRow[] = ROWS.map((one) => ({
    id: one.id,
    name: one.name,
    models: one.models,
    endpoint: false,
    enabled: !disabled.has(one.id),
  }));
  // Модель своего endpoint'а движок отдаёт в секцию «Модели движка» —
  // fixtureCompare показывает её, пока endpoint включён.
  const mine: ProviderRow[] = endpoints.map((one) => ({
    id: one.id,
    name: one.name,
    models: one.models.length,
    endpoint: true,
    enabled: !disabled.has(one.id),
  }));
  return [...engine, ...mine.filter((one) => !engine.some((known) => known.id === one.id))];
}

/** Модели включённых endpoint'ов для секции «Модели движка» (fixtureCompare). */
export function endpointModels(): { id: string; lab: string; models: string[] }[] {
  return endpoints
    .filter((one) => !disabled.has(one.id))
    .map((one) => ({ id: one.id, lab: one.name, models: one.models }));
}

/** Добавить endpoint: имя и база URL обязательны, адрес — http(s), модели
 *  «отвечает» сам endpoint (в фикстуре — по одной на букву имени хоста). */
export function addEndpoint(name: string, baseUrl: string, key: string): ProviderRow[] {
  const trimmedName = name.trim();
  const trimmedUrl = baseUrl.trim();
  if (!trimmedName) {
    throw new Error("имя endpoint'а пустое: введите название");
  }
  if (!/^https?:\/\//.test(trimmedUrl)) {
    throw new Error("база URL должна начинаться с http:// или https://");
  }
  const id = idFrom(trimmedUrl);
  endpoints.push({
    id,
    name: trimmedName,
    baseUrl: trimmedUrl,
    models: ["corp-model-a"],
  });
  if (key.trim()) {
    keys.set(id, true);
  }
  return providers();
}

/** Удалить endpoint: строка и её ключ уходят. */
export function removeEndpoint(id: string): ProviderRow[] {
  const at = endpoints.findIndex((one) => one.id === id);
  if (at >= 0) {
    endpoints.splice(at, 1);
  }
  keys.delete(id);
  return providers();
}

/** Включённость провайдера или endpoint'а: тот же список, что providers.json. */
export function setEnabled(id: string, enabled: boolean): ProviderRow[] {
  if (enabled) {
    disabled.delete(id);
  } else {
    disabled.add(id);
  }
  return providers();
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
