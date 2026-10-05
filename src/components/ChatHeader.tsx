import type { Plugin } from "../bridge";
import type { Theme } from "../viewparams";
import { PluginButton } from "./PluginButton";
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
  plugins = [],
}: {
  title: string;
  theme: Theme;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  panelOpen?: boolean;
  model?: string;
  /** Подключённые к чату плагины: одна кнопка на команду, рядом с бейджем. */
  plugins?: Plugin[];
}) {
  return (
    <header className="chat-header" data-testid="chat-header">
      <span className="chat-header__title" data-testid="chat-title" title={title}>
        {title}
      </span>
      {/* Бейдж модели — не действие, поэтому не фокусируется (docs/DESIGN.md, раздел 6). */}
      <span className="chat-header__badge">{model}</span>
      <span className="chat-header__plugins">
        {plugins.flatMap((plugin) =>
          plugin.commands.map((command) => (
            <PluginButton key={command.name} plugin={plugin} command={command} />
          )),
        )}
      </span>
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