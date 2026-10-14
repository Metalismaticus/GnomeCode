import { useCallback, useEffect, useRef, useState } from "react";

import { bridge } from "./bridge";
import type { ImportScan } from "./bridge";
import {
  useChatModels,
  useFeedLoaded,
  useFeedReset,
  usePanelOverlay,
  useSavedState,
} from "./app/hooks";
import { useThemeToggle } from "./app/theme";
import { chatsList, projectsList } from "./app/lists";
import { moneyOf } from "./compare";
import { ChatView } from "./components/ChatView";
import { ImportFirstRun } from "./components/ImportFirstRun";
import { ContextPanel } from "./components/ContextPanel";
import { PluginsPage } from "./components/PluginsPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar } from "./components/Sidebar";
import { StatsPage } from "./components/StatsPage";
import { WindowCluster } from "./components/WindowCluster";
import { panels } from "./fixture";
import { patchState, type WindowState } from "./appstate";
import type { SidebarChat } from "./components/Sidebar";
import { useApproval } from "./features/plugins/useApproval";
import { usePlugins } from "./features/plugins/usePlugins";
import { useProject } from "./features/project/useProject";
import { useChatActions } from "./features/chat/useChatActions";
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
  /** Экран первого запуска (DT1): скан конфигурации один на запуск. Есть
   *  импортированные-выключенные — окно комбинированного одобрения поверх;
   *  «обработано» только явным действием (Включить выбранные или Пропустить).
   *  Свежее этого запуска — тост «Найден новый плагин · включить» (F10). */
  const [importScan, setImportScan] = useState<ImportScan | null>(null);
  const [importToast, setImportToast] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    bridge()
      .importScan()
      .then((scan) => {
        if (!alive) {
          return;
        }
        if (scan.disabled.length) {
          setImportScan(scan);
        }
        if (scan.fresh.length) {
          setImportToast(scan.fresh[0]);
        }
      })
      .catch(() => {
        // Скан не читается — экрана нет, окно работает как раньше (S2).
      });
    return () => {
      alive = false;
    };
  }, []);
  /** «Включить выбранные»: комбинированное одобрение уже дано на экране —
   *  включение каждой записи тем же путём, что Enable в менеджере. */
  const enableImported = (ids: string[]) => {
    for (const id of ids) {
      plugins.setEnabled(false, id);
    }
    setImportScan(null);
  };
  /** Чаты окна: живой список ядра, архив и действия меню строки
   *  (переименовать, удалить, в архив и вернуть) — одно место, Sidebar
   *  только показывает. */
  /** Отказ действия меню строки (удалить/переименовать) виден полосой над
   *  окном 6 секунд и по клику исчезает: молчаливый отказ не даёт диагноза
   *  (баг владельца 14.10 — «Удалить не работает» без единого слова). */
  const [actionError, setActionError] = useState<string | null>(null);
  const actionTimer = useRef<number | null>(null);
  const onActionError = useCallback((action: string, reason: unknown) => {
    setActionError(`${action} не удалось: ${String(reason)}`);
    if (actionTimer.current !== null) {
      window.clearTimeout(actionTimer.current);
    }
    actionTimer.current = window.setTimeout(() => setActionError(null), 6000);
  }, []);
  const chatActions = useChatActions(onActionError);
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
  /** Открытый кликом чат: титул, время и сессия строки применяются сразу по
   *  клику, не дожидаясь моста: шапка и активная строка сайдбара
   *  переключаются тем же жестом, а не через миг (замечание владельца
   *  2026-10-10, «дёргание при переключении чатов»). «Новый чат» открывшего
   *  не ставит — сбрасывает, как раньше. Обработчик `reset` повторяет
   *  применение (идемпотентно) и несёт правку в состояние окна. */
  const openingRef = useRef<{ id: string; title: string; time: number | null } | null>(null);
  const [switching, setSwitching] = useState(false);
  const openChatRow = useCallback(
    (row: SidebarChat) => {
      if (!row.id) {
        return;
      }
      setPage("chat");
      openingRef.current = { id: row.id, title: row.title, time: row.time ?? null };
      setSwitching(true);
      chat.applySaved({
        session: row.id,
        chatTitle: row.title,
        chatTime: row.time ?? null,
        project: null,
        theme: null,
        pluginFavorites: null,
        pluginRecent: null,
        chatModel: null,
        defaultModel: null,
        archivedChats: null,
      });
      void bridge().openChat(row.id);
    },
    [chat.applySaved],
  );
  useFeedReset(
    useCallback(() => {
      const opened = openingRef.current;
      openingRef.current = null;
      if (opened) {
        // Титул, время и сессия открытой строки — через applySaved: вопрос в
        // открытом чате титул больше не переписывает (у чата он уже есть).
        chat.applySaved({
          session: opened.id,
          chatTitle: opened.title,
          chatTime: opened.time,
          project: null,
          theme: null,
          pluginFavorites: null,
          pluginRecent: null,
          chatModel: null,
          defaultModel: null,
          archivedChats: null,
        });
        void patchState({ session: opened.id, chatTitle: opened.title, chatTime: opened.time ?? 0 });
      } else {
        chat.dropChat();
        void patchState({ chatTitle: "", chatTime: 0, session: "" });
      }
    }, [chat.applySaved, chat.dropChat]),
  );
  /** История открытого чата доехала: лента показывает её (или пустой чат) —
   *  состояние «открывается» снимается (useFeedLoaded). */
  useFeedLoaded(useCallback(() => setSwitching(false), []));

  // Состояние прошлого запуска — один запрос при старте: см. useSavedState.
  const applySaved = useCallback(
    (saved: WindowState) => {
      if (saved.project) {
        setProjectRoot(saved.project);
      }
      if (saved.theme) {
        setTheme(saved.theme);
      }
      chat.applySaved(saved);
      // Архив чатов помнится между запусками: убранные строки не возвращаются
      // сами после рестарта (состояние окна, patchState).
      chatActions.applyArchived(saved.archivedChats);
    },
    [chat.applySaved, chatActions.applyArchived],
  );
  useSavedState(applySaved);

  /** Убрать проект (меню строки проекта): папка на диске остаётся, окно
   *  возвращается в состояние «проект не выбран» — ответ моста несёт новый
   *  корень, по нему список проектов и рисуется заново. */
  const removeProject = useCallback(() => {
    bridge()
      .projectRemove()
      .then((root) => setProjectRoot(root ?? ""))
      .catch(() => {
        // Мост не ответил: проект как был в списке, чинить нечего.
      });
  }, []);

  /** Переименовать чат (меню строки): заголовок меняется в движке, список
   *  перечитывается. Переименовали открытый чат — титул окна едет за ним:
   *  шапка и строка сайдбара без этого показывали бы прошлое имя. */
  const renameChat = useCallback(
    (id: string, title: string, wasActive: boolean) => {
      chatActions.rename(id, title);
      if (wasActive) {
        chat.applySaved({
          session: null,
          chatTitle: title,
          chatTime: chat.time,
          project: null,
          theme: null,
          pluginFavorites: null,
          pluginRecent: null,
          chatModel: null,
          defaultModel: null,
          archivedChats: null,
        });
        void patchState({ chatTitle: title });
      }
    },
    [chatActions, chat.applySaved, chat.time],
  );

  /** Удалить чат совсем (меню строки): сессия и история уходят из движка.
   *  Удалили открытый — титул и сессия окна снимаются: следующий вопрос
   *  начнёт новый чат, а лента до тех пор показывает прошлый разговор. */
  const deleteChat = useCallback(
    (id: string, wasActive: boolean) => {
      chatActions.remove(id);
      if (wasActive) {
        chat.dropChat();
        void patchState({ chatTitle: "", chatTime: 0, session: "" });
      }
    },
    [chatActions, chat.dropChat],
  );

  /** Возврат в чат со страницы настроек: фокус — кнопке «⋯» шапки (§18 спеки
   *  сайдбара: шестерёнки в сайдбаре больше нет, прежний адрес фокуса исчез). */
  const closeSettings = useCallback(() => {
    setPage("chat");
    requestAnimationFrame(() => {
      (document.querySelector('[data-testid="header-more"]') as HTMLElement | null)?.focus();
    });
  }, []);

  // Оверлей правой панели закрывается сам — см. usePanelOverlay.
  usePanelOverlay(panelOpen, setPanelOpen);

  const chats = chatsList(data, chat.title, chat.time, chat.sessionId);
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
      {/* Кластер кнопок окна (тема + свернуть/развернуть/закрыть) живёт в
          верхней полосе каждой страницы: чата, «Плагинов», «Статистики» и
          настроек — окно без рамки, управление окном не пропадает
          (замечание владельца 2026-10-10). */}
      <Sidebar
        projects={projects}
        chats={chats}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPickFolder={project.pick}
        onRemoveProject={removeProject}
        onOpenStats={() => setPage("stats")}
        onOpenChat={() => setPage("chat")}
        onOpenChatRow={openChatRow}
        onRenameChat={renameChat}
        onDeleteChat={deleteChat}
        onNewChat={newChat}
        chatActions={chatActions}
      />
      {page === "plugins" ? (
        <PluginsPage plugins={plugins} cluster={<WindowCluster theme={theme} onToggleTheme={toggleTheme}  />} />
      ) : page === "settings" ? (
        <SettingsPage
          theme={theme}
          onToggleTheme={toggleTheme}
          defaultModel={chat.defaultModel}
          onChooseDefault={chat.chooseDefault}
          onClose={closeSettings}
          cluster={<WindowCluster theme={theme} onToggleTheme={toggleTheme}  />}
        />
      ) : page === "stats" ? (
        <StatsPage cluster={<WindowCluster theme={theme} onToggleTheme={toggleTheme}  />} />
      ) : (
        <ChatView
          title={chat.title || "Новый чат"}
          cluster={<WindowCluster theme={theme} onToggleTheme={toggleTheme}  />}
          onTogglePanel={() => setPanelOpen(!panelOpen)}
          panelOpen={panelOpen}
          project={project}
          onFirstQuestion={chat.remember}
          onOpenPluginsPage={() => setPage("plugins")}
          onOpenSettings={() => setPage("settings")}
          engineDown={data.engineDown}
          fsAllow={fsAllow}
          model={chat.model}
          onChooseModel={chat.choose}
          plugins={plugins}
          approval={approval}
          counts={{ chats: chats.length, projects: projects.length }}
          onNewChat={newChat}
          switching={switching}
          panelPickerOpen={panelPicker}
          onClosePanelPicker={closePanelPicker}
        />
      )}
      {/* Правая панель скрыта по умолчанию на любой ширине («тихий хром», §6):
          открывается из меню «⋯» или кликом по источнику-файлу, живёт оверлеем
          и закрывается ✕/Esc/кликом мимо. `?правая=открыта` работает как раньше. */}
      {panelOpen ? (
        <ContextPanel
          sections={data.sections}
          engineDown={data.engineDown}
          project={project}
          fsAllow={fsAllow}
          onToggleFs={() => setFsAllow((allow) => !allow)}
          plugins={plugins}
          onRunCommand={approval.run}
          onConnectPlugins={openPanelPicker}
          onClose={() => setPanelOpen(false)}
        />
      ) : null}
      {importToast ? (
        <div className="action-flash import-toast" data-testid="import-toast">
          <span>Найден новый плагин {importToast}</span>
          <button
            type="button"
            onClick={() => {
              plugins.setEnabled(false, importToast);
              setImportToast(null);
            }}
          >
            включить
          </button>
          <button type="button" aria-label="Скрыть" onClick={() => setImportToast(null)}>
            ✕
          </button>
        </div>
      ) : null}
      {importScan ? (
        <ImportFirstRun
          scan={importScan}
          onEnable={enableImported}
          onSkip={() => setImportScan(null)}
        />
      ) : null}
      {actionError ? (
        <button type="button" className="action-flash" onClick={() => setActionError(null)}>
          {actionError}
        </button>
      ) : null}
    </div>
  );
}
