// Мост-фикстура вне окна Tauri: страница vite, снимки и UI-сценарии видят ту
// же ленту, дерево и карточки, что продукт, — на памяти фикстуры (src/fixture*.ts).

import { fixture } from "../fixture";
import type { WindowState, WindowPatch } from "../appstate";
import type { ApprovalDecision, Bridge, Listener, PluginScope } from "./types";
import { readFixtureState, writeFixtureState } from "../fixtureState";
import {
  applyUpdate as applyUpdateFixture,
  connect as connectFixture,
  detach as detachFixture,
  disable as disableFixture,
  enable as enableFixture,
  heldUpdates as heldUpdatesFixture,
  plugins as fixturePlugins,
  takeOnce as takeOnceFixture,
  uninstall as uninstallFixture,
} from "../fixturePlugins";
import { params } from "../viewparams";
import { entries as fixtureCatalog, install as installFixture } from "../fixtureCatalog";
import { list as fixtureCompare } from "../fixtureCompare";
import {
  addEndpoint as addEndpointFixture,
  providers as settingsProviders,
  keyRows as keyFixture,
  removeEndpoint as removeEndpointFixture,
  saveKey as saveKeyFixture,
  removeKey as removeKeyFixture,
  setEnabled as setEnabledFixture,
  defaultsList as defaultsFixture,
  setDefault as setDefaultFixture,
  DATA_FOLDER,
} from "../fixtureSettings";
import {
  granted as fixtureGranted,
  launch as fixtureLaunch,
  remember as fixtureRemember,
  refuse as fixtureRefuse,
  ruleOf,
  setRule,
  denyByRule,
} from "../fixtureApprovals";
import { children as fixtureChildren, project as fixtureProject, ROOT as fixtureRoot } from "../fixtureTree";
import {
  connect as connectToolsetFixture,
  list as listToolsetsFixture,
  remove as deleteToolsetFixture,
  save as saveToolsetFixture,
} from "../fixtureToolsets";

/** Заглушка вне окна: лента и дерево идут по фикстуре, диалога на странице нет —
 *  папкой проекта становится та, что в фикстуре (src/fixture.ts). */
export const fixtureBridge = (): Bridge => ({
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
  async feedReplay() {
    // Фикстура играет всю ленту сама при подписке — повторять нечего.
  },
  async version() {
    return "снапшот интерфейса";
  },
  async pickFolder() {
    // Диалог в фикстуре: владелец выбрал корень фикстуры (тот же путь, что
    // `project()` отвечает состоянию `?состояние=проект`) — пустое состояние
    // честно проходит путь выбора папки, как `?состояние=проект` с готовой.
    return fixtureRoot;
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
    // Каталог в состоянии фикстуры отвечал: пометки о недоступности нет;
    // удержанные — тот же набор, что карточки «ждёт прав» вкладки Updates.
    return { note: null, held: heldUpdatesFixture() };
  },
  async catalogList() {
    return fixtureCatalog();
  },
  async compareList() {
    recordCompareRead();
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
  async providerSetEnabled(id: string, enabled: boolean) {
    return setEnabledFixture(id, enabled);
  },
  async endpointAdd(name: string, baseUrl: string, key: string) {
    return addEndpointFixture(name, baseUrl, key);
  },
  async endpointRemove(id: string) {
    return removeEndpointFixture(id);
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

/** Чтения каталога сравнения, зафиксированные фикстурой: сценарий темпа чтения
 *  панели считает их со страницы (`window.__compareListCalls`) — настоящих
 *  вызовов моста на странице нет, а цикл перечитывания виден только числом. */
function recordCompareRead(): void {
  const holder = window as unknown as { __compareListCalls?: number };
  holder.__compareListCalls = (holder.__compareListCalls ?? 0) + 1;
}

/** Состояние «развёрнуто» у фикстуры: Toggle возвращает его же наизнанку. */
let maximizedFixture = false;

/** Тема строки зеркала, если она названа. */
function windowState(theme: string): WindowState["theme"] {
  return theme === "light" || theme === "dark" ? theme : null;
}
