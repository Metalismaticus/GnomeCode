import type { ReactNode } from "react";

import "./SidebarItem.css";

/** Строка списка сайдбара: проект или чат. Две линии — название и вторая линия
 *  из реальных данных (путь папки, время чата); без данных — одна линия
 *  (docs/specs/2026-10-06-11-glavnoe.md, «Состав основы»). Состояние «активный» —
 *  единственное, ради чего строка вынесена в отдельный компонент (docs/DESIGN.md, раздел 6). */
export function SidebarItem({
  title,
  sub,
  active = false,
  page = false,
  glyph,
  testid,
  onClick,
}: {
  title: string;
  /** Вторая линия из реальных данных; нет данных — линии нет. */
  sub?: string;
  active?: boolean;
  /** aria-current="page": постоянная подсветка открытой страницы (настройки). */
  page?: boolean;
  /** Глиф перед названием (вход в настройки — шестерёнка, пункт 12). */
  glyph?: ReactNode;
  testid?: string;
  /** Клик по строке: чат открывается, раздел «Плагины» тоже ведёт отсюда. */
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-item${active ? " sidebar-item--active" : ""}`}
      title={title}
      data-testid={testid}
      aria-current={active ? (page ? "page" : "true") : undefined}
      onClick={onClick}
    >
      {glyph ? (
        <span className="sidebar-item__line">
          <span className="sidebar-item__icon">{glyph}</span>
          <span className="sidebar-item__title">{title}</span>
        </span>
      ) : (
        <span className="sidebar-item__title">{title}</span>
      )}
      {sub ? <span className="sidebar-item__sub">{sub}</span> : null}
    </button>
  );
}
