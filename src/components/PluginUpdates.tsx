// Вкладка Updates раздела «Плагин» (пункт 4 партии): что updates.json помнит об
// обновлениях — источник правды фоновая проверка при запуске (src-tauri/src/plugins/
// updates.rs). Карточка показывает версии «от → до» и пометку: обновлено / ждёт прав /
// вне каталога / сломано; у ждущего прав — кнопка сводки, решение владельца переносит
// обновление тем же «Разрешить», что установку из каталога. Окна при запуске нет:
// сводка ждёт во вкладке до решения. Тела карточек те же классы, что у карточек
// сцены A (PluginsPage.css), свой стиль — только пометка и версии (PluginUpdates.css).

import type { Plugin } from "../bridge";

/** Пометка обновления словами: enum моста → слова вкладки. */
const STATUS: Record<NonNullable<Plugin["update"]>["status"], string> = {
  applied: "обновлено",
  held: "ждёт прав",
  outside: "вне каталога",
  broken: "сломано",
};

export type PluginUpdatesProps = {
  plugins: Plugin[];
  /** Пометка последней проверки каталога: не ответил — работаем на текущих. */
  note: string | null;
  /** Кнопка сводки ждущего прав: открывает окно сводки (его держит PluginsPage). */
  onAllow: (id: string) => void;
};

/** Тело вкладки Updates: карточки обновлений, пометка каталога, честная пустота. */
export function PluginUpdates({ plugins, note, onAllow }: PluginUpdatesProps) {
  const updates = plugins.filter((one) => one.update);
  return (
    <>
      {note ? (
        <div className="plugin-updates__note" data-testid="plugin-updates-note">{note}</div>
      ) : null}
      {updates.map((one) => (
        <UpdateCard key={one.id} plugin={one} onAllow={onAllow} />
      ))}
      {updates.length === 0 && !note ? (
        <div className="plugins-page__empty" data-testid="plugin-updates-empty">
          Обновлений нет — все плагины на своих версиях
        </div>
      ) : null}
    </>
  );
}

/** Карточка обновления: версии «от → до», текущая версия, пометка и кнопка
 *  сводки у ждущего прав — обновления без изменения прав кнопки не знают. */
function UpdateCard({ plugin, onAllow }: { plugin: Plugin; onAllow: (id: string) => void }) {
  const update = plugin.update;
  if (!update) {
    return null;
  }
  const name = plugin.name ?? plugin.id;
  return (
    <article
      className="plugin-card plugin-update"
      data-testid="plugin-update-card"
      data-plugin={plugin.id}
    >
      <span className="plugin-card__icon" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <div className="plugin-card__body">
        <div className="plugin-card__line">
          <span className="plugin-card__name">{name}</span>
          <span className="plugin-update__versions" data-testid="plugin-update-versions">
            {update.from} → {update.to}
          </span>
          <span className="plugin-update__status" data-testid="plugin-update-status">
            {STATUS[update.status]}
          </span>
        </div>
        <div className="plugin-card__version" data-testid="plugin-update-version">
          версия {plugin.version ?? plugin.id}
        </div>
        {update.permissions?.length ? (
          <div className="plugin-card__permissions" data-testid="plugin-update-permissions">
            {update.permissions.map((one) => (
              <span className="plugin-card__permission" key={one}>{one}</span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="plugin-card__actions">
        {update.status === "held" ? (
          <button
            type="button"
            className="plugin-card__action"
            data-testid="plugin-update-allow"
            title={`Права версии ${update.to}: сводка до включения`}
            onClick={() => onAllow(plugin.id)}
          >
            Обновить
          </button>
        ) : null}
      </div>
    </article>
  );
}
