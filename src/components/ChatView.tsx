import { useCallback, useEffect, useState, type ReactNode } from "react";

import type { ApprovalDecision, ChatModelChoice, PluginScope } from "../bridge";
import type { CatalogEntry } from "../catalog";
import type { CompareModel } from "../compare";
import { useFeed } from "../chat";
import { useCompare } from "../features/compare/useCompare";
import type { ApprovalState } from "../features/plugins/useApproval";
import { useCatalog } from "../features/plugins/useCatalog";
import { useHeldSummary, type PluginsState } from "../features/plugins/usePlugins";
import { useToolsets } from "../features/plugins/useToolsets";
import type { ProjectState } from "../features/project/useProject";
import { params } from "../viewparams";
import { ComparePanel } from "./ComparePanel";
import { ChatHeader } from "./ChatHeader";
import { ChatPluginsPanel } from "./ChatPluginsPanel";
import { Composer } from "./Composer";
import { EmptyChat } from "./EmptyChat";
import { Feed } from "./Feed";
import { PluginApproval } from "./PluginApproval";
import { PluginPicker } from "./PluginPicker";
import { PluginSummary } from "./PluginSummary";

import "./ChatView.css";

/** Что открыто в композере: меню «+», список плагинов, окно Tool Sets, каталог,
 *  панель «Plugins in this chat» или ничего. Окно одобрения — не здесь: его
 *  открытость держит `useApproval`; сводку прав установки держит `pending` —
 *  она живёт и при открытом каталоге. */
type Overlay = "none" | "menu" | "plugins" | "toolsets" | "catalog" | "chat-plugins" | "compare";

/** Закрытие открытого оверлея по Esc и клику снаружи — иначе меню и список
 *  висят поверх поля ввода и перехватывают клик по «отправить». Снаружи
 *  ловится mousedown, а не click: окно одобрения открывается асинхронно,
 *  после клика по кнопке команды — продолжение клика ещё всплывает до window,
 *  и слушатель click успел бы закрыть то, что этот же клик открыл. mousedown
 *  открывающего жеста всегда раньше подписки, поэтому оверлей переживает свой клик. */
const MODEL_BADGE = '[data-testid="model-badge"]';

function useOverlayDismiss(
  open: boolean,
  /** Клик снаружи: закрытие без возврата фокуса — фокус уводит сам жест. */
  close: () => void,
  /** Esc — отдельный жест: панель сравнения возвращает фокус бейджу (спека
   *  «Клавиатура»), остальным оверлеям возврата нет. */
  onEscape: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        !target?.closest(".add-menu") &&
        !target?.closest(".plugin-picker") &&
        !target?.closest(".toolset-picker") &&
        !target?.closest(".catalog-picker") &&
        !target?.closest(".plugin-summary") &&
        !target?.closest(".plugin-approval") &&
        !target?.closest(".chat-plugins") &&
        !target?.closest(".compare-panel") &&
        !target?.closest('[data-testid="composer-add"]') &&
        !target?.closest(MODEL_BADGE) &&
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
  }, [open, close, onEscape]);
}

/** Центральная колонка: шапка, лента, композер. Ядро окна — то, что тянется. */
export function ChatView({
  title,
  onTogglePanel,
  panelOpen,
  narrow,
  cluster,
  project,
  onFirstQuestion,
  fsAllow,
  onOpenPluginsPage,
  model,
  onChooseModel,
  plugins,
  approval,
  counts,
  onNewChat,
  panelPickerOpen,
  onClosePanelPicker,
}: {
  title: string;
  onTogglePanel: () => void;
  panelOpen: boolean;
  /** Окно уже 1200 px: правая панель складывается — кластер кнопок окна
   *  возвращается в шапку чата (WindowCluster.tsx). */
  narrow: boolean;
  /** Кластер кнопок окна: тема + свернуть/развернуть/закрыть — правый край. */
  cluster: ReactNode;
  /** Файлы контекста: уходят с вопросом, чипы живут в композере. */
  project: ProjectState;
  /** Первый вопрос владельца становится титулом чата (src/appstate.ts). */
  onFirstQuestion?: (question: string) => void;
  /** Право чата на файлы: выключено — вопрос уходит без файлов, чипы же
   *  остаются на экране. Тумблер правой панели переключает его (App). */
  fsAllow: boolean;
  /** Клик по источнику-плагину: раздел «Плагины» открывается вместо чата. */
  onOpenPluginsPage: () => void;
  /** Модель текущего чата: бейдж шапки и строка «Выбрана». */
  model: string;
  /** «Выбрать» в панели сравнения: модель чата меняется и запоминается. */
  onChooseModel: (choice: ChatModelChoice) => void;
  /** Плагины чата — общие с правой панелью (App держит одно состояние). */
  plugins: PluginsState;
  /** Окно одобрения вызова — общее с правой панелью. */
  approval: ApprovalState;
  /** Счётчики приветственной сборки: длина списков чатов и проектов. */
  counts: { chats: number; projects: number };
  /** Карточка «Новый чат» приветствия: тот же ход, что кнопка сайдбара. */
  onNewChat: () => void;
  /** Пикер, которого позвала кнопка «Подключить» правой панели: открытие держит
   *  App (панель — сосед чата), позиция — оверлей области чата, как у панели
   *  сравнения: из любой двери окно видно целиком, без отрезанной правой части. */
  panelPickerOpen: boolean;
  /** Закрыть пикер двери панели: Esc, клик снаружи или подключение. */
  onClosePanelPicker: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Сравнение на снимках открывается сразу: `?состояние=сравнение*`, строка
  // `сравнение-раскрыто` несёт строку с уже развёрнутыми подробностями.
  const [overlay, setOverlay] = useState<Overlay>(
    params.feed.startsWith("сравнение") ? "compare" : "none",
  );
  /** Карточка, чью сводку прав открыли: решение ещё не принято. */
  const [pending, setPending] = useState<CatalogEntry | undefined>(undefined);
  /** Сводка новых прав удержанного обновления: при старте открывается сама
   *  (held-записи updates.json, сцена K) — в раздел «Плагины» идти не нужно. */
  const { summary: heldSummary, allow: allowHeld, cancel: cancelHeld } = useHeldSummary(plugins);
  const { rows, error, send } = useFeed();
  const toolsets = useToolsets();
  const catalog = useCatalog(overlay === "catalog");
  const compare = useCompare(overlay === "compare");
  /** Развёрнутая строка снимка: `?состояние=сравнение-раскрыто` открывает панель
   *  с подробностями North Mini Code вместо клика — кадр без действий владельца. */
  const initialExpanded = params.feed === "сравнение-раскрыто" ? "cohere/north-mini-code-1-0" : null;

  const ask = useCallback(
    async (text: string) => {
      setDraft("");
      setSending(true);
      onFirstQuestion?.(text);
      try {
        await send(text, fsAllow ? project.files.map((file) => file.path) : []);
        // Скоуп «Once» (сцена E): следующий вопрос снимает плагин с чата —
        // кнопки в шапке пересчитываются свежим списком.
        plugins.refresh();
      } finally {
        setSending(false);
      }
    },
    [send, project.files, fsAllow, onFirstQuestion, plugins.refresh],
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

  /** Подключение из пикера двери правой панели: окно чата закрывается тем же
   *  ходом, что и пикер композера. */
  const connectFromPanel = useCallback(
    (id: string, scope?: PluginScope) => {
      plugins.connect(id, scope);
      onClosePanelPicker();
    },
    [plugins.connect, onClosePanelPicker],
  );

  /** Снять плагин с чата из панели «Plugins in this chat»: установка и скоупы
   *  остаются, кнопки уходят из этого окна. */
  const removeFromChat = useCallback(
    (id: string) => {
      plugins.disconnect(id);
    },
    [plugins.disconnect],
  );

  /** Подключение Tool Set кликом строки (или его полосы скоупов): список из
   *  ответа подключения сам становится состоянием (узор applied, usePlugins) —
   *  отдельный plugin_list летит параллельно ходам к движку и вернул бы
   *  прежний реестр раньше записи, кнопки сета не появились бы. */
  const connectFromToolset = useCallback(
    (name: string, scope?: PluginScope) => {
      plugins.apply(toolsets.connect(name, scope));
      setOverlay((open) => (open === "toolsets" ? "none" : open));
    },
    [plugins.apply, toolsets.connect],
  );

  /** «Save as Tool Set»: сет создаётся из подключённого сейчас — окно сетов
   *  остаётся, имя и причина ошибки видны в нём самом. */
  const saveToolset = useCallback(
    (name: string) => {
      toolsets.save(name);
    },
    [toolsets.save],
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

  /** «Выбрать» в панели сравнения: модель чата меняется у App (бейдж и состояние
   *  окна), панель закрывается — как подключение плагина закрывает пикер. */
  const chooseModel = useCallback(
    (choice: CompareModel) => {
      onChooseModel({ name: choice.name, id: choice.id });
      setOverlay((open) => (open === "compare" ? "none" : open));
    },
    [onChooseModel],
  );

  /** Esc и клик снаружи закрывают и оверлей, и окно одобрения: закрытое без
   *  ответа окно — не ответ, вызов спросит снова при следующем клике. Пикер
   *  двери правой панели закрывается тем же жестом — он тоже оверлей чата,
   *  как и сводка удержанного обновления, открытая сама при старте. */
  const dismissAll = useCallback(() => {
    setOverlay("none");
    setPending(undefined);
    approval.dismiss();
    cancelHeld();
    onClosePanelPicker();
  }, [approval.dismiss, onClosePanelPicker, cancelHeld]);

  /** Фокус закрытой панели сравнения возвращается бейджу — открыли им, к нему
   *  и вернулись (спека «Клавиатура»); один помощник на оба пути закрытия. */
  const focusModelBadge = useCallback(() => {
    (document.querySelector(MODEL_BADGE) as HTMLElement | null)?.focus();
  }, []);

  /** Esc закрывает то же, что и dismissAll, и панель сравнения возвращает фокус
   *  бейджу — тем же жестом, что и ✕; остальным оверлеям возврата нет. */
  const dismissOnEscape = useCallback(() => {
    if (overlay === "compare") {
      focusModelBadge();
    }
    dismissAll();
  }, [overlay, dismissAll, focusModelBadge]);
  useOverlayDismiss(
    overlay !== "none" || pending !== undefined || panelPickerOpen || heldSummary !== undefined,
    dismissAll,
    dismissOnEscape,
  );

  /** Фокус закрытой панели возвращается бейджу: сравнение открыли им, к нему и
   *  вернулись (спека «Клавиатура»). Узкий случай — открытые пикеры композера
   *  ведут свой фокус сами, их не трогаем. */
  const closeOverlay = useCallback(() => {
    if (overlay === "compare") {
      focusModelBadge();
    }
    setOverlay("none");
  }, [overlay, focusModelBadge]);

  /** Клик по источнику-файлу: панель разворачивается (в узком окне она закрыта)
   *  и файл показан в дереве — источник открыт, а не только назван (phase2.md, 9.1). */
  const revealSource = useCallback(
    (path: string) => {
      if (!panelOpen) {
        onTogglePanel();
      }
      project.reveal(path);
    },
    [panelOpen, onTogglePanel, project.reveal],
  );

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
        onTogglePanel={onTogglePanel}
        panelOpen={panelOpen}
        cluster={narrow ? cluster : null}
        model={model}
        plugins={plugins.connected}
        onRunCommand={(plugin, command) => void approval.run(plugin, command)}
        onOpenPlugins={() => setOverlay(overlay === "chat-plugins" ? "none" : "chat-plugins")}
        onToggleCompare={() => setOverlay(overlay === "compare" ? "none" : "compare")}
        compareOpen={overlay === "compare"}
      />
      {overlay === "chat-plugins" ? (
        <ChatPluginsPanel
          plugins={plugins.connected}
          onRemove={removeFromChat}
          onAdd={() => setOverlay("plugins")}
          onClose={() => setOverlay("none")}
        />
      ) : null}
      {overlay === "compare" ? (
        <ComparePanel
          compare={compare}
          currentModel={model}
          mode="chat"
          initialExpanded={initialExpanded}
          onChoose={chooseModel}
          onClose={closeOverlay}
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
      {heldSummary ? <PluginSummary entry={heldSummary} onAllow={allowHeld} onCancel={cancelHeld} /> : null}
      {panelPickerOpen ? (
        <PluginPicker
          plugins={{ ...plugins, connect: connectFromPanel }}
          onBrowse={onOpenPluginsPage}
          onClose={onClosePanelPicker}
          placement="chat"
        />
      ) : null}
      <div className="feed" data-testid="feed">
        {rows.length ? (
          <Feed
            rows={rows}
            error={error}
            chatTitle={title}
            onSourceFile={revealSource}
            onSourcePlugin={onOpenPluginsPage}
          />
        ) : (
          <EmptyChat
            counts={counts}
            plugins={plugins}
            model={model}
            onOpenProject={project.pick}
            onConnectPlugin={onOpenPluginsPage}
            onCompare={() => setOverlay("compare")}
            onNewChat={onNewChat}
          />
        )}
      </div>
      <Composer
        draft={draft}
        sending={sending}
        onDraft={setDraft}
        onSend={() => void ask(draft)}
        files={project.files}
        onDetach={project.detach}
        plugins={{ ...plugins, connect: connectFromList }}
        toolsets={toolsets}
        addOpen={overlay === "menu"}
        pickerOpen={overlay === "plugins"}
        toolsetsOpen={overlay === "toolsets"}
        catalogOpen={overlay === "catalog"}
        catalog={catalog}
        onToggleAdd={() => setOverlay(overlay === "menu" ? "none" : "menu")}
        onConnectPlugins={() => setOverlay("plugins")}
        onBrowsePlugins={() => setOverlay("catalog")}
        onClosePlugins={() => setOverlay("none")}
        onToolsets={() => setOverlay("toolsets")}
        onConnectToolset={connectFromToolset}
        onSaveToolset={saveToolset}
        onInstallCatalog={installFromCatalog}
      />
    </main>
  );
}