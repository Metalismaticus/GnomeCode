import type { ButtonHTMLAttributes, ReactNode } from "react";

import "./Button.css";

/** Вид кнопки: главная (акцент), призрачная и карточка пустого состояния —
 *  сегодня это три класса в app.css, а решение одно (docs/specs/2026-10-05-4-glavnoe-okno.md,
 *  «Компоненты»). */
export type ButtonVariant = "primary" | "ghost" | "card";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  /** Кнопка-знак 32×32 — минимальная цель нажатия (docs/DESIGN.md, раздел 4). */
  square?: boolean;
  children: ReactNode;
};

/** Кнопка продукта: вид, знак, выключенное состояние с причиной в `title`. */
export function Button({ variant = "ghost", square = false, className = "", ...rest }: Props) {
  const kind = square ? "btn btn--square" : "btn";
  return (
    <button
      type="button"
      {...rest}
      className={`${kind} btn--${variant}${className ? ` ${className}` : ""}`}
    />
  );
}