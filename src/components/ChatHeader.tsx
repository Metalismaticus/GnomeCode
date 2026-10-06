import type { Plugin } from "../bridge";
import type { Theme } from "../viewparams";
import { PluginButton } from "./PluginButton";
import { ThemeSwitch } from "./ThemeSwitch";

import "./ChatHeader.css";

export type ChatHeaderProps = {
  title: string;
  theme: Theme;
  onToggleTheme: () => void;
  onTogglePanel: () => void;
  panelOpen?: boolean;
  model?: string;
  /** Подключённые к чату плагины: одна кнопка на команду, рядом с бейджем. */
  plugins?: Plugin[];
  /** Клик по кнопке команды: слой прав решает вопрос одобрения и запуск. */
  onRunCommand: (plugin: Plugin, command: Plugin["commands"][number]) => void;
  /** Клик по области бейджей (не по кнопке команды): панель «Plugins in this chat». */
  onOpenPlugins?: () => void;
};

/** Область бейджей в шапке: кнопки команд подключённых плагинов; клик мимо
 *  кнопки команды — панель «Plugins in this chat» (docs/SPEC/plugins.md, сцена D). */
function PluginsArea({
  plugins,
  onRunCommand,
  onOpenPlugins,
}: {
  plugins: Plugin[];
  onRunCommand: ChatHeaderProps["onRunCommand"];
  onOpenPlugins?: () => void;
}) {
  return (
    <span
      className="chat-header__plugins"
      data-testid="header-plugins-area"
      role="button"
      tabIndex={0}
      title="Плагины этого чата"
      onClick={onOpenPlugins}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpenPlugins?.();
        }
      }}
    >
      {plugins.flatMap((plugin) =>
        plugin.commands.map((command) => (
          <PluginButton
            key={command.name}
            plugin={plugin}
            command={command}
            onRun={onRunCommand}
          />
        )),
      )}
    </span>
  );
}

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
  onRunCommand,
  onOpenPlugins,
}: ChatHeaderProps) {
  return (
    <header className="chat-header" data-testid="chat-header">
      <span className="chat-header__title" data-testid="chat-title" title={title}>
        {title}
      </span>
      {/* Бейдж модели — не действие, поэтому не фокусируется (docs/DESIGN.md, раздел 6). */}
      <span className="chat-header__badge">{model}</span>
      <PluginsArea plugins={plugins} onRunCommand={onRunCommand} onOpenPlugins={onOpenPlugins} />
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
