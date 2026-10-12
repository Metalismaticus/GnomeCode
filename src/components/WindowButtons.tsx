import { bridge } from "../bridge";

import "./WindowButtons.css";

/** Свои кнопки окна (docs/ROADMAP.md, «Окно без рамки: своя шапка»): свернуть,
 *  развернуть и закрыть — окно открывается без системной рамки, системных
 *  кнопок больше нет. Действие уходит мосту окна; на странице vite мост
 *  фикстуры только записывает вызов — реального окна там нет. */
export function WindowButtons() {
  const b = bridge();
  return (
    <div className="window-buttons" data-testid="window-buttons">
      <button
        type="button"
        className="window-buttons__btn"
        data-testid="window-minimize"
        title="Свернуть"
        aria-label="Свернуть окно"
        onClick={() => void b.windowMinimize()}
      >
        —
      </button>
      <button
        type="button"
        className="window-buttons__btn"
        data-testid="window-maximize"
        title="Развернуть"
        aria-label="Развернуть окно"
        onClick={() => void b.windowToggleMaximize()}
      >
        □
      </button>
      <button
        type="button"
        className="window-buttons__btn window-buttons__btn--close"
        data-testid="window-close"
        title="Закрыть"
        aria-label="Закрыть окно"
        onClick={() => void b.windowClose()}
      >
        ✕
      </button>
    </div>
  );
}
