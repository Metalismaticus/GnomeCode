// Меню «+» композера: разделы Files / Context / Capabilities. Все пункты
// рабочие: решение о действии принимает ChatView (handleAddAction), меню
// только зовёт onAction и закрывается им же.

import type { PluginsState } from "../features/plugins/usePlugins";
import type { ProjectFile } from "../features/project/useProject";

import "./AddMenu.css";

/** Пункт меню: ключ действия, заголовок и подсказка справа. */
type Action = { key: string; title: string; hint: string };

const FILES: Action[] = [
  { key: "project-files", title: "Файлы проекта", hint: "дерево справа" },
  { key: "attach-file", title: "Прикрепить файл", hint: "системный диалог" },
];

const CONTEXT: Action[] = [
  { key: "whole-project", title: "Весь проект", hint: "файлы корня папки" },
  { key: "chat-memory", title: "Память чата", hint: "инструкция этого чата" },
];

const CAPABILITIES: Action[] = [
  { key: "connect-plugin", title: "Connect plugin", hint: "кнопки в шапке" },
  { key: "tool-set", title: "Tool Set", hint: "группа подключений" },
  { key: "mcp", title: "MCP-серверы", hint: "настройки, вкладка «Плагины»" },
  { key: "terminal", title: "Терминал", hint: "консоль в папке проекта" },
];

export type AddMenuProps = {
  /** Открыто ли меню: открывает кнопка «+» в композере. */
  open: boolean;
  /** Плагины чата: подключение из пункта меню. */
  plugins: PluginsState;
  /** Файлы в контексте: сколько их, показывает раздел Context. */
  files: ProjectFile[];
  /** Клик по пункту: решение — у ChatView, он же закрывает меню. */
  onAction: (key: string) => void;
  /** Причина, почему действие не состоялось: строка внизу меню, меню открыто. */
  note?: string;
};

/** Всплывающее меню «+»: заголовок, разделы, строка выбранного действия.
 *  Тень у него есть — `DESIGN.md` §7 разрешает её только этому меню. Закрывает его
 *  владелец: Esc, клик снаружи или ещё один клик по «+» (ChatView держит состояние). */
export function AddMenu({ open, plugins, files, onAction, note }: AddMenuProps) {
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
              title={item.hint}
              onClick={() => onAction(item.key)}
            >
              <span className="add-menu__item-title">{item.title}</span>
              <span className="add-menu__item-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      ))}
      {note ? (
        <div className="add-menu__note" data-testid="add-menu-note">
          {note}
        </div>
      ) : null}
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
