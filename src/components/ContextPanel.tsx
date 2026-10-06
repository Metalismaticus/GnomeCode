import { useState } from "react";

import type { Plugin, PluginCommand } from "../bridge";
import type { PluginsState } from "../features/plugins/usePlugins";
import type { ProjectState } from "../features/project/useProject";
import { PluginPicker } from "./PluginPicker";
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
   *  что у кнопок шапки (спека «Состав основы», «Живая правая панель»). */
  plugins: PluginsState;
  /** Клик по кнопке команды панели: слой прав решает вопрос одобрения и запуск. */
  onRunCommand: (plugin: Plugin, command: PluginCommand) => void;
  /** «Подключить» и «Browse plugins…» ведут в раздел «Плагины» (существующие ходы). */
  onOpenPluginsPage: () => void;
};

/** Раздел «Безопасность этого чата» — показатели состояния, а не новые права:
 *  файлы следуют за выбранной папкой, у чата своего сетевого состояния нет —
 *  появится с сетевыми плагинами. Тумблер нового права не выдаёт
 *  (permission-слой не обходится). */
const NET_TITLE = "Своего сетевого состояния у чата нет — появится с сетевыми плагинами";

function securityRows(root: string): ContextRowData[] {
  const on = Boolean(root);
  return [
    {
      label: "Доступ к файловой системе",
      value: on ? "Только папка проекта" : "Выключен",
      tone: on ? "success" : "off",
      testid: "context-row-fs",
      switch: {
        on,
        disabled: true,
        title: on ? "Следует за выбранной папкой проекта" : "Папка проекта не выбрана",
        testid: "context-toggle-fs",
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
}

/** Правая колонка: заголовок, дерево файлов, разделы «Проект» / «Инструменты» /
 *  «Безопасность этого чата». При ширине окна < 1200 px панель открывается оверлеем
 *  поверх чата — тот же элемент, другое место (docs/DESIGN.md, раздел 5). */
export function ContextPanel({
  sections,
  engineDown = false,
  project,
  plugins,
  onRunCommand,
  onOpenPluginsPage,
}: ContextPanelData) {
  // Вкладки принадлежат панели, а не дереву: переключение не убирает дерево из экрана.
  const [tab, setTab] = useState("Файлы");
  // Пикер плагинов — существующий: панель открывает его рядом с собой, подключение
  // идёт тем же ходом, что из композера; окно закрывается сразу после подключения.
  const [connecting, setConnecting] = useState(false);
  const connectFromPanel = (id: Parameters<PluginsState["connect"]>[0], scope?: Parameters<PluginsState["connect"]>[1]): void => {
    plugins.connect(id, scope);
    setConnecting(false);
  };
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
      <div className="context__header" data-tauri-drag-region>Контекст проекта</div>
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
        {toolRows(plugins, engineDown, onRunCommand, () => setConnecting(true)).map((row, index) => (
          <ContextRow key={`${row.label}-${index}`} {...row} />
        ))}
      </div>
      <div className="context__section">
        <div className="context__section-title">Безопасность этого чата</div>
        {securityRows(project.root).map((row) => (
          <ContextRow key={row.label} {...row} />
        ))}
      </div>
      {connecting ? (
        <PluginPicker
          plugins={{ ...plugins, connect: connectFromPanel }}
          onBrowse={onOpenPluginsPage}
          onClose={() => setConnecting(false)}
        />
      ) : null}
    </aside>
  );
}
