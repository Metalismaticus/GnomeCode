// Сводка прав перед первым включением плагина из каталога (docs/SPEC/plugins.md,
// сцена H): что плагин запрашивает — по категориям декларации, и два ответа,
// Разрешить и Отмена. Customize здесь нет: правила плагина — отдельный пункт
// партии (Configure-экран), устанавливающий плагин их не настраивает.

import type { CatalogEntry } from "../catalog";
import "./PluginSummary.css";

export type PluginSummaryProps = {
  entry: CatalogEntry;
  /** «Разрешить»: установка и подключение к текущему чату — без конфигов. */
  onAllow: (entry: CatalogEntry) => void;
  /** «Отмена»: ничего не ставится и не подключается, окно уходит. */
  onCancel: () => void;
};

/** Компактное окно сводки прав над чатом: решение видно рядом с каталогом. */
export function PluginSummary({ entry, onAllow, onCancel }: PluginSummaryProps) {
  return (
    <div
      className="plugin-summary"
      data-testid="plugin-summary"
      role="alertdialog"
      aria-label={`Права плагина ${entry.name}`}
    >
      <div className="plugin-summary__title">{entry.name} wants access to:</div>
      <div className="plugin-summary__list" data-testid="summary-permissions">
        {entry.permissions.map((one) => (
          <div className="plugin-summary__row" key={`${one.category}:${one.value}`}>
            <span className="plugin-summary__mark">✓</span>
            <span className="plugin-summary__category">{one.category}</span>
            <span className="plugin-summary__value">{one.value}</span>
          </div>
        ))}
        {entry.permissions.length === 0 ? (
          <div className="plugin-summary__row">
            Права не объявлены — каждый вызов будет спрашивать владельца
          </div>
        ) : null}
      </div>
      <div className="plugin-summary__actions">
        <button
          type="button"
          className="plugin-summary__btn plugin-summary__btn--main"
          data-testid="summary-allow"
          title="Установить и подключить к этому чату — без конфигов и перезапуска"
          onClick={() => onAllow(entry)}
        >
          Разрешить
        </button>
        <button
          type="button"
          className="plugin-summary__btn"
          data-testid="summary-cancel"
          title="Ничего не устанавливать"
          onClick={onCancel}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
