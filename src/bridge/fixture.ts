// Мост-фикстура вне окна Tauri: страница vite, снимки и UI-сценарии видят ту
// же ленту, дерево и карточки, что продукт, — на памяти фикстуры (src/fixture*.ts).

import { fixture } from "../fixture";
import type { WindowState, WindowPatch } from "../appstate";
import type { ApprovalDecision, Bridge, Listener, PluginScope, StatsPeriod } from "./types";
import { readFixtureState, writeFixtureState } from "../fixtureState";
import {
  applyUpdate as applyUpdateFixture,
  connect as connectFixture,
  decline as declineFixture,
  detach as detachFixture,
  disable as disableFixture,
  enable as enableFixture,
  heldUpdates as heldUpdatesFixture,
  importScan as importScanFixture,
  installFile as installFileFixture,
  plugins as fixturePlugins,
  takeOnce as takeOnceFixture,
  uninstall as uninstallFixture,
} from "../fixturePlugins";
import { params } from "../viewparams";
import {
  entries as fixtureCatalog,
  install as installFixture,
  snapshot as fixtureCatalogSnapshot,
} from "../fixtureCatalog";
import { list as fixtureCompare } from "../fixtureCompare";
import { summary as fixtureStats } from "../fixtureStats";
import {
  addEndpoint as addEndpointFixture,
  providers as settingsProviders,
  keyRows as keyFixture,
  localServers as localServersFixture,
  mcpAdd as mcpAddFixture,
  mcpList as mcpListFixture,
  mcpRemove as mcpRemoveFixture,
  mcpSetEnabled as mcpToggleFixture,
  providerCatalog as providerCatalogFixture,
  skillsList as skillsListFixture,
  skillsRemove as skillsRemoveFixture,
  skillsSave as skillsSaveFixture,
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
  async send(text: string, files: string[], memory?: string) {
    fixture.push(text, files);
    // Память чата фикстурой не играется: страница проверки видит вопрос,
    // а не служебную инструкцию, — как живая лента (промпт движку один).
    void memory;
    // Скоуп «Once» (сцена E): соединение служит текущему запросу — следующий
    // вопрос снимает плагин с чата, как registry.take_once (plugin_send).
    takeOnceFixture();
  },
  async newChat() {
    fixture.reset();
  },
  async openChat(id: string) {
    // Тот же ход, что у живого моста: reset и история сессии из ядра —
    // фикстура отвечает своей памятью разговора (src/fixture.ts).
    fixture.open(id);
  },
  async chatRename(id: string, title: string) {
    // Титул меняется в памяти страницы, ответ — свежий список, как у живого
    // моста (chat_rename отвечает списком ядра).
    return fixture.rename(id, title);
  },
  async chatDelete(id: string) {
    // Строка уходит из списка страницы, разговор забывается; ответ — свежий
    // список (баг владельца 14.10: удаление молчало, чат оставался).
    return fixture.remove(id);
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
  async pickFile() {
    // Диалог файла в фикстуре: README корня фикстуры — файл внутри проекта,
    // attach его берёт (проверка «внутри папки» на фикстуре проходит честно).
    return `${fixtureRoot}\\README.md`;
  },
  async openTerminal() {
    // В фикстуре консоли нет: QA ловит сам вызов флагом страницы.
    (window as { __terminalOpened?: boolean }).__terminalOpened = true;
  },
  async projectSymbols(files: string[]) {
    // Символы фикстуры: те же формы, что отдаёт Rust (symbols.rs) для ts-файлов.
    return files.flatMap((file) => [
      { file, kind: "константа", name: "ROOT", line: 9 },
      { file, kind: "функция", name: "children", line: 38 },
    ]);
  },
  async projectGit() {
    // Git-статус фикстуры: ветка, пара изменений и коммиты — формы карточек.
    return {
      branch: "main",
      changes: [
        { status: "M", path: "src/App.tsx" },
        { status: "??", path: "notes.md" },
      ],
      commits: [
        { hash: "a1b2c3d", subject: "Правая панель: вкладки Символы и Git" },
        { hash: "e4f5a6b", subject: "Меню «+»: пункты без «позже»" },
      ],
    };
  },
  async projectRemove() {
    // Своего хранилища проекта у фикстуры нет: уборка возвращает окно в
    // состояние «проект не выбран» — пустой корень, список как до выбора.
    return "";
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
  async installPluginFile(name: string) {
    const list = installFileFixture(name);
    // id записи = имя файла без .ts в slug (Rust отвечает slug'ом с
    // транслитерацией; фикстуре хватает последнего слова пути).
    return list.find((one) => one.source === "external")?.id ?? "";
  },
  async updatesNote() {
    // Каталог в состоянии фикстуры отвечал: пометки о недоступности нет;
    // удержанные — тот же набор, что карточки «ждёт прав» вкладки Updates.
    return { note: null, held: heldUpdatesFixture() };
  },
  async catalogList() {
    return fixtureCatalog();
  },
  async catalogSnapshot() {
    // Кадры «каталог-оффлайн»/«каталог-ошибка» — те же карточки, но из кэша
    // с датой или честный отказ (DT7).
    return fixtureCatalogSnapshot();
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
  async declinePluginUpdate(id: string) {
    // «Оставить текущую» (DT3): запись ждущего прав уходит в «отклонено» —
    // память страницы, как updates.json в окне.
    declineFixture(id);
    return fixturePlugins();
  },
  async systempromptGet() {
    try {
      return localStorage.getItem("gnomecode-systemprompt") ?? "";
    } catch {
      return "";
    }
  },
  async systempromptSet(text: string) {
    try {
      localStorage.setItem("gnomecode-systemprompt", text);
    } catch {
      // Хранилище страницы не всегда доступно — поле не ломаем.
    }
  },
  async eventsStatus() {
    // Тумблер счётчика — память страницы (localStorage): как состояние окна.
    try {
      return localStorage.getItem("gnomecode-events-optin") === "1";
    } catch {
      return false;
    }
  },
  async eventsOptIn(on: boolean) {
    try {
      localStorage.setItem("gnomecode-events-optin", on ? "1" : "0");
    } catch {
      // Хранилище страницы не всегда доступно — тумблер не ломаем.
    }
  },
  async mcpList() {
    return mcpListFixture();
  },
  async mcpSetEnabled(name: string, enabled: boolean) {
    mcpToggleFixture(name, enabled);
  },
  async mcpAdd(name: string, kind: "local" | "remote", detail: string) {
    mcpAddFixture(name, kind, detail);
  },
  async mcpRemove(name: string) {
    mcpRemoveFixture(name);
  },
  async skillsList() {
    return skillsListFixture();
  },
  async skillsSave(name: string, description: string, text: string) {
    return skillsSaveFixture(name, description, text);
  },
  async skillsRemove(name: string) {
    return skillsRemoveFixture(name);
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
      session: fixture.currentId(),
      chatTitle: saved.chatTitle || null,
      project: saved.project || fixtureProject(),
      theme,
      pluginFavorites: saved.pluginFavorites,
      pluginRecent: saved.pluginRecent,
      chatModel: saved.chatModel || null,
      defaultModel: saved.defaultModel || null,
      chatTime: saved.chatTime || null,
      archivedChats: saved.archivedChats,
      pinnedChats: saved.pinnedChats,
      chatMemory: saved.chatMemory ?? null,
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
      archivedChats: patch.archivedChats ?? saved.archivedChats,
      pinnedChats: patch.pinnedChats ?? saved.pinnedChats,
      chatMemory: patch.chatMemory ?? saved.chatMemory,
    };
    writeFixtureState(next);
    return {
      session: fixture.currentId(),
      chatTitle: next.chatTitle || null,
      project: next.project || fixtureProject(),
      theme: windowState(next.theme),
      pluginFavorites: next.pluginFavorites,
      pluginRecent: next.pluginRecent,
      chatModel: next.chatModel || null,
      defaultModel: next.defaultModel || null,
      chatTime: next.chatTime || null,
      archivedChats: next.archivedChats,
      pinnedChats: next.pinnedChats,
      chatMemory: next.chatMemory ?? null,
    };
  },
  async providerList() {
    return settingsProviders();
  },
  async providerCatalog() {
    // Список «как у опенкода»: узнаваемые провайдеры фикстуры — каждому можно
    // задать ключ (в окне их отдаёт models.dev через provider_catalog).
    return providerCatalogFixture();
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
  async localDetect() {
    // Вместо портов — кадр состояния: «отвечают» те, кого назвал адрес.
    return localServersFixture();
  },
  async importScan() {
    // Кадр «первый-запуск» — конфиг с двумя пакетами и одним пропуском.
    return importScanFixture();
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
  async statsSummary(period: StatsPeriod) {
    // Сводка — данные фикстуры: сценарий сверяет суммы строк с итогом на экране.
    return fixtureStats(period);
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
