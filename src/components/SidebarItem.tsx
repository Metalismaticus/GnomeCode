import type { ReactNode } from "react";

import "./SidebarItem.css";

/** Строка списка сайдбара: первая линия — ряд «глиф? + название + время справа»,
 *  вторая — подпись из реальных данных (путь проекта, превью последнего сообщения
 *  чата); без данных — одна линия (docs/specs/2026-10-10-4-сайдбар.md, §4).
 *  Строка с onClick — кнопка (навигация, активный чат), без — отображение:
 *  ряды истории и проектов не кликаются, hover и фокус у нежатого врать не должны
 *  (спека §7). Состояние «активный» — единственное акцентное пятно списка. */
export function SidebarItem({
  title,
  sub,
  sub2,
  end,
  active = false,
  page = false,
  glyph,
  testid,
  onClick,
}: {
  title: string;
  /** Вторая линия из реальных данных; нет данных — линии нет. */
  sub?: string;
  /** Третья линия (стоимость проекта, «Этот проект стоил X»); нет данных — линии нет. */
  sub2?: string;
  /** Хвост первой линии (время чата): справа от названия, приглушённый. */
  end?: string;
  active?: boolean;
  /** aria-current="page": постоянная подсветка открытой страницы (настройки). */
  page?: boolean;
  /** Глиф перед названием (вход в настройки — шестерёнка, аватар проекта). */
  glyph?: ReactNode;
  testid?: string;
  /** Клик по строке: чат открывается, раздел «Плагины» тоже ведёт отсюда.
   *  Нет клика — строка отображением, не кнопкой (спека сайдбара §7). */
  onClick?: () => void;
}) {
  const line = (
    <span className="sidebar-item__line">
      {glyph ? <span className="sidebar-item__icon">{glyph}</span> : null}
      <span className="sidebar-item__title">{title}</span>
      {end ? <span className="sidebar-item__end">{end}</span> : null}
    </span>
  );
  const body = (
    <>
      {line}
      {sub ? <span className="sidebar-item__sub">{sub}</span> : null}
      {sub2 ? <span className="sidebar-item__sub">{sub2}</span> : null}
    </>
  );
  const state = `sidebar-item${active ? " sidebar-item--active" : ""}`;
  if (onClick) {
    return (
      <button
        type="button"
        className={state}
        title={title}
        data-testid={testid}
        aria-current={active ? (page ? "page" : "true") : undefined}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={state} title={title} data-testid={testid}>
      {body}
    </div>
  );
}
