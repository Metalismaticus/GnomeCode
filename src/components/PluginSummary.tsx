// Сводка прав перед первым включением плагина из каталога (docs/SPEC/plugins.md,
// сцена H): что плагин запрашивает — по категориям декларации, и ответы:
// «Разрешить» (подключение к чату), «Keep enabled for this project» и «Enable
// by default» (подключение со скоупом — сцена E, вернут кнопки в новых чатах),
// «Отмена». Customize здесь нет: правила плагина — отдельный пункт партии
// (Configure-экран), устанавливающий плагин их не настраивает.

import type { CatalogEntry } from "../catalog";
import type { PluginScope } from "../bridge";
import "./PluginSummary.css";

export type PluginSummaryProps = {
  entry: CatalogEntry;
  /** Подключить плагин: «Разрешить» — к текущему чату, кнопки скоупа — со
   *  скоупом проекта или глобальным; установка одна, без конфигов. */
  onAllow: (entry: CatalogEntry, scope?: PluginScope) => void;
  /** «Отмена»: ничего не ставится и не подключается, окно уходит. */
  onCancel: () => void;
};

/** Что плагин запрашивает: по категориям декларации; пустая декларация —
 *  честное «права не объявлены», каждый вызов будет спрашивать владельца. */
function Permissions({ entry }: { entry: CatalogEntry }) {
  return (
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
  );
}

/** Ответы сводки: установка одна — со скоупом по нажатой кнопке или без него. */
function Answers({ onAllow, onCancel }: { onAllow: (scope?: PluginScope) => void; onCancel: () => void }) {
  return (
    <div className="plugin-summary__actions">
      <button
        type="button"
        className="plugin-summary__btn plugin-summary__btn--main"
        data-testid="summary-allow"
        title="Установить и подключить к этому чату — без конфигов и перезапуска"
        onClick={() => onAllow()}
      >
        Разрешить
      </button>
      <button
        type="button"
        className="plugin-summary__btn"
        data-testid="summary-enable-project"
        title="Установить и включить во всех чатах этого проекта"
        onClick={() => onAllow("project")}
      >
        Keep enabled for this project
      </button>
      <button
        type="button"
        className="plugin-summary__btn"
        data-testid="summary-enable-global"
        title="Установить и предлагать во всех новых чатах"
        onClick={() => onAllow("global")}
      >
        Enable by default
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
  );
}

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
      <Permissions entry={entry} />
      <Answers
        onAllow={(scope?: PluginScope) => onAllow(entry, scope)}
        onCancel={onCancel}
      />
    </div>
  );
}
