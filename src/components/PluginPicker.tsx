// Список установленных плагинов: поиск, разделы «Избранные» / «Недавние» /
// «Все плагины», строка плагина с командами и причиной, если он не запустился.
// Пустой список — понятными словами, а не пустотой.

import type { Plugin } from "../bridge";
import type { PluginsState } from "../features/plugins/usePlugins";

import "./PluginPicker.css";

const SEARCH = "Поиск плагина…";
const EMPTY = "Плагины не подключены";
const EMPTY_HINT =
  "Поставьте плагин в opencode.json проекта и вернитесь сюда — список обновится сам";

export type PluginPickerProps = {
  plugins: PluginsState;
  onClose: () => void;
};

/** Окно списка плагинов: то, что открывает пункт «Connect plugin» меню «+». */
export function PluginPicker({ plugins, onClose }: PluginPickerProps) {
  return (
    <div className="plugin-picker" data-testid="plugin-picker" role="dialog" aria-label="Плагины">
      <div className="plugin-picker__head">
        <div className="plugin-picker__title">Плагины</div>
        <button
          type="button"
          className="plugin-picker__close"
          data-testid="plugin-picker-close"
          title="Закрыть список плагинов"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <input
        className="plugin-picker__search"
        data-testid="plugin-search"
        type="search"
        placeholder={SEARCH}
        value={plugins.query}
        onChange={(event) => plugins.search(event.target.value)}
      />
      {body(plugins)}
    </div>
  );
}

/** Содержимое списка: разделы, пустой список или причина, по которой он не пришёл. */
function body(plugins: PluginsState) {
  if (plugins.error) {
    return <div className="plugin-picker__empty">Список не пришёл: {plugins.error}</div>;
  }
  if (plugins.loading) {
    return <div className="plugin-picker__empty">Читаю список плагинов…</div>;
  }
  if (!plugins.groups.length) {
    return (
      <div className="plugin-picker__empty" data-testid="plugin-picker-empty">
        <div className="plugin-picker__empty-title">{EMPTY}</div>
        <div className="plugin-picker__empty-hint">{EMPTY_HINT}</div>
      </div>
    );
  }
  return plugins.groups.map((group) => (
    <div className="plugin-picker__group" key={group.title} data-testid="plugin-group" data-group={group.title}>
      <div className="plugin-picker__group-title">{group.title}</div>
      {group.plugins.map((plugin) => (
        <PluginRow
          key={plugin.id}
          plugin={plugin}
          favorite={plugins.favorites.includes(plugin.id)}
          onConnect={plugins.connect}
          onFavorite={plugins.favorite}
        />
      ))}
    </div>
  ));
}

/** Строка плагина: имя, команды, причина неудачи. Клик — подключение к чату. */
function PluginRow({
  plugin,
  favorite,
  onConnect,
  onFavorite,
}: {
  plugin: Plugin;
  favorite: boolean;
  onConnect: (id: string) => void;
  onFavorite: (id: string) => void;
}) {
  return (
    <div
      className="plugin-row"
      data-testid="plugin-row"
      data-plugin={plugin.id}
      data-connected={plugin.connected}
      role="button"
      tabIndex={0}
      title={`Подключить ${plugin.id} к чату`}
      onClick={() => onConnect(plugin.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onConnect(plugin.id);
        }
      }}
    >
      <div className="plugin-row__line">
        <span className="plugin-row__name">{plugin.id}</span>
        <button
          type="button"
          className="plugin-row__favorite"
          data-testid="plugin-favorite"
          aria-pressed={favorite}
          title={favorite ? "Убрать из избранного" : "В избранное"}
          onClick={(event) => {
            event.stopPropagation();
            onFavorite(plugin.id);
          }}
        >
          ★
        </button>
        <span className="plugin-row__commands">{commands(plugin)}</span>
      </div>
      {plugin.error ? <div className="plugin-row__error">{plugin.error}</div> : null}
      {plugin.connected ? <div className="plugin-row__note">подключён к чату</div> : null}
    </div>
  );
}

/** Команды плагина одной строкой: сколько их, видно до подключения. */
function commands(plugin: Plugin): string {
  return plugin.commands.map((command) => command.label).join(", ");
}