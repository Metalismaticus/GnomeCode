import "./ContextRow.css";

export type ContextRowData = {
  label: string;
  value: string;
  /** Значение статусное: «Выключен»/«Не отвечает» — цветом опасности. */
  tone?: "off" | "danger" | "mono";
};

/** Строка «метка — значение» правой панели: переиспользуется в трёх разделах,
 *  поэтому своя строка (docs/specs/2026-10-05-4-glavnoe-okno.md, «Компоненты»). */
export function ContextRow({ label, value, tone }: ContextRowData) {
  return (
    <div className="context-row" title={`${label} — ${value}`}>
      <span className="context-row__label">{label}</span>
      <span className={`context-row__value${tone ? ` context-row__value--${tone}` : ""}`}>{value}</span>
    </div>
  );
}