import "./SidebarItem.css";

/** Строка списка сайдбара: проект или чат. Две линии — название и вторая линия
 *  из реальных данных (путь папки, время чата); без данных — одна линия
 *  (docs/specs/2026-10-06-11-glavnoe.md, «Состав основы»). Состояние «активный» —
 *  единственное, ради чего строка вынесена в отдельный компонент (docs/DESIGN.md, раздел 6). */
export function SidebarItem({
  title,
  sub,
  active = false,
  testid,
  onClick,
}: {
  title: string;
  /** Вторая линия из реальных данных; нет данных — линии нет. */
  sub?: string;
  active?: boolean;
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
      aria-current={active ? "true" : undefined}
      onClick={onClick}
    >
      <span className="sidebar-item__title">{title}</span>
      {sub ? <span className="sidebar-item__sub">{sub}</span> : null}
    </button>
  );
}
