import { useEffect } from "react";

import { outsideOverlay } from "./overlay";

/** Закрытие открытого оверлея по Esc и клику снаружи — иначе меню и список
 *  висят поверх поля ввода и перехватывают клик по «отправить». Снаружи
 *  ловится mousedown, а не click: окно одобрения открывается асинхронно,
 *  после клика по кнопке команды — продолжение клика ещё всплывает до window,
 *  и слушатель click успел бы закрыть то, что этот же клик открыл. mousedown
 *  открывающего жеста всегда раньше подписки, поэтому оверлей переживает свой клик. */
export function useOverlayDismiss(
  open: boolean,
  /** Клик снаружи: закрытие без возврата фокуса — фокус уводит сам жест. */
  close: () => void,
  /** Esc — отдельный жест: панель сравнения возвращает фокус бейджу (спека
   *  «Клавиатура»), остальным оверлеям возврата нет. */
  onEscape: () => void,
): void {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (outsideOverlay(target)) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [open, close, onEscape]);
}
