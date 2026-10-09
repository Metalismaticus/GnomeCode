import { useState } from "react";

import type { Plugin, PluginCommand } from "../bridge";
import type { PluginsState } from "../features/plugins/usePlugins";
import type { ProjectState } from "../features/project/useProject";
import { Button } from "./Button";
import { ContextRow, type ContextRowData } from "./ContextRow";
import { FileTree } from "./FileTree";

import "./ContextPanel.css";

export type ContextSection = { title: string; rows: ContextRowData[] };

export type ContextPanelData = {
  sections: ContextSection[];
  /** Движок не отвечает — раздел «Проект» получает строку о состоянии, команды глушатся. */
  engineDown?: boolean;
  project: ProjectState;
  /** Плагины чата: строки подключённых с кнопками команд — тот же ход одобрения,
   *  что у команд меню «⋯» (спека «тихого хрома», §5–6). */
  plugins: PluginsState;
  /** Право чата на файлы: тумблер переключает, вопрос уходит с файлами или без. */
  fsAllow: boolean;
  /** Переключить право чата на файлы: тумблер раздела «Безопасность этого чата». */
  onToggleFs: () => void;
  /** Клик по кнопке команды панели: слой прав решает вопрос одобрения и запуск. */
  onRunCommand: (plugin: Plugin, command: PluginCommand) => void;
  /** Кнопка «Подключить» панели: пикер открывается оверлеем области чата —
   *  открытость держит App, рисует ChatView (отрезание верхом панели —
   *  замечание владельца 2026-10-07 — ушло вместе с монтированием в панели;
   *  «Browse plugins…» идёт из пикера, здесь его больше нет). */
  onConnectPlugins: () => void;
  /** Крестик шапки: панель — временный слой, закрывается им, Esc и кликом мимо. */
  onClose: () => void;
};

/** Раздел «Безопасность этого чата»: право чата на файлы — память окна
 *  (по умолчанию включено, когда папка проекта выбрана); владелец тумблером
 *  его включает и выключивает. У чата своего сетевого состояния нет —
 *  появится с сетевыми плагинами; тот тумблер остаётся показателем. */
const NET_TITLE = "Своего сетевого состояния у чата нет — появится с сетевыми плагинами";

function securityRows(
  root: string,
  fsAllow: boolean,
  onToggleFs: () => void,
  onPickProject: () => void,
): ContextRowData[] {
  const on = Boolean(root);
  const gate = on ? fsAllow : false;
  return [
    {
      label: "Доступ к файловой системе",
      value: on ? (gate ? "Только папка проекта" : "Выключен") : "Выключен",
      tone: on && gate ? "success" : "off",
      testid: "context-row-fs",
      /** Без папки клик — тот же жест, что строка «Папка»: системный выбор
       *  папки (project.pick); с папкой — переключение права этого чата.
       *  Право — память окна, в движок жёсткой меткой не уходит: файлы к
       *  вопросу гейтит слой отправки (ChatView.ask). */
      switch: {
        on: gate,
        title: on ? (gate ? "Право чата на файлы папки — клик выключит" : "Право выключено — клик включит") : "Выбрать папку проекта",
        testid: "context-toggle-fs",
        onToggle: on ? onToggleFs : onPickProject,
      },
    },
    {
      label: "Интернет",
      value: "Выключен",
      tone: "off",
      testid: "context-row-net",
      switch: { on: false, disabled: true, title: NET_TITLE, testid: "context-toggle-net" },
    },
  ];
}

/** Строки раздела «Инструменты»: подключённые плагины с их командами; нет
 *  подключённых — честное «Плагины не подключены» с кнопкой «Подключить».
 *  Строки-заглушки «позже» удалены: панель показывает реальное. */
function toolRows(
  plugins: PluginsState,
  engineDown: boolean,
  onRunCommand: ContextPanelData["onRunCommand"],
  onConnect: () => void,
): ContextRowData[] {
  if (!plugins.connected.length) {
    return [
      {
        label: "Плагины не подключены",
        value: "",
        buttons: [{ label: "Подключить", onClick: onConnect, testid: "context-connect" }],
      },
    ];
  }
  return plugins.connected.map((plugin) => ({
    label: plugin.name ?? plugin.id,
    value: "",
    buttons: plugin.commands.map((command) => ({
      label: command.label,
      command: command.name,
      disabled: engineDown,
      title: engineDown ? "Движок не отвечает" : command.description || command.label,
      onClick: () => onRunCommand(plugin, command),
    })),
  }));
}/** Правая панель — оверлей «Контекст проекта» («тихий хром», §6): скрыта по умолчанию,
 *  открывается из меню «⋯» или кликом по источнику-файлу; заголовок, дерево файлов,
 *  разделы «Проект» / «Инструменты» / «Безопасность этого чата». */
export function ContextPanel({
  sections,
  engineDown = false,
  project,
  fsAllow,
  onToggleFs,
  plugins,
  onRunCommand,
  onConnectPlugins,
  onClose,
}: ContextPanelData) {
  // Вкладки принадлежат панели, а не дереву: переключение не убирает дерево из экрана.
  const [tab, setTab] = useState("Файлы");
  // Строку папки рисует панель по состоянию проекта; пока папка не выбрана, на её месте
  // строка фикстуры («Папка не выбрана», длинный путь) — обе сразу были бы лишними.
  // Строку папки знает только панель — по состоянию проекта; фикстуре она остаётся в
  // разделе, но панель рисует свою: иначе на экране было бы две строки об одном.
  const projectRows = sections.find((section) => section.title === "Проект")?.rows ?? [];
  const folder: ContextRowData = project.root
    ? { label: "Папка", value: project.root, tone: "mono" }
    : { label: "Папка не выбрана", value: "—" };
  const rest = projectRows.filter((row) => !row.label.startsWith("Папка"));
  return (
    <aside className="context" data-testid="context-panel">
      <div className="context__header" data-tauri-drag-region>
        <span className="context__header-title">Контекст проекта</span>
        <Button
          square
          variant="ghost"
          className="context__close"
          data-testid="panel-close"
          title="Закрыть"
          aria-label="Закрыть"
          onClick={onClose}
        >
          ✕
        </Button>
      </div>
      <FileTree project={project} tab={tab} onTab={setTab} />
      <div className="context__section">
        <div className="context__section-title">Проект</div>
        {folder ? (
          <div
            className="context__folder"
            role="button"
            tabIndex={0}
            onClick={project.pick}
            onKeyDown={(event) => event.key === "Enter" && project.pick()}
            title="Выбрать папку проекта"
          >
            <ContextRow {...folder} />
          </div>
        ) : null}
        {engineDown ? <ContextRow label="Движок" value="Не отвечает" tone="danger" /> : null}
        {rest.map((row) => (
          <ContextRow key={row.label} {...row} />
        ))}
      </div>
      <div className="context__section">
        <div className="context__section-title">Инструменты</div>
        {toolRows(plugins, engineDown, onRunCommand, onConnectPlugins).map((row, index) => (
          <ContextRow key={`${row.label}-${index}`} {...row} />
        ))}
      </div>
      <div className="context__section">
        <div className="context__section-title">Безопасность этого чата</div>
        {securityRows(project.root, fsAllow, onToggleFs, project.pick).map((row) => (
          <ContextRow key={row.label} {...row} />
        ))}
      </div>
    </aside>
  );
}
