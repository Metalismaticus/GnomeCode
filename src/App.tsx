import { useCallback, useState } from "react";

import { bridge } from "./bridge";
import {
  useChatModels,
  useFeedReset,
  useNarrow,
  usePanelOverlay,
  useSavedState,
} from "./app/hooks";
import { useThemeToggle } from "./app/theme";
import { chatsList, projectsList } from "./app/lists";
import { moneyOf } from "./compare";
import { ChatView } from "./components/ChatView";
import { ContextPanel } from "./components/ContextPanel";
import { PluginsPage } from "./components/PluginsPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { StatsPage } from "./components/StatsPage";
import { WindowCluster } from "./components/WindowCluster";
import { panels } from "./fixture";
import { patchState, type WindowState } from "./appstate";
import { useApproval } from "./features/plugins/useApproval";
import { usePlugins } from "./features/plugins/usePlugins";
import { useProject } from "./features/project/useProject";
import { useStats } from "./features/stats/useStats";
import { params, type Theme } from "./viewparams";

import "./styles/app.css";

/** Что открыто в окне: чат, «Плагины», «Статистика» или настройки. Страницы
 *  размонтируют друг друга — черновик композера и оверлеи чата гаснут при
 *  выходе; список плагинов при этом один на окно (App держит его сам), и кнопки
 *  команд в шапке пересчитываются сразу, в том числе после Enable/Disable раздела. */
type Page = "chat" | "plugins" | "settings" | "stats";

/** Главное окно: корень только собирает три колонки, держит тему и оверлей панели.
 *  Тема, титул чата и папка приходят из состояния окна (`src/appstate.ts`): в окне
 *  Tauri они переживают перезапуск, для снимков фикстура показывает свою ленту. */
export default function App() {
  const [theme, setTheme] = useState<Theme>(params.theme);
  const toggleTheme = useThemeToggle(theme, setTheme);
  const [panelOpen, setPanelOpen] = useState(params.right);
  /** Пикер, позванный кнопкой «Подключить» правой панели: открытость держит
   *  App (панель — сосед чата), рисует ChatView — оверлей области чата, окно
   *  видно целиком произвольно от двери (замечание владельца 2026-10-07). */
  const [panelPicker, setPanelPicker] = useState(false);
  const openPanelPicker = useCallback(() => setPanelPicker(true), []);
  const closePanelPicker = useCallback(() => setPanelPicker(false), []);
  const narrow = useNarrow();
  /** Прямой доступ раздела для снимков и сценария: `?состояние=плагины-раздел`
   *  и `?состояние=плагины-обновления` (вкладка Updates), `?состояние=настройки*`
   *  (страница настроек — вкладки «настройки-модели» и другие). Состояния
   *  страницы — docs/TESTING.md, раздел «Полигон». */
  const [page, setPage] = useState<Page>(
    params.feed.startsWith("настройки")
      ? "settings"
      : params.feed === "plugins-section" || params.feed === "plugins-updates"
        ? "plugins"
        : params.feed === "статистика" || params.feed === "статистика-пусто"
          ? "stats"
          : "chat",
  );
  const data = panels(params.feed);
  // Папка проекта и титул чата: сначала фикстура/пусто, после ответа моста — сохранённые.
  // Титул не берётся из фиксёрного списка: otherwise «known непусто» считает его
  // настоящим чатом и первый вопрос титул не записывает.
  const [projectRoot, setProjectRoot] = useState(data.project);
  const project = useProject(projectRoot);
  /** Плагины и окно одобрения живут на уровне окна: их показывают и шапка чата,
   *  и правая панель — строки команд панели идут через тот же ход одобрения.
   *  Исполненный вызов растит счётчик (usage.json): список перечитывается,
   *  иначе карточка раздела «Плагины» показала бы счётчик прошлого запуска. */
  const plugins = usePlugins();
  const approval = useApproval(plugins.refresh);
  const chat = useChatModels();
  /** Расход активного проекта для сайдбара («этот проект стоил X»): итог за
   *  всё время — одной командой моста, экран статистики держит свой период. */
  const stats = useStats("all");

  /** «Новый чат»: лента чистится событием `reset`, движку поднимается новая
   *  сессия; титул и время чата сбрасывает тот же ход (использование — кнопка
   *  сайдбара и карточка приветствия, замечание владельца 2026-10-06). Оба входа
   *  зовут этот один колбэк, и он же возвращает на страницу чата: кнопка видна
   *  из любого раздела (сайдбар всегда на месте) — без этого «Новый чат» из
   *  «Статистики», «Плагинов» или настроек чистил ленту невидимо (баг
   *  владельца 09.10). Со страницы чата — no-op, перемонтажа нет. */
  const newChat = useCallback(() => {
    setPage("chat");
    void bridge().newChat();
  }, []);
  useFeedReset(
    useCallback(() => {
      chat.dropChat();
      void patchState({ chatTitle: "", chatTime: 0 });
    }, [chat.dropChat]),
  );

  // Состояние прошлого запуска — один запрос при старте: см. useSavedState.
  const applySaved = useCallback((saved: WindowState) => {
    if (saved.project) {
      setProjectRoot(saved.project);
    }
    if (saved.theme) {
      setTheme(saved.theme);
    }
    chat.applySaved(saved);
  }, [chat.applySaved]);
  useSavedState(applySaved);

  /** Возврат в чат со страницы настроек: фокус — шестерёнке сайдбара
   *  (спека «Клавиатура», Esc и клик по активной строке ведут его же). */
  const closeSettings = useCallback(() => {
    setPage("chat");
    requestAnimationFrame(() => {
      (document.querySelector('[data-testid="sidebar-settings"]') as HTMLElement | null)?.focus();
    });
  }, []);

  // Оверлей правой панели закрывается сам — см. usePanelOverlay.
  usePanelOverlay(narrow, panelOpen, setPanelOpen);

  const chats = chatsList(data, chat.title, chat.time);
  /** Проекты с линией стоимости: деньги известной части — у строки активного
   *  проекта второй линией, когда по нему есть записи расхода. */
  const lifetime = stats.summary?.projects.find((one) => one.path === projectRoot);
  const projects = projectsList(data, projectRoot).map((one) =>
    one.path !== undefined && one.path === projectRoot && lifetime?.usage.cost != null
      ? { ...one, cost: moneyOf(lifetime.usage.cost) }
      : one,
  );

  /** Право этого чата на файлы: включён, раз папка проекта выбрана. Владелец
   *  тумблером правой панели его выключает и включает (замечание владельца
   *  2026-10-06: «не нажимаются переключатели») — файлы гейтит слой отправки
   *  (ChatView.ask), в движок меткой не уходит. */
  const [fsAllow, setFsAllow] = useState(true);

  return (
    <div className="app">
      {/* Кластер кнопок окна (тема + свернуть/развернуть/закрыть) — правый край
          окна: при ширине от 1200 px его шапка — шапка правой панели, при узком
          окне — шапка чата; один узел, два дома (WindowCluster.tsx). */}
      <Sidebar
        projects={projects}
        chats={chats}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPickFolder={project.pick}
        onOpenPlugins={() => setPage("plugins")}
        onOpenStats={() => setPage("stats")}
        onOpenSettings={() => setPage("settings")}
        settingsOpen={page === "settings"}
        onOpenChat={() => setPage("chat")}
        onNewChat={newChat}
      />
      {page === "plugins" ? (
        <PluginsPage plugins={plugins} />
      ) : page === "settings" ? (
        <SettingsPage
          theme={theme}
          onToggleTheme={toggleTheme}
          defaultModel={chat.defaultModel}
          onChooseDefault={chat.chooseDefault}
          onClose={closeSettings}
        />
      ) : page === "stats" ? (
        <StatsPage />
      ) : (
        <ChatView
          title={chat.title || "Новый чат"}
          narrow={narrow}
          cluster={<WindowCluster theme={theme} onToggleTheme={toggleTheme} />}
          onTogglePanel={() => setPanelOpen(!panelOpen)}
          panelOpen={panelOpen}
          project={project}
          onFirstQuestion={chat.remember}
          onOpenPluginsPage={() => setPage("plugins")}
          fsAllow={fsAllow}
          model={chat.model}
          onChooseModel={chat.choose}
          plugins={plugins}
          approval={approval}
          counts={{ chats: chats.length, projects: projects.length }}
          onNewChat={newChat}
          panelPickerOpen={panelPicker}
          onClosePanelPicker={closePanelPicker}
        />
      )}
      {narrow && !panelOpen ? null : (
        <ContextPanel
          sections={data.sections}
          engineDown={data.engineDown}
          project={project}
          fsAllow={fsAllow}
          onToggleFs={() => setFsAllow((allow) => !allow)}
          plugins={plugins}
          onRunCommand={approval.run}
          onConnectPlugins={openPanelPicker}
          cluster={narrow ? null : <WindowCluster theme={theme} onToggleTheme={toggleTheme} />}
        />
      )}
    </div>
  );
}
