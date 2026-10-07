// Список установленных плагинов: поиск, разделы «Избранные» / «Недавние» /
// «Все плагины», строка плагина с командами и причиной, если он не запустился.
// У подключённой строки — полоса скоупов (docs/SPEC/plugins.md, сцена E):
// Once / Chat / Project / Global, предвыбран текущий скоуп подключения.

import type { Plugin, PluginScope } from "../bridge";
import type { PluginsState } from "../features/plugins/usePlugins";

import "./PluginPicker.css";

const SEARCH = "Поиск плагина…";
const EMPTY_TITLE = "Плагинов пока нет";
const EMPTY_HINT = "Откройте каталог и поставьте первый — список обновится сам";

/** Полоса скоупов сцены E: порядок спеки, «Chat» — умолчание подключения. */
const SCOPES: { kind: PluginScope; label: string; title: string }[] = [
  { kind: "once", label: "Once", title: "Только до конца текущего запроса" },
  { kind: "chat", label: "Chat", title: "Только этот чат — умолчание подключения" },
  { kind: "project", label: "Project", title: "Все чаты этого проекта" },
  { kind: "global", label: "Global", title: "Предлагается во всех новых чатах" },
];

export type PluginPickerProps = {
  plugins: PluginsState;
  /** Клик по «Browse plugins…» внизу списка: открыть каталог «Available». */
  onBrowse: () => void;
  onClose: () => void;
  /** Где стоит окно: у композера — над «+» (дверь меню и чата), в области чата —
   *  под шапкой справа, узор панели сравнения (дверь правой панели). */
  placement?: "composer" | "chat";
};

/** Окно списка плагинов: то, что открывает пункт «Connect plugin» меню «+». */
export function PluginPicker({ plugins, onBrowse, onClose, placement = "composer" }: PluginPickerProps) {
  return (
    <div
      className={placement === "chat" ? "plugin-picker plugin-picker--chat" : "plugin-picker"}
      data-testid="plugin-picker"
      role="dialog"
      aria-label="Плагины"
    >
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
      <div className="plugin-picker__browse">
        <button
          type="button"
          className="plugin-picker__browse-btn"
          data-testid="browse-plugins"
          title="Открыть каталог плагинов с GitHub"
          onClick={onBrowse}
        >
          Browse plugins…
        </button>
      </div>
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
        <div className="plugin-picker__empty-title">{EMPTY_TITLE}</div>
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

/** Полоса скоупов сцены E у подключённой строки: Once / Chat / Project / Global,
 *  предвыбран текущий скоуп; клик не подключает строку заново, а меняет скоуп. */
function ScopeBar({ plugin, onConnect }: { plugin: Plugin; onConnect: PluginRowProps["onConnect"] }) {
  return (
    <div
      className="plugin-row__scopes"
      data-testid="plugin-row-scopes"
      role="radiogroup"
      aria-label={`Скоуп плагина ${plugin.id}`}
      onClick={(event) => event.stopPropagation()}
    >
      {SCOPES.map((one) => (
        <button
          key={one.kind}
          type="button"
          className="plugin-row__scope"
          data-testid={`scope-${one.kind}`}
          aria-pressed={plugin.scope === one.kind}
          title={one.title}
          onClick={() => onConnect(plugin.id, one.kind)}
        >
          {one.label}
        </button>
      ))}
    </div>
  );
}

export type PluginRowProps = {
  plugin: Plugin;
  favorite: boolean;
  onConnect: (id: string, scope?: PluginScope) => void;
  onFavorite: (id: string) => void;
};

/** Строка плагина: имя, команды, причина неудачи. Клик — подключение к чату;
 *  у подключённой строки — полоса скоупов со своим действием. */
function PluginRow({ plugin, favorite, onConnect, onFavorite }: PluginRowProps) {
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
      {plugin.connected ? <ScopeBar plugin={plugin} onConnect={onConnect} /> : null}
    </div>
  );
}

/** Команды плагина одной строкой: сколько их, видно до подключения. */
function commands(plugin: Plugin): string {
  return plugin.commands.map((command) => command.label).join(", ");
}