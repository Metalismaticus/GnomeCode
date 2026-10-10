// Сворачиваемая ступень разбора (docs/specs/2026-10-06-11-glavnoe.md, «Состав основы»):
// заголовок Markdown ответа — ступень, номер — порядковый в сообщении; плитка номера
// 20×20, заголовок 14 px/600 (спека ленты §5: заголовок ответа читается крупнее
// меток). Развёрнута по умолчанию; клик сворачивает и разворачивает, номер и
// заголовок остаются видимыми в обоих состояниях (проверяемое утверждение светлого
// паспорта). Фокус с клавиатуры — обычная кнопка.
import { useState, type ReactNode } from "react";

import "./StepSection.css";

export function StepSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="step" data-testid="step" data-number={number}>
      <button
        type="button"
        className="step__head"
        data-testid="step-head"
        aria-expanded={expanded}
        title={expanded ? "Свернуть ступень" : "Развернуть ступень"}
        onClick={() => setExpanded((open) => !open)}
      >
        <span className="step__number" data-testid="step-number">
          {number}
        </span>
        <span className="step__title">{title}</span>
        <span className="step__mark" aria-hidden>
          {expanded ? "▼" : "▶"}
        </span>
      </button>
      {expanded ? <div className="step__body">{children}</div> : null}
    </div>
  );
}
