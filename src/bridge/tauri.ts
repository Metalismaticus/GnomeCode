// Живой мост в окне Tauri: команды уходят движку через invoke, лента приходит
// каналом событий. Вне окна Tauri этот файл не зовётся — фасад выбирает
// фикстуру (src/bridge/fixture.ts).

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  ApprovalDecision,
  Bridge,
  FeedEvent,
  Listener,
  Plugin,
  PluginRun,
  PluginScope,
  ProviderRow,
  RuleEntry,
  ToolSet,
  TreeNode,
  UpdatesNote,
} from "./types";
import type { WindowState, WindowPatch } from "../appstate";
import type { CatalogEntry } from "../catalog";
import type { CompareSnapshot } from "../compare";

/** Канал Tauri, по которому лента получает строки (src-tauri/src/opencode/mod.rs). */
const FEED_CHANNEL = "chat-feed";

/** Строки ленты «движок готов» (константы NOTICE_READY и NOTICE_RECOVERED в
 *  mod.rs — лента и есть контракт моста с окном): список плагинов перечитывается
 *  по ним — при старте окна движок ещё поднимался, и plugin_list честно ответил
 *  «движок не готов»; когда он готов, кнопки плагинов должны появиться сами. */
export const ENGINE_READY_NOTICES: readonly string[] = [
  "Движок OpenCode готов",
  "Сервер OpenCode снова отвечает",
];

export const inTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Живой мост в окне Tauri: ответ приходит событиями ленты, а не телом команды. */
export const tauriBridge = (): Bridge => ({
  async send(text: string, files: string[]) {
    await invoke("chat_send", { text, files });
  },
  async newChat() {
    await invoke("chat_new");
  },
  async listen(listener: Listener) {
    return listen<FeedEvent>(FEED_CHANNEL, (event) => listener(event.payload));
  },
  async feedReplay() {
    await invoke("feed_replay");
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
    return (await invoke<UpdatesNote>("plugin_updates_note")) ?? { note: null, held: [] };
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
    // Строки собирает Rust (ADR-0001): движок плюс свои endpoint'ы, без дублей.
    return (await invoke<ProviderRow[]>("provider_list")) as ProviderRow[];
  },
  async providerSetEnabled(id: string, enabled: boolean) {
    return (await invoke<ProviderRow[]>("provider_set_enabled", { id, enabled })) as ProviderRow[];
  },
  async endpointAdd(name: string, baseUrl: string, key: string) {
    return (await invoke<ProviderRow[]>("endpoint_add", { name, baseUrl, key })) as ProviderRow[];
  },
  async endpointRemove(id: string) {
    return (await invoke<ProviderRow[]>("endpoint_remove", { id })) as ProviderRow[];
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
