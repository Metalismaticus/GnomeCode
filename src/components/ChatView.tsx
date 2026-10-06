import { useCallback, useEffect, useState } from "react";

import type { ApprovalDecision, PluginScope } from "../bridge";
import type { CatalogEntry } from "../catalog";
import { useFeed } from "../chat";
import { useApproval } from "../features/plugins/useApproval";
import { useCatalog } from "../features/plugins/useCatalog";
import { usePlugins } from "../features/plugins/usePlugins";
import type { ProjectState } from "../features/project/useProject";
import type { Theme } from "../viewparams";
import { ChatHeader } from "./ChatHeader";
import { ChatPluginsPanel } from "./ChatPluginsPanel";
import { Composer } from "./Composer";
import { EmptyChat } from "./EmptyChat";
import { Feed } from "./Feed";
import { PluginApproval } from "./PluginApproval";
import { PluginSummary } from "./PluginSummary";

import "./ChatView.css";

/** Что открыто в композере: меню «+», список плагинов, каталог, панель
 *  «Plugins in this chat» или ничего. Окно одобрения — не здесь: его открытость
 *  держит `useApproval`; сводку прав установки держит `pending` — она живёт и
 *  при открытом каталоге. */
type Overlay = "none" | "menu" | "plugins" | "catalog" | "chat-plugins";

/** Закрытие открытого оверлея по Esc и клику снаружи — иначе меню и список
 *  висят поверх поля ввода и перехватывают клик по «отправить». Снаружи
 *  ловится mousedown, а не click: окно одобрения открывается асинхронно,
 *  после клика по кнопке команды — продолжение клика ещё всплывает до window,
 *  и слушатель click успел бы закрыть то, что этот же клик открыл. mousedown
 *  открывающего жеста всегда раньше подписки, поэтому оверлей переживает свой клик. */
function useOverlayDismiss(open: boolean, close: () => void): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        !target?.closest(".add-menu") &&
        !target?.closest(".plugin-picker") &&
        !target?.closest(".catalog-picker") &&
        !target?.closest(".plugin-summary") &&
        !target?.closest(".plugin-approval") &&
        !target?.closest(".chat-plugins") &&
        !target?.closest('[data-testid="composer-add"]') &&
        !target?.closest('[data-testid="header-plugins-area"]')
      ) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, close]);
}

/** Центральная колонка: шапка, лента, композер. Ядро окна — то, что тянется. */
export function ChatView({
  title,
  theme,
  onToggleTheme,
  onTogglePanel,
  panelOpen,
  project,
  onFirstQuestion,
}: {
  title: string;
  theme: Theme;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  panelOpen: boolean;
  /** Файлы контекста: уходят с вопросом, чипы живут в композере. */
  project: ProjectState;
  /** Первый вопрос владельца становится титулом чата (src/appstate.ts). */
  onFirstQuestion?: (question: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>("none");
  /** Карточка, чью сводку прав открыли: решение ещё не принято. */
  const [pending, setPending] = useState<CatalogEntry | undefined>(undefined);
  const { rows, error, send } = useFeed();
  const plugins = usePlugins();
  const catalog = useCatalog(overlay === "catalog");
  const approval = useApproval();

  const ask = useCallback(
    async (text: string) => {
      setDraft("");
      setSending(true);
      onFirstQuestion?.(text);
      try {
        await send(text, project.files.map((file) => file.path));
        // Скоуп «Once» (сцена E): следующий вопрос снимает плагин с чата —
        // кнопки в шапке пересчитываются свежим списком.
        plugins.refresh();
      } finally {
        setSending(false);
      }
    },
    [send, project.files, onFirstQuestion, plugins.refresh],
  );

  /** Подключение из списка закрывает список: кнопки в шапке — подтверждение,
   *  и окно списка свою работу сделало. */
  const connectFromList = useCallback(
    (id: string, scope?: PluginScope) => {
      plugins.connect(id, scope);
      setOverlay((open) => (open === "plugins" ? "none" : open));
    },
    [plugins.connect],
  );

  /** Снять плагин с чата из панели «Plugins in this chat»: установка и скоупы
   *  остаются, кнопки уходят из этого окна. */
  const removeFromChat = useCallback(
    (id: string) => {
      plugins.disconnect(id);
    },
    [plugins.disconnect],
  );

  /** Install карточки каталога: открыть сводку прав — установка без ответа не идёт. */
  const installFromCatalog = useCallback((entry: CatalogEntry) => {
    setPending(entry);
  }, []);

  /** «Разрешить» сводки прав и кнопки скоупа: мост ставит плагин, подключает
   *  к чату (со скоупом, если выбран) и отдаёт свежий список — каталог и сводка
   *  свою работу сделали, сценарий разговора возвращён владельцу. */
  const allowInstall = useCallback(
    (entry: CatalogEntry, scope?: PluginScope) => {
      setPending(undefined);
      plugins.install(entry.id, scope);
      setOverlay((open) => (open === "catalog" ? "none" : open));
    },
    [plugins.install],
  );

  /** «Отмена» сводки: ничего не ставится, каталог остаётся открытым. */
  const cancelInstall = useCallback(() => setPending(undefined), []);

  /** Esc и клик снаружи закрывают и оверлей, и окно одобрения: закрытое без
   *  ответа окно — не ответ, вызов спросит снова при следующем клике. */
  const dismissAll = useCallback(() => {
    setOverlay("none");
    setPending(undefined);
    approval.dismiss();
  }, [approval.dismiss]);
  useOverlayDismiss(overlay !== "none" || pending !== undefined, dismissAll);

  /** Ответ владельца в окне одобрения: решение сохраняет слой прав; «Отказать»
   *  тоже сообщается — лента получит строку отказа. */
  const decide = useCallback(
    (decision: ApprovalDecision) => {
      void approval.decide(decision);
    },
    [approval.decide],
  );

  return (
    <main className="chat" data-testid="chat">
      <ChatHeader
        title={title}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onTogglePanel={onTogglePanel}
        panelOpen={panelOpen}
        plugins={plugins.connected}
        onRunCommand={(plugin, command) => void approval.run(plugin, command)}
        onOpenPlugins={() => setOverlay(overlay === "chat-plugins" ? "none" : "chat-plugins")}
      />
      {overlay === "chat-plugins" ? (
        <ChatPluginsPanel
          plugins={plugins.connected}
          onRemove={removeFromChat}
          onAdd={() => setOverlay("plugins")}
          onClose={() => setOverlay("none")}
        />
      ) : null}
      {approval.asked ? (
        <PluginApproval
          plugin={approval.asked.plugin}
          label={approval.asked.label}
          description={approval.asked.description}
          onDecide={decide}
        />
      ) : null}
      {pending ? <PluginSummary entry={pending} onAllow={allowInstall} onCancel={cancelInstall} /> : null}
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
        plugins={{ ...plugins, connect: connectFromList }}
        addOpen={overlay === "menu"}
        pickerOpen={overlay === "plugins"}
        catalogOpen={overlay === "catalog"}
        catalog={catalog}
        onToggleAdd={() => setOverlay(overlay === "menu" ? "none" : "menu")}
        onConnectPlugins={() => setOverlay("plugins")}
        onBrowsePlugins={() => setOverlay("catalog")}
        onClosePlugins={() => setOverlay("none")}
        onInstallCatalog={installFromCatalog}
      />
    </main>
  );
}