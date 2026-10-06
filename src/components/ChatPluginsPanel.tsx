// Панель «Plugins in this chat» (docs/SPEC/plugins.md, сцена D): список
// подключённых к чату плагинов со статусами и снятием с чата без деинсталляции,
// и «+ Add plugin» к списку подключения. Открывается кликом по области бейджей
// в шапке (не по кнопке команды).

import type { Plugin } from "../bridge";

import "./ChatPluginsPanel.css";

export type ChatPluginsPanelProps = {
  /** Подключённые к чату плагины — строки панели. */
  plugins: Plugin[];
  /** Снять плагин с чата: кнопки уходят из этого окна, установка остаётся. */
  onRemove: (id: string) => void;
  /** «+ Add plugin»: открыть список подключения (пункт «Connect plugin»). */
  onAdd: () => void;
  onClose: () => void;
};

/** Одна строка панели: имя плагина, статус по скоупу и снятие с чата. */
function Row({ plugin, onRemove }: { plugin: Plugin; onRemove: (id: string) => void }) {
  const status = plugin.scope === "project" || plugin.scope === "global" ? "Project default" : "Enabled";
  return (
    <div className="chat-plugins__row" data-testid="chat-plugin-row" data-plugin={plugin.id}>
      <span className="chat-plugins__name">{plugin.name ?? plugin.id}</span>
      <span className="chat-plugins__status">{status}</span>
      <button
        type="button"
        className="chat-plugins__remove"
        data-testid="plugin-chat-remove"
        data-plugin={plugin.id}
        title={`Снять ${plugin.name ?? plugin.id} с чата: установка и скоупы остаются`}
        onClick={() => onRemove(plugin.id)}
      >
        ✕
      </button>
    </div>
  );
}

/** Компактная панель над чатом, как окно списка плагинов. */
export function ChatPluginsPanel({ plugins, onRemove, onAdd, onClose }: ChatPluginsPanelProps) {
  return (
    <div
      className="chat-plugins"
      data-testid="chat-plugins-panel"
      role="dialog"
      aria-label="Plugins in this chat"
    >
      <div className="chat-plugins__head">
        <div className="chat-plugins__title">Plugins in this chat</div>
        <button
          type="button"
          className="chat-plugins__close"
          data-testid="chat-plugins-close"
          title="Закрыть панель плагинов чата"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {plugins.map((plugin) => (
        <Row key={plugin.id} plugin={plugin} onRemove={onRemove} />
      ))}
      {!plugins.length ? (
        <div className="chat-plugins__empty">К этому чату плагины не подключены</div>
      ) : null}
      <div className="chat-plugins__add">
        <button
          type="button"
          className="chat-plugins__add-btn"
          data-testid="chat-plugins-add"
          title="Подключить плагин из списка установленных"
          onClick={onAdd}
        >
          + Add plugin
        </button>
      </div>
    </div>
  );
}
