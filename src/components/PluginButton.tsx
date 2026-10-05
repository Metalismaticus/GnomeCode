// Кнопки подключённых плагинов в шапке чата: одна команда плагина — одна кнопка.
// Слова владельца: «кнопки подключённого плагина выводятся над чатом».
//
// Клик по кнопке ждёт слой прав: команда плагина не должна уходить движку без
// одобрения, а слоя прав в проекте нет (docs/BLOCKED.md, «Решения»). Поэтому
// кнопка показывает, что команда есть, и честно говорит, что запустить её пока
// нечем, — вместо того чтобы звать плагина без спроса.

import type { Plugin } from "../bridge";

import "./PluginButton.css";

/** Подсказка кнопки: почему нажатие пока ничего не делает. */
const PENDING = "Команда ждёт слоя прав: запустить плагин без одобрения нельзя";

export type PluginButtonProps = {
  plugin: Plugin;
  command: Plugin["commands"][number];
};

/** Одна кнопка команды плагина: подпись — имя команды, подсказка — что она делает. */
export function PluginButton({ plugin, command }: PluginButtonProps) {
  return (
    <button
      type="button"
      className="plugin-button"
      data-testid="plugin-button"
      data-plugin={plugin.id}
      data-command={command.name}
      title={`${command.label} — ${command.description || plugin.id}. ${PENDING}`}
      aria-label={command.label}
    >
      {command.label}
    </button>
  );
}