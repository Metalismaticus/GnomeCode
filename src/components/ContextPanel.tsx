import { ContextRow, type ContextRowData } from "./ContextRow";

import "./ContextPanel.css";

export type ContextSection = { title: string; rows: ContextRowData[] };

export type ContextPanelData = {
  sections: ContextSection[];
  /** Движок не отвечает — раздел «Проект» получает строку о состоянии. */
  engineDown?: boolean;
};

/** Правая колонка: заголовок и разделы «Проект» / «Инструменты» / «Безопасность этого чата».
 *  При ширине окна < 1200 px панель открывается оверлеем поверх чата — тот же элемент,
 *  другое место (docs/DESIGN.md, раздел 5). */
export function ContextPanel({ sections, engineDown = false }: ContextPanelData) {
  return (
    <aside className="context" data-testid="context-panel">
      <div className="context__header">Контекст проекта</div>
      {sections.map((section) => (
        <div className="context__section" key={section.title}>
          <div className="context__section-title">{section.title}</div>
          {section.rows.map((row) => (
            <ContextRow key={row.label} {...row} />
          ))}
          {section.title === "Проект" && engineDown ? (
            <ContextRow label="Движок" value="Не отвечает" tone="danger" />
          ) : null}
        </div>
      ))}
    </aside>
  );
}