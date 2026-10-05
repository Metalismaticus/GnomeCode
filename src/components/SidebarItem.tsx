import "./SidebarItem.css";

/** Строка списка сайдбара: проект или чат. Состояние «активный» — единственное
 *  ради чего строка вынесена в отдельный компонент (docs/DESIGN.md, раздел 6). */
export function SidebarItem({
  title,
  active = false,
  testid,
  onClick,
}: {
  title: string;
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
      {title}
    </button>
  );
}