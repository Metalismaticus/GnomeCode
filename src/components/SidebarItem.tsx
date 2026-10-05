import "./SidebarItem.css";

/** Строка списка сайдбара: проект или чат. Состояние «активный» — единственное
 *  ради чего строка вынесена в отдельный компонент (docs/DESIGN.md, раздел 6). */
export function SidebarItem({
  title,
  active = false,
  testid,
}: {
  title: string;
  active?: boolean;
  testid?: string;
}) {
  return (
    <button
      type="button"
      className={`sidebar-item${active ? " sidebar-item--active" : ""}`}
      title={title}
      data-testid={testid}
      aria-current={active ? "true" : undefined}
    >
      {title}
    </button>
  );
}