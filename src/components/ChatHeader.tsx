import type { Plugin } from "../bridge";
import { DEFAULT_MODEL } from "../appstate";
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
  /** Клик по бейджу модели: панель «Сравнение моделей» открывается или закрывается. */
  onToggleCompare?: () => void;
  /** Панель сравнения открыта: бейдж нажат и держит нажатие. */
  compareOpen?: boolean;
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
  model = DEFAULT_MODEL,
  plugins = [],
  onRunCommand,
  onOpenPlugins,
  onToggleCompare,
  compareOpen = false,
}: ChatHeaderProps) {
  return (
    <header className="chat-header" data-testid="chat-header">
      <span className="chat-header__title" data-testid="chat-title" title={title}>
        {title}
      </span>
      {/* Бейдж модели — теперь действие: открывает панель сравнения, поэтому у
          него все шесть состояний кнопки, в обходе шапки он стоит первым
          (спека docs/specs/2026-10-06-10-compare.md, «Клавиатура»). */}
      <button
        type="button"
        className="chat-header__badge"
        data-testid="model-badge"
        title="Сравнить модели и выбрать для этого чата"
        aria-pressed={compareOpen}
        onClick={onToggleCompare}
      >
        {model}
      </button>
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
