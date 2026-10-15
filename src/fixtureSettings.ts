// Настройки вне окна Tauri (docs/specs/2026-10-06-12-nastrojki.md): провайдеры
// и их ключи, умолчания прав и папка данных — та же форма, что отдают команды
// окна (src-tauri/src/providers.rs, plugins/commands.rs). Память страницы:
// ключ после сохранения остаётся «задан» до перезагрузки (Диспетчер учётных
// данных в окне её тоже не меняет), правила — до перезагрузки.

import { params } from "./viewparams";
import type { LocalServer, ProviderRow, RuleEntry } from "./bridge";

/** Полный путь данных фикстуры: длинный Windows-путь — кадр «Папка данных»
 *  проверяет перенос по словам (спека «Где снимать»). */
export const DATA_FOLDER = "C:\\Users\\Metalismatic\\AppData\\Roaming\\com.gnomecode.app\\data";

/** Провайдеры минимальные и настоящие: у движка есть свой провайдер из его
 *  аутентификации (у владельца — opencode-go, ключ НЕ в GnomeCode), ключи
 *  остальных не заданы — владелец 14.10: «я не подключал ключ от глм ещё». */
const ROWS: { id: string; name: string; models: number }[] = [
  { id: "opencode-go", name: "OpenCode Go", models: 7 },
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

/** Ключи страницы: ключей нет — владелец 14.10: «я не подключал ключ от глм
 *  ещё» (аутентификация движка — его собственная, мимо GnomeCode). */
const keys = new Map<string, boolean>();

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

/** MCP-серверы страницы (B6): память — как opencode.json в окне, до перезагрузки. */
const mcpServers: { name: string; kind: "local" | "remote"; enabled: boolean; detail: string }[] = [
  { name: "filesystem", kind: "local", enabled: true, detail: "npx -y @modelcontextprotocol/server-filesystem ." },
];

export function mcpList(): typeof mcpServers {
  return mcpServers.map((one) => ({ ...one }));
}

export function mcpSetEnabled(name: string, enabled: boolean): void {
  const held = mcpServers.find((one) => one.name === name);
  if (!held) {
    throw new Error(`сервера «${name}» нет в конфигурации`);
  }
  held.enabled = enabled;
}

export function mcpAdd(name: string, kind: "local" | "remote", detail: string): void {
  if (mcpServers.some((one) => one.name === name)) {
    throw new Error(`сервер «${name}» уже есть в конфигурации`);
  }
  if (!name.trim()) {
    throw new Error("имя сервера пустое");
  }
  if (kind === "remote" && !/^https?:\/\//.test(detail.trim())) {
    throw new Error("адрес remote-сервера должен начинаться с http(s)://");
  }
  if (kind === "local" && !detail.trim()) {
    throw new Error("укажите команду локального сервера");
  }
  mcpServers.push({ name: name.trim(), kind, enabled: true, detail: detail.trim() });
}

export function mcpRemove(name: string): void {
  const at = mcpServers.findIndex((one) => one.name === name);
  if (at === -1) {
    throw new Error(`сервера «${name}» нет в конфигурации`);
  }
  mcpServers.splice(at, 1);
}

/** Скиллы страницы (B7): память — как command/*.md в окне, до перезагрузки. */
const skills: { name: string; description: string; text: string }[] = [
  {
    name: "img-to-3d",
    description: "Конвертировать картинку в 3D модель",
    text: "Инструкция: получив изображение, конвертируй его в 3D модель через внешний инструмент и верни путь к результату.",
  },
  {
    name: "weekly-report",
    description: "Недельный доклад по проекту",
    text: "Инструкция: собери доклад — что сделано за неделю, ключевые решения, риски и следующие шаги.",
  },
];

export function skillsList(): typeof skills {
  return skills.map((one) => ({ ...one }));
}

export function skillsSave(name: string, description: string, text: string): typeof skills {
  const clean = name.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!clean) {
    throw new Error("имя скилла — латиница, цифры и дефис");
  }
  const held = skills.find((one) => one.name === clean);
  if (held) {
    held.description = description.trim();
    held.text = text;
  } else {
    skills.push({ name: clean, description: description.trim(), text });
  }
  return skillsList();
}

export function skillsRemove(name: string): typeof skills {
  const at = skills.findIndex((one) => one.name === name);
  if (at === -1) {
    throw new Error(`скилла «${name}» нет`);
  }
  skills.splice(at, 1);
  return skillsList();
}

/** Умолчания прав: ask везде, у Terminal задан deny (кадр «настройки-плагины»). */
const defaults: Record<string, string> = {
  Read: "ask",
  Write: "ask",
  Network: "ask",
  Terminal: "deny",
};

/** Известные локальные серверы — то же, что у Rust (providers_store.rs
 *  LOCAL_SERVERS): детект подсказывает их карточкой «Найден … — подключить?». */
const LOCAL: LocalServer[] = [
  { kind: "ollama", name: "Ollama", baseUrl: "http://localhost:11434/v1" },
  { kind: "lmstudio", name: "LM Studio", baseUrl: "http://localhost:1234/v1" },
];

/** Ключ базы URL для сравнения — зеркало providers_store.rs::base_key. */
function baseKey(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "").replace("127.0.0.1", "localhost");
}

/** Кадр состояния задаёт, кто из серверов «отвечает»: детект как живой Rust,
 *  но вместо портов — параметр адреса. Подключённые карточкой не возвращаются. */
export function localServers(): LocalServer[] {
  const answering: Record<string, string[]> = {
    "настройки-ollama": ["ollama"],
    "настройки-lmstudio": ["lmstudio"],
    "настройки-локальные": ["ollama", "lmstudio"],
  };
  const kinds = answering[params.feed];
  if (!kinds) {
    return [];
  }
  const connected = endpoints.map((one) => baseKey(one.baseUrl));
  return LOCAL.filter((one) => kinds.includes(one.kind) && !connected.includes(baseKey(one.baseUrl)));
}

/** Каталог провайдеров models.dev для списка «как у опенкода» (владелец
 *  14.10): узнаваемые имена, у каждого можно задать ключ. Вне настроек — пусто. */
const CATALOG_ROWS: ProviderRow[] = [
  { id: "deepseek", name: "DeepSeek", models: 6, endpoint: false, catalog: true, enabled: true },
  { id: "anthropic", name: "Anthropic", models: 8, endpoint: false, catalog: true, enabled: true },
  { id: "openai", name: "OpenAI", models: 16, endpoint: false, catalog: true, enabled: true },
  { id: "google", name: "Google", models: 12, endpoint: false, catalog: true, enabled: true },
  { id: "xai", name: "xAI", models: 5, endpoint: false, catalog: true, enabled: true },
  { id: "mistral", name: "Mistral", models: 9, endpoint: false, catalog: true, enabled: true },
  { id: "groq", name: "Groq", models: 7, endpoint: false, catalog: true, enabled: true },
  { id: "openrouter", name: "OpenRouter", models: 40, endpoint: false, catalog: true, enabled: true },
];

/** Каталог для раздела провайдеров: вне настроек пусто. */
export function providerCatalog(): ProviderRow[] {
  if (!params.feed.startsWith("настройки")) {
    return [];
  }
  return CATALOG_ROWS;
}

/** Провайдеры настройками: движок плюс свои endpoint'ы; движок недоступен — ошибка. */
export function providers(): ProviderRow[] {  if (!params.feed.startsWith("настройки")) {
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
    catalog: false,
    enabled: !disabled.has(one.id),
    // OpenCode Go в фикстуре подключён в самом движке (как у владельца):
    // строка показывает «через движок ✓» без формы ключа.
    ...(one.id === "opencode-go" ? { engineAuth: true } : {}),
  }));
  // Модель своего endpoint'а движок отдаёт в секцию «Модели движка» —
  // fixtureCompare показывает её, пока endpoint включён.
  const mine: ProviderRow[] = endpoints.map((one) => ({
    id: one.id,
    name: one.name,
    models: one.models.length,
    endpoint: true,
    catalog: false,
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
