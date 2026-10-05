import type { Theme } from "../viewparams";
import { ThemeSwitch } from "./ThemeSwitch";

import "./ChatHeader.css";

/** Шапка чата: название слева, бейдж модели и переключатель темы справа.
 *  Кнопка `☰` рисуется только при ширине < 1200 px — при ней правая панель
 *  складывается (docs/DESIGN.md, раздел 5). */
export function ChatHeader({
  title,
  theme,
  onToggleTheme,
  onTogglePanel,
  panelOpen = false,
  model = "GLM-5.3 High",
}: {
  title: string;
  theme: Theme;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  panelOpen?: boolean;
  model?: string;
}) {
  return (
    <header className="chat-header" data-testid="chat-header">
      <span className="chat-header__title" data-testid="chat-title" title={title}>
        {title}
      </span>
      {/* Бейдж модели — не действие, поэтому не фокусируется (docs/DESIGN.md, раздел 6). */}
      <span className="chat-header__badge">{model}</span>
      <button
        type="button"
        className="chat-header__panel"
        data-testid="panel-toggle"
        title="Контекст проекта"
        aria-pressed={panelOpen}
        onClick={onTogglePanel}
      >
        ☰
      </button>
      <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
    </header>
  );
}