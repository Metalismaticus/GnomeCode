// Всплывающее меню строки сайдбара (ПКМ или «⋯»): карточка с пунктами у точки
// открытия. Живёт в портале документа — сайдбар скролится и режет overflow,
// меню не должно попадать под обрезку. Закрывается Esc, кликом снаружи и
// уходом скролла — тот же узор, что у оверлеев чата (useOverlayDismiss).

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import "./RowMenu.css";

/** Место открытия: экранные координаты точки щелчка (ПКМ или «⋯»). */
export type MenuSpot = { x: number; y: number };

/** Ширина карточки меню: под самый длинный пункт («Переименовать») с запасом. */
const MENU_WIDTH = 208;

export function RowMenu({ spot, onClose, children }: { spot: MenuSpot; onClose: () => void; children: ReactNode }) {
  const card = useRef<HTMLDivElement | null>(null);
  const [place, setPlace] = useState({ left: spot.x, top: spot.y });

  // Карточка не вылезает за окно: у правого края отражается влево, у нижнего —
  // вверх. Мерка после монтирования: размер пунктов до отрисовки неизвестен.
  useLayoutEffect(() => {
    const box = card.current?.getBoundingClientRect();
    const left = Math.min(spot.x, window.innerWidth - MENU_WIDTH - 8);
    const top = box && spot.y + box.height > window.innerHeight - 8
      ? Math.max(8, spot.y - box.height)
      : Math.min(spot.y, window.innerHeight - 8);
    setPlace({ left: Math.max(8, left), top });
  }, [spot.x, spot.y]);

  // Esc и клик снаружи закрывают. Прокрутка — только жестом пользователя
  // (колесо, касание): после щелчка по строке фокус сам вызывает прокрутку
  // списка, и меню, закрывшееся на ней, не открывалось бы вовсе (замер
  // 2026-10-11). Программная прокрутка меню не роняет.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    const onDown = (event: MouseEvent) => {
      if (!card.current?.contains(event.target as Node)) {
        onClose();
      }
    };
    const onWheel = () => onClose();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("wheel", onWheel, true);
    window.addEventListener("touchmove", onWheel, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("wheel", onWheel, true);
      window.removeEventListener("touchmove", onWheel, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={card}
      className="row-menu"
      data-testid="row-menu"
      role="menu"
      style={{ left: place.left, top: place.top, width: MENU_WIDTH }}
    >
      {children}
    </div>,
    document.body,
  );
}

/** Пункт меню: строка-кнопка; опасное действие («Удалить») — тревожным. */
export function MenuItem({ label, danger = false, onPick }: { label: string; danger?: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`row-menu__item${danger ? " row-menu__item--danger" : ""}`}
      data-testid={`row-menu-${label}`}
      onClick={onPick}
    >
      {label}
    </button>
  );
}
