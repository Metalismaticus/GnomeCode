// Каталог «Available» в интерфейсе: карточки и поиск по ним. Грузятся мостом
// только при открытии окна каталога — без сети в фоновом режиме и до клика
// «Browse plugins…» (docs/BATCH.md, пункт 1). Форму записи отдаёт Rust
// (ADR-0001) — здесь только состояние окна: открыть, найти, выбрать.

import { useCallback, useEffect, useMemo, useState } from "react";

import { bridge } from "../../bridge";
import type { CatalogEntry } from "../../catalog";

export type CatalogState = {
  /** Карточки после поиска; пусто — либо в каталоге ничего не нашлось, либо ещё едет. */
  entries: CatalogEntry[];
  /** Что ищет владелец; пусто — показываем весь каталог. */
  query: string;
  /** Индекс ещё едет от GitHub — окно об этом говорит. */
  loading: boolean;
  /** GitHub не ответил или индекс не читается: причина словами, а не пустота. */
  error: string;
  search: (text: string) => void;
};

/** Каталог с ленивой загрузкой: индекс читается один раз при первом открытии. */
export function useCatalog(open: boolean): CatalogState {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) {
      return;
    }
    setLoaded(true);
    setLoading(true);
    bridge()
      .catalogList()
      .then(setEntries)
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setLoading(false));
  }, [open, loaded]);

  const search = useCallback((text: string) => setQuery(text), []);
  const found = useMemo(() => foundIn(entries, query), [entries, query]);
  return { entries: found, query, loading, error, search };
}

/** Поиск по имени, описанию и id — без учёта регистра, как ищет владелец руками. */
function foundIn(entries: CatalogEntry[], query: string): CatalogEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return entries;
  }
  return entries.filter(
    (entry) =>
      entry.id.toLowerCase().includes(needle) ||
      entry.name.toLowerCase().includes(needle) ||
      entry.description.toLowerCase().includes(needle),
  );
}
