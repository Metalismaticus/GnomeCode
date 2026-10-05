import { useCallback, useEffect, useState } from "react";

import { useFeed } from "../chat";
import { usePlugins } from "../features/plugins/usePlugins";
import type { ProjectState } from "../features/project/useProject";
import type { Theme } from "../viewparams";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { EmptyChat } from "./EmptyChat";
import { Feed } from "./Feed";

import "./ChatView.css";

/** Что открыто в композере: меню «+», список плагинов или ничего. */
type Overlay = "none" | "menu" | "plugins";

/** Центральная колонка: шапка, лента, композер. Ядро окна — то, что тянется. */
export function ChatView({
  title,
  theme,
  onToggleTheme,
  onTogglePanel,
  panelOpen,
  project,
}: {
  title: string;
  theme: Theme;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  /** Файлы контекста: уходят с вопросом, чипы живут в композере. */
  project: ProjectState;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>("none");
  const { rows, error, send } = useFeed();
  const plugins = usePlugins();

  const ask = useCallback(
    async (text: string) => {
      setDraft("");
      setSending(true);
      try {
        await send(text, project.files.map((file) => file.path));
      } finally {
        setSending(false);
      }
    },
    [send, project.files],
  );

  // Меню «+» и список плагинов закрываются по Esc и клику снаружи — иначе они
  // висят поверх поля ввода и перехватывают клик по «отправить».
  useEffect(() => {
    if (overlay === "none") {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOverlay("none");
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        !target?.closest(".add-menu") &&
        !target?.closest(".plugin-picker") &&
        !target?.closest('[data-testid="composer-add"]')
      ) {
        setOverlay("none");
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [overlay]);

  return (
    <main className="chat" data-testid="chat">
      <ChatHeader
        title={title}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onTogglePanel={onTogglePanel}
        panelOpen={panelOpen}
        plugins={plugins.connected}
      />
      <div className="feed" data-testid="feed">
        {rows.length ? <Feed rows={rows} error={error} /> : <EmptyChat />}
      </div>
      <Composer
        draft={draft}
        sending={sending}
        onDraft={setDraft}
        onSend={() => void ask(draft)}
        files={project.files}
        onDetach={project.detach}
        plugins={plugins}
        addOpen={overlay === "menu"}
        pickerOpen={overlay === "plugins"}
        onToggleAdd={() => setOverlay(overlay === "menu" ? "none" : "menu")}
        onConnectPlugins={() => setOverlay("plugins")}
        onClosePlugins={() => setOverlay("none")}
      />
    </main>
  );
}