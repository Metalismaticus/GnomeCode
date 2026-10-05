import { useCallback, useState } from "react";

import { useFeed } from "../chat";
import type { ProjectState } from "../features/project/useProject";
import type { Theme } from "../viewparams";
import { ChatHeader } from "./ChatHeader";
import { Composer } from "./Composer";
import { EmptyChat } from "./EmptyChat";
import { Feed } from "./Feed";

import "./ChatView.css";

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
  const { rows, error, send } = useFeed();

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

  return (
    <main className="chat" data-testid="chat">
      <ChatHeader
        title={title}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onTogglePanel={onTogglePanel}
        panelOpen={panelOpen}
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
      />
    </main>
  );
}