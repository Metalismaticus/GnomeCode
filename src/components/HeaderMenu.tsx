import type { Plugin } from "../bridge";

import "./HeaderMenu.css";

export type HeaderMenuProps = {
  /** Подключённые к чату плагины: раздел «Команды» — по строке на команду. */
  plugins: Plugin[];
  /** Движок не отвечает: команды выключены, причина — на самом пункте. */
  engineDown: boolean;
  /** Правая панель открыта: у «Контекста проекта» справа слово «открыта». */
  panelOpen: boolean;
  /** Открытую панель закрывает, закрытую открывает. */
  onTogglePanel: () => void;
  /** Панель «Плагины этого чата» — оверлей области чата. */
  onOpenPlugins: () => void;
  /** Клик по команде: слой прав решает вопрос одобрения и запуск. */
  onRunCommand: (plugin: Plugin, command: Plugin["commands"][number]) => void;
  /** Пункт «Настройки» ведёт на ту же страницу, что шестерёнка сайдбара. */
  onOpenSettings: () => void;
  /** Пункт своё дело сделал — меню закрывается. */
  onClose: () => void;
};

/** Меню «⋯» шапки (docs/specs/2026-10-09-2-тихий-хром.md, §5): плагины, панель
 *  и настройки переехали сюда с шапки. Пункты команд несут контракты прежних
 *  кнопок плагинов (data-testid="plugin-button", data-plugin, data-command) —
 *  сценарии полигона меняют только путь открытия. */
export function HeaderMenu({
  plugins,
  engineDown,
  panelOpen,
  onTogglePanel,
  onOpenPlugins,
  onRunCommand,
  onOpenSettings,
  onClose,
}: HeaderMenuProps) {
  const commands = plugins.flatMap((plugin) =>
    plugin.commands.map((command) => ({ plugin, command })),
  );
  return (
    <div className="header-menu" data-testid="header-menu" role="menu" aria-label="Ещё">
      <div className="header-menu__section" role="group">
        <div className="header-menu__section-title">Контекст</div>
        <button
          type="button"
          role="menuitem"
          className="header-menu__item"
          data-testid="menu-context"
          onClick={() => {
            onTogglePanel();
            onClose();
          }}
        >
          <span className="header-menu__item-title">Контекст проекта</span>
          {panelOpen ? <span className="header-menu__item-hint">открыта</span> : null}
        </button>
        <button
          type="button"
          role="menuitem"
          className="header-menu__item"
          data-testid="menu-plugins"
          onClick={() => {
            // Панель «Плагины этого чата» — оверлей чата: его установка сама
            // снимает меню (оно рисуется только при открытом «⋯»); лишний
            // onClose перебил бы свежий оверлей панелью не открыть.
            onOpenPlugins();
          }}
        >
          <span className="header-menu__item-title">Плагины этого чата</span>
          {plugins.length ? (
            <span className="header-menu__item-hint">{plugins.length}</span>
          ) : null}
        </button>
      </div>
      {/* Честность: команд нет — раздела нет вовсе; движок не отвечает — команды
          выключены с причиной на самом пункте (спека §5). */}
      {commands.length ? (
        <div className="header-menu__section" role="group">
          <div className="header-menu__section-title">Команды</div>
          {commands.map(({ plugin, command }) => (
            <button
              key={command.name}
              type="button"
              role="menuitem"
              className="header-menu__item"
              data-testid="plugin-button"
              data-plugin={plugin.id}
              data-command={command.name}
              disabled={engineDown}
              title={
                engineDown
                  ? "Движок не отвечает"
                  : `${plugin.name ?? plugin.id}: ${command.description || command.label}`
              }
              onClick={() => {
                // Меню закрывается само: ход одобрения рисует своё окно поверх (спека §5).
                onRunCommand(plugin, command);
                onClose();
              }}
            >
              <span className="header-menu__item-title">
                {plugin.name ?? plugin.id}: {command.label}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <div className="header-menu__section" role="group">
        <button
          type="button"
          role="menuitem"
          className="header-menu__item"
          data-testid="menu-settings"
          onClick={() => {
            onOpenSettings();
            onClose();
          }}
        >
          <span className="header-menu__item-title">Настройки</span>
        </button>
      </div>
    </div>
  );
}
