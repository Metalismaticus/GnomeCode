// Окно каталога «Available» (docs/SPEC/plugins.md, сцена C — строка Browse
// plugins…): поиск, карточки плагинов с GitHub, кнопка Install. Install сам не
// ставит — он открывает сводку прав (сцена H), решение за владельцем там.

import type { CatalogEntry } from "../catalog";
import type { CatalogState } from "../features/plugins/useCatalog";

import "./CatalogPicker.css";

const TITLE = "Каталог плагинов";
const SEARCH = "Поиск в каталоге…";
const EMPTY = "В каталоге ничего не нашлось";

export type CatalogPickerProps = {
  catalog: CatalogState;
  /** Клик по Install карточки: сводка прав открывается, каталог остаётся под ней. */
  onInstall: (entry: CatalogEntry) => void;
  onClose: () => void;
};

/** Окно каталога: то, что открывает строка «Browse plugins…» списка плагинов. */
export function CatalogPicker({ catalog, onInstall, onClose }: CatalogPickerProps) {
  return (
    <div className="catalog-picker" data-testid="catalog-picker" role="dialog" aria-label="Каталог плагинов">
      <div className="catalog-picker__head">
        <div className="catalog-picker__title">{TITLE}</div>
        <button
          type="button"
          className="catalog-picker__close"
          data-testid="catalog-close"
          title="Закрыть каталог"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <input
        className="catalog-picker__search"
        data-testid="catalog-search"
        type="search"
        placeholder={SEARCH}
        value={catalog.query}
        onChange={(event) => catalog.search(event.target.value)}
      />
      {body(catalog, onInstall)}
    </div>
  );
}

/** Карточки каталога: ожидание, причина или отобранный поиском список. */
function body(catalog: CatalogState, onInstall: (entry: CatalogEntry) => void) {
  if (catalog.error) {
    return <div className="catalog-picker__empty">Каталог не читается: {catalog.error}</div>;
  }
  if (catalog.loading) {
    return <div className="catalog-picker__empty">Читаю каталог…</div>;
  }
  if (!catalog.entries.length) {
    return <div className="catalog-picker__empty" data-testid="catalog-empty">{EMPTY}</div>;
  }
  return catalog.entries.map((entry) => <Card key={entry.id} entry={entry} onInstall={onInstall} />);
}

/** Карточка плагина каталога: имя, версия, описание, автор — и Install. */
function Card({
  entry,
  onInstall,
}: {
  entry: CatalogEntry;
  onInstall: (entry: CatalogEntry) => void;
}) {
  return (
    <div className="catalog-card" data-testid="catalog-card" data-plugin={entry.id}>
      <div className="catalog-card__line">
        <span className="catalog-card__name">{entry.name}</span>
        <span className="catalog-card__version">{entry.version}</span>
      </div>
      <div className="catalog-card__description">{entry.description}</div>
      <div className="catalog-card__meta">
        <span className="catalog-card__author">{entry.author}</span>
        <button
          type="button"
          className="catalog-card__install"
          data-testid="catalog-install"
          title={`Установить ${entry.name} из каталога`}
          onClick={() => onInstall(entry)}
        >
          Install
        </button>
      </div>
    </div>
  );
}
