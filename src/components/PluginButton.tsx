// Кнопки подключённых плагинов в шапке чата: одна команда плагина — одна кнопка.
// Слова владельца: «кнопки подключённого плагина выводятся над чатом».
//
// Клик по кнопке проходит слой прав (docs/SPEC/plugins.md, «Утверждённый UX
// одобрения»): чувствительный вызов спрашивает владельца окном одобрения,
// разрешённый — исполняется движком, его работа видна в ленте строкой вызова
// инструмента.

import type { Plugin } from "../bridge";

import "./PluginButton.css";

export type PluginButtonProps = {
  plugin: Plugin;
  command: Plugin["commands"][number];
  /** Клик владельца: слой прав решает, окно одобрения или запуск. */
  onRun: (plugin: Plugin, command: Plugin["commands"][number]) => void;
};

/** Одна кнопка команды плагина: подпись — имя команды, подсказка — что она делает. */
export function PluginButton({ plugin, command, onRun }: PluginButtonProps) {
  return (
    <button
      type="button"
      className="plugin-button"
      data-testid="plugin-button"
      data-plugin={plugin.id}
      data-command={command.name}
      title={`${command.label} — ${command.description || plugin.id}`}
      aria-label={command.label}
      onClick={(event) => {
        // Клик по кнопке — команда, не панель: всплытие до области бейджей
        // открыло бы «Plugins in this chat» тем же кликом.
        event.stopPropagation();
        onRun(plugin, command);
      }}
    >
      {command.label}
    </button>
  );
}