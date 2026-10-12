// Меню «+» композера: разделы Files / Context / Capabilities. Рабочие пункты —
// Connect plugin и файлы проекта (чипы в композере, пункт «Проект и файлы»);
// остальное — строки «позже», как «Терминал — позже» в правой панели.

import type { PluginsState } from "../features/plugins/usePlugins";
import type { ProjectFile } from "../features/project/useProject";

import "./AddMenu.css";

/** Пункт меню: рабочий или строка будущего — с пометкой «позже» и причиной. */
type Action = { key: string; title: string; soon?: never } | { key: string; title: string; soon: true };

const FILES: Action[] = [
  { key: "project-files", title: "Файлы проекта" },
  { key: "attach-file", title: "Прикрепить файл", soon: true },
];

const CONTEXT: Action[] = [
  { key: "whole-project", title: "Весь проект", soon: true },
  { key: "chat-memory", title: "Память чата", soon: true },
];

const CAPABILITIES: Action[] = [
  { key: "connect-plugin", title: "Connect plugin" },
  { key: "tool-set", title: "Tool Set" },
  { key: "mcp", title: "MCP-серверы", soon: true },
  { key: "terminal", title: "Терминал", soon: true },
];

export type AddMenuProps = {
  /** Открыто ли меню: открывает кнопка «+» в композере. */
  open: boolean;
  onClose: () => void;
  /** Плагины чата: подключение из пункта меню. */
  plugins: PluginsState;
  /** Файлы в контексте: сколько их, показывает раздел Context. */
  files: ProjectFile[];
  /** Клик по «Connect plugin» — открыть список плагинов. */
  onConnect: () => void;
  /** Клик по «Tool Set» — открыть окно сохранённых групп. */
  onToolsets: () => void;
};

/** Всплывающее меню «+»: заголовок, разделы, строка выбранного действия.
 *  Тень у него есть — `DESIGN.md` §7 разрешает её только этому меню. Закрывает его
 *  владелец: Esc, клик снаружи или ещё один клик по «+» (ChatView держит состояние). */
export function AddMenu({ open, onClose, plugins, files, onConnect, onToolsets }: AddMenuProps) {
  if (!open) {
    return null;
  }
  const sections: { title: string; items: Action[] }[] = [
    { title: "Files", items: FILES },
    { title: "Context", items: CONTEXT },
    { title: "Capabilities", items: CAPABILITIES },
  ];
  return (
    <div className="add-menu" data-testid="add-menu" role="menu" aria-label="Добавить">
      <div className="add-menu__title">{heading(files, plugins)}</div>
      {sections.map((section) => (
        <div className="add-menu__section" key={section.title} role="group">
          <div className="add-menu__section-title" data-section={section.title}>
            {section.title}
          </div>
          {section.items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className="add-menu__item"
              data-testid={`add-${item.key}`}
              disabled={"soon" in item}
              title={item.soon ? "Позже" : item.title}
              onClick={() => {
                // Connect plugin открывает список, Tool Set — окно групп,
                // остальные пункты только закрывают меню.
                if (item.key === "connect-plugin") {
                  onConnect();
                  return;
                }
                if (item.key === "tool-set") {
                  onToolsets();
                  return;
                }
                onClose();
              }}
            >
              <span className="add-menu__item-title">{item.title}</span>
              <span className="add-menu__item-hint">
                {"soon" in item ? "позже" : item.key === "connect-plugin" ? "кнопки в шапке" : item.key === "tool-set" ? "группа подключений" : ""}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Заголовок меню: что уже привязано к вопросу — файлы и подключённые плагины. */
function heading(files: ProjectFile[], plugins: PluginsState): string {
  const parts: string[] = [];
  parts.push(files.length ? `Файлов: ${files.length}` : "Файлов нет");
  parts.push(
    plugins.connected.length
      ? `Плагинов: ${plugins.connected.length}`
      : "Плагины не подключены",
  );
  return parts.join(" · ");
}