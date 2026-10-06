import { useState } from "react";
import type { KeyboardEvent } from "react";

import { DEFAULT_MODEL } from "../appstate";
import type { FeedRow } from "../bridge";

import "./Feed.css";

/** Строка о состоянии движка видна своим цветом: потеря и возврат — не тихие заметки. */
const TONE: Record<string, string> = {
  "Сервер OpenCode недоступен, перезапускаю…": "feed__row--down",
  "Сервер OpenCode снова отвечает": "feed__row--back",
  "Сообщение не ушло": "feed__row--down",
};

/** Детали вызова плагина под его строкой (docs/SPEC/plugins.md, сцена J):
 *  Usage/Audit — какой плагин сгенерировал вызов, где и чем. Модель пока одна
 *  (ниже константы — переключение появится вместе с пунктом 10 партии),
 *  скиллов в продукте ещё нет (Этап 3) — деталь честно «—», не выдуманная.
 *  Обычные tool-строки движка деталей не открывают: плагин неизвестен. */
function RowDetails({ row, chatTitle }: { row: FeedRow; chatTitle: string }) {
  return (
    <div className="feed__details" data-testid="feed-row-details">
      <div className="feed__detail">Плагин: {row.plugin}</div>
      <div className="feed__detail">Чат: {chatTitle}</div>
      <div className="feed__detail">Скилл: —</div>
      <div className="feed__detail">Модель: {DEFAULT_MODEL}</div>
    </div>
  );
}

/** Что строка, раскрывающаяся деталями, добавляет к обычной: клик по любой точке
 *  строки — открыть, повторный — закрыть; без роли только строки вызова инструмента. */
function expansion(row: FeedRow, open: boolean, toggle: (id: string) => void) {
  if (!row.plugin) {
    return {};
  }
  return {
    role: "button",
    tabIndex: 0,
    title: "Детали вызова",
    "aria-expanded": open,
    onClick: () => toggle(row.id),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        toggle(row.id);
      }
    },
  };
}

/** Лента: строки по порядку, вид строки — по её роли в разговоре. */
export function Feed({
  rows,
  error,
  chatTitle,
}: {
  rows: FeedRow[];
  error: string;
  /** Титул чата для деталей вызова — тот, что стоит в шапке. */
  chatTitle: string;
}) {
  /** Раскрытая строка вызова плагина: клик по строке — открыть, повторный — закрыть. */
  const [opened, setOpened] = useState<string | undefined>(undefined);
  const toggle = (id: string): void => {
    setOpened((open) => (open === id ? undefined : id));
  };
  return (
    <>
      {rows.map((row) => {
        const tone = TONE[Object.keys(TONE).find((text) => row.text.startsWith(text)) ?? ""] ?? "";
        const expanded = Boolean(row.plugin) && opened === row.id;
        return (
          <div
            key={row.id}
            className={`feed__row feed__row--${row.kind}${tone ? ` ${tone}` : ""}${row.plugin ? " feed__row--expandable" : ""}`}
            data-kind={row.kind}
            {...(expansion(row, expanded, toggle) as object)}          >
            {row.text || "…"}
            {expanded ? <RowDetails row={row} chatTitle={chatTitle} /> : null}
          </div>
        );
      })}
      {error ? <div className="feed__notice">{error}</div> : null}
    </>
  );
}
