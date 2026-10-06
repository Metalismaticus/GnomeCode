import { useCallback, useEffect, useState } from "react";

import { ChatView } from "./components/ChatView";
import { ContextPanel } from "./components/ContextPanel";
import { PluginsPage } from "./components/PluginsPage";
import { Sidebar } from "./components/Sidebar";
import { panels } from "./fixture";
import { chatTitleOf, loadState, patchState, type WindowState } from "./appstate";
import { useProject } from "./features/project/useProject";
import { params, type Theme } from "./viewparams";

import "./styles/app.css";

/** Что открыто в окне: чат или раздел «Плагины» (docs/SPEC/plugins.md, сцена A).
 *  Страницы размонтируют друг друга: возврат в чат заново читает список плагинов,
 *  и кнопки команд в шапке пересчитываются с учётом выключенных. */
type Page = "chat" | "plugins";

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

/** Главное окно: корень только собирает три колонки, держит тему и оверлей панели.
 *  Тема, титул чата и папка приходят из состояния окна (`src/appstate.ts`): в окне
 *  Tauri они переживают перезапуск, для снимков фикстура показывает свою ленту. */
export default function App() {
  const [theme, setTheme] = useState<Theme>(params.theme);
  const toggleTheme = useThemeToggle(theme, setTheme);
  const [panelOpen, setPanelOpen] = useState(params.right);
  const narrow = useNarrow();
  /** Прямой доступ раздела для снимков и сценария: `?состояние=плагины-раздел`
   *  и `?состояние=плагины-обновления` (вкладка Updates пункта 4). */
  const [page, setPage] = useState<Page>(
    params.feed === "plugins-section" || params.feed === "plugins-updates" ? "plugins" : "chat",
  );
  const data = panels(params.feed);
  // Папка проекта и титул чата: сначала фикстура/пусто, после ответа моста — сохранённые.
  // Титул не берётся из фиксёрного списка: otherwise «known непусто» считает его
  // настоящим чатом и первый вопрос титул не записывает.
  const [projectRoot, setProjectRoot] = useState(data.project);
  const [chatTitle, setChatTitle] = useState("");
  const project = useProject(projectRoot);

  // Состояние прошлого запуска — один запрос при старте: см. useSavedState.
  const applySaved = useCallback((saved: WindowState) => {
    if (saved.project) {
      setProjectRoot(saved.project);
    }
    if (saved.theme) {
      setTheme(saved.theme);
    }
    if (saved.chatTitle) {
      setChatTitle(saved.chatTitle);
    }
  }, []);
  useSavedState(applySaved);

  /** Титул чата: первый вопрос. Повторные вопросы титул не меняют. */
  const rememberChat = useCallback(
    (question: string) => {
      if (chatTitle) {
        return;
      }
      const title = chatTitleOf(question);
      setChatTitle(title);
      void patchState({ chatTitle: title });
    },
    [chatTitle],
  );

  // Оверлей правой панели закрывается сам — см. usePanelOverlay.
  usePanelOverlay(narrow, panelOpen, setPanelOpen);

  return (
    <div className="app">
      <Sidebar
        projects={projectsList(data, projectRoot)}
        chats={chatsList(data, chatTitle)}
        theme={theme}
        onToggleTheme={toggleTheme}
        onPickFolder={project.pick}
        onOpenPlugins={() => setPage("plugins")}
        onOpenChat={() => setPage("chat")}
      />
      {page === "plugins" ? (
        <PluginsPage />
      ) : (
        <ChatView
          title={chatTitle || "Новый чат"}
          theme={theme}
          onToggleTheme={toggleTheme}
          onTogglePanel={() => setPanelOpen(!panelOpen)}
          panelOpen={panelOpen}
          project={project}
          onFirstQuestion={rememberChat}
          onOpenPluginsPage={() => setPage("plugins")}
        />
      )}
      {narrow && !panelOpen ? null : (
        <ContextPanel sections={data.sections} engineDown={data.engineDown} project={project} />
      )}
    </div>
  );
}

/** Проекты сайдбара: настоящая папка проекта, когда она есть, иначе фикстура. */
function projectsList(data: ReturnType<typeof panels>, root: string): string[] {
  if (root) {
    return [root];
  }
  return data.projects;
}

/** Чаты сайдбара: настоящий титул, когда он есть, иначе фиксёрный список. */
function chatsList(data: ReturnType<typeof panels>, title: string) {
  if (title) {
    return [{ title, active: true }];
  }
  return data.chats;
}