import { useEffect, useState } from "react";

import { ChatView } from "./components/ChatView";
import { ContextPanel } from "./components/ContextPanel";
import { Sidebar } from "./components/Sidebar";
import { panels } from "./fixture";
import { params, type Theme } from "./viewparams";

import "./styles/app.css";

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

/** Главное окно: корень только собирает три колонки, держит тему и оверлей панели. */
export default function App() {
  const [theme, setTheme] = useState<Theme>(params.theme);
  const [panelOpen, setPanelOpen] = useState(params.right);
  const narrow = useNarrow();
  const data = panels(params.feed);
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Оверлей правой панели закрывается по Esc и клику снаружи; клик по самой `☰`
  // остаётся за кнопкой — иначе открытие тут же закрылось бы.
  useEffect(() => {
    if (!narrow || !panelOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (target?.closest(".context") || target?.closest('[data-testid="panel-toggle"]')) {
        return;
      }
      setPanelOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [narrow, panelOpen]);

  return (
    <div className="app">
      <Sidebar
        projects={data.projects}
        chats={data.chats}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <ChatView
        title="Новый чат"
        theme={theme}
        onToggleTheme={toggleTheme}
        onTogglePanel={() => setPanelOpen(!panelOpen)}
        panelOpen={panelOpen}
      />
      {narrow && !panelOpen ? null : (
        <ContextPanel sections={data.sections} engineDown={data.engineDown} />
      )}
    </div>
  );
}