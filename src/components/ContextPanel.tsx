import { useState } from "react";

import type { ProjectState } from "../features/project/useProject";
import { ContextRow, type ContextRowData } from "./ContextRow";
import { FileTree } from "./FileTree";

import "./ContextPanel.css";

export type ContextSection = { title: string; rows: ContextRowData[] };

export type ContextPanelData = {
  sections: ContextSection[];
  /** Движок не отвечает — раздел «Проект» получает строку о состоянии. */
  engineDown?: boolean;
  project: ProjectState;
};

/** Правая колонка: заголовок, дерево файлов и разделы «Инструменты» /
 *  «Безопасность этого чата». При ширине окна < 1200 px панель открывается оверлеем
 *  поверх чата — тот же элемент, другое место (docs/DESIGN.md, раздел 5). */
export function ContextPanel({ sections, engineDown = false, project }: ContextPanelData) {
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
      <div className="context__header">Контекст проекта</div>
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
      {sections
        .filter((section) => section.title !== "Проект")
        .map((section) => (
          <div className="context__section" key={section.title}>
            <div className="context__section-title">{section.title}</div>
            {section.rows.map((row) => (
              <ContextRow key={row.label} {...row} />
            ))}
          </div>
        ))}
    </aside>
  );
}