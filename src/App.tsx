import { useCallback, useEffect, useState } from "react";

import { bridge, type FeedEvent } from "./bridge";
import { ChatView } from "./components/ChatView";
import { ContextPanel } from "./components/ContextPanel";
import { PluginsPage } from "./components/PluginsPage";
import { SettingsPage } from "./components/SettingsPage";
import { Sidebar, type SidebarChat, type SidebarProject } from "./components/Sidebar";
import { WindowCluster } from "./components/WindowCluster";
import { panels } from "./fixture";
import type { ChatModelChoice } from "./bridge";
import { chatTitleOf, loadState, patchState, DEFAULT_MODEL, type WindowState } from "./appstate";
import { useApproval } from "./features/plugins/useApproval";
import { usePlugins } from "./features/plugins/usePlugins";
import { useProject } from "./features/project/useProject";
import { params, type Theme } from "./viewparams";

import "./styles/app.css";

/** Что открыто в окне: чат или раздел «Плагины» (docs/SPEC/plugins.md, сцена A).
 *  Страницы размонтируют друг друга — черновик композера и оверлеи чата гаснут при
 *  выходе; список плагинов при этом один на окно (App держит его сам), и кнопки
 *  команд в шапке пересчитываются сразу, в том числе после Enable/Disable раздела. */
type Page = "chat" | "plugins" | "settings";

/** Ширина, ниже которой правая панель складывается в кнопку `☰` (docs/DESIGN.md, раздел 5). */
const NARROW = "(max-width: 1199px)";

/** Узкое ли окно: этим же условием панель уезжает в оверлей, а кнопка `☰` появляется. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW).matches,
  );
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const change = () => setNarrow(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return narrow;
}

/** Состояние прошлого запуска — один запрос при старте. StrictMode зовёт эффект
 *  дважды: подписка первого размывается, второй ответ перезапишет те же поля и
 *  двойной записи не оставит. */
function useSavedState(apply: (saved: WindowState) => void): void {
  useEffect(() => {
    let alive = true;
    loadState().then((saved) => {
      if (alive && saved) {
        apply(saved);
      }
    });
    return () => {
      alive = false;
    };
  }, [apply]);
}

/** Оверлей правой панели закрывается по Esc и клику снаружи; клик по самой `☰`
 *  остаётся за кнопкой — иначе открытие тут же закрылось бы. */
function usePanelOverlay(narrow: boolean, panelOpen: boolean, close: (open: boolean) => void): void {
  useEffect(() => {
    if (!narrow || !panelOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // Источник-файл сам раскрывает панель: тот же клик не должен её закрыть.
      if (
        target?.closest(".context") ||
        target?.closest('[data-testid="panel-toggle"]') ||
        target?.closest('[data-testid="source-file"]')
      ) {
        return;
      }
      close(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [narrow, panelOpen, close]);
}

/** Переключатель темы: тема живёт в `html[data-theme]`, правка уходит в состояние окна. */
function useThemeToggle(theme: Theme, setTheme: (theme: Theme) => void): () => void {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    void patchState({ theme: next });
  }, [theme, setTheme]);
}

/** Событие `reset` ленты (новый чат): титул и время чата сбрасываются вместе с
 *  лентой — следующий вопрос станет титулом нового чата. StrictMode зовёт
 *  эффект дважды: двойной reset те же поля не портит. */
function useFeedReset(reset: () => void): void {
  useEffect(() => {
    let stop: () => void = () => {};
    let cancelled = false;
    const listener = (event: FeedEvent) => {
      if (event.type === "reset") {
        reset();
      }
    };
    bridge()
      .listen(listener)
      .then((off) => {
        if (cancelled) {
          off();
          return;
        }
        stop = off;
      })
      .catch(() => {
        // Лента не поднялась: сброс титула придёт вместе с её починкой.
      });
    return () => {
      cancelled = true;
      stop();
    };
  }, [reset]);
}

/** Титул и начало чата и модели (своя у чата, по умолчанию — настроек): один
 *  источник для шапки, сайдбара, страницы настроек и запроса движку. Выбор
 *  бейджа сразу показывается и уходит в состояние окна; выбор дефолта меняет
 *  только бейдж чата без своей модели (спека настроек, «Решено за вас» №7). */
function useChatModels(): {
  title: string;
  time: number | null;
  model: string;
  defaultModel: string;
  remember: (question: string) => void;
  choose: (choice: ChatModelChoice) => void;
  chooseDefault: (choice: ChatModelChoice) => void;
  applySaved: (saved: WindowState) => void;
  /** «Новый чат»: титул и время чата сбрасываются вместе с лентой. */
  dropChat: () => void;
} {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState<number | null>(null);
  /** Модель текущего чата: из состояния окна; нет — модель по умолчанию
   *  настроек. Бейдж шапки и запрос движку идут одной строкой. */
  const [ownModel, setOwnModel] = useState<string | null>(null);
  /** Модель по умолчанию для новых чатов: настройка страницы «Настройки». */
  const [defaultModel, setDefaultModel] = useState<string>(DEFAULT_MODEL);

  /** Титул чата: первый вопрос. Повторные вопросы титул не меняют; время начала
   *  чата пишется тем же патчем — группы дат сайдбара строятся по нему. */
  const remember = useCallback(
    (question: string) => {
      if (title) {
        return;
      }
      const named = chatTitleOf(question);
      const now = Date.now();
      setTitle(named);
      setTime(now);
      void patchState({ chatTitle: named, chatTime: now });
    },
    [title],
  );

  /** «Выбрать» в панели сравнения: бейдж шапки обновляется сразу, выбор идёт в
   *  состояние окна — запрос движку несёт идентификатор модели. */
  const choose = useCallback((choice: ChatModelChoice) => {
    setOwnModel(choice.name);
    void patchState({ chatModel: choice });
  }, []);

  /** «По умолчанию» в панели настроек: дефолт меняется сразу; бейдж обновляется
   *  только у чата без своей модели — чат со своей моделью не затрагивается. */
  const chooseDefault = useCallback((choice: ChatModelChoice) => {
    setDefaultModel(choice.name);
    void patchState({ defaultModel: choice });
  }, []);

  /** Модель, титул и время из прошлого запуска; папку и тему берёт App рядом. */
  const applySaved = useCallback((saved: WindowState) => {
    if (saved.chatTitle) {
      setTitle(saved.chatTitle);
    }
    if (saved.chatModel) {
      setOwnModel(saved.chatModel.name);
    }
    if (saved.defaultModel) {
      setDefaultModel(saved.defaultModel.name);
    }
    if (saved.chatTime) {
      setTime(saved.chatTime);
    }
  }, []);

  /** «Новый чат»: титул и время сбрасываются — первый вопрос станет титулом
   *  нового чата; модель чата не трогается (выбранная модель остаётся и у
   *  нового чата, сброс только в настройках по умолчанию). */
  const dropChat = useCallback(() => {
    setTitle("");
    setTime(null);
  }, []);

  return {
    title,
    time,
    model: ownModel ?? defaultModel,
    defaultModel,
    remember,
    choose,
    chooseDefault,
    applySaved,
    dropChat,
  };
}

/** Главное окно: корень только собирает три колонки, держит тему и оверлей панели.
 *  Тема, титул чата и папка приходят из состояния окна (`src/appstate.ts`): в окне
 *  Tauri они переживают перезапуск, для снимков фикстура показывает свою ленту. */
export default function App() {
  const [theme, setTheme] = useState<Theme>(params.theme);
  const toggleTheme = useThemeToggle(theme, setTheme);
  const [panelOpen, setPanelOpen] = useState(params.right);
  const narrow = useNarrow();
  /** Прямой доступ раздела для снимков и сценария: `?состояние=плагины-раздел`
   *  и `?состояние=плагины-обновления` (вкладка Updates пункта 4), `?состояние=настройки*`
   *  (страница настроек пункта 12 — вкладки «настройки-модели» и другие). */
  const [page, setPage] = useState<Page>(
    params.feed.startsWith("настройки")
      ? "settings"
      : params.feed === "plugins-section" || params.feed === "plugins-updates"
        ? "plugins"
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

  /** «Новый чат»: лента чистится событием `reset`, движку поднимается новая
   *  сессия; титул и время чата сбрасывает тот же ход (использование — кнопка
   *  сайдбара и карточка приветствия, замечание владельца 2026-10-06). */
  const newChat = useCallback(() => {
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
  const projects = projectsList(data, projectRoot);

  /** Право этого чата на файлы: включён, раз папка проекта выбрана. Владелец
   *  тумблером правой панели его выключает и включает (замечание владельца
   *  2026-10-06: «не нажимаются переключатели») — filесы гейтит слой отправки
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
          onOpenPluginsPage={() => setPage("plugins")}
          cluster={narrow ? null : <WindowCluster theme={theme} onToggleTheme={toggleTheme} />}
        />
      )}
    </div>
  );
}

/** Проекты сайдбара: настоящая папка проекта, когда она есть, иначе фикстура.
 *  Название — папка, вторая линия — полный путь (спека «Двухстрочные строки»). */
function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function projectsList(data: ReturnType<typeof panels>, root: string): SidebarProject[] {
  if (root) {
    return [{ title: baseName(root), path: root }];
  }
  return data.projects;
}

/** Чаты сайдбара: настоящий титул, когда он есть, иначе фиксёрный список;
 *  время чата несёт вторую линию и группу дат. */
function chatsList(data: ReturnType<typeof panels>, title: string, time: number | null): SidebarChat[] {
  if (title) {
    return [{ title, active: true, ...(time ? { time } : {}) }];
  }
  return data.chats;
}