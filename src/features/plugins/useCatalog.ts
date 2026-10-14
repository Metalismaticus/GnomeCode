// Каталог «Available» в интерфейсе: карточки и поиск по ним. Грузятся мостом
// только при открытии окна каталога — без сети в фоновом режиме и до клика
// «Browse plugins…». Форму записи отдаёт Rust (ADR-0001) — здесь только
// состояние окна: открыть, найти, перечитать (DT7), выбрать.

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
  /** Сайт не ответил и кэша нет: причина словами, а не пустота. */
  error: string;
  /** Данные из кэша последнего чтения (DT7): сайт не ответил — «данные от <дата>». */
  stale: boolean;
  /** Дата данных кэша (unix-миллисекунды); null — кэша не было. */
  fetchedAt: number | null;
  search: (text: string) => void;
  /** «Повторить» после отказа: тот же запрос к каталогу (DT7). */
  retry: () => void;
};

/** Каталог с ленивой загрузкой: снимок читается один раз при первом открытии,
 *  «Повторить» перечитывает (DT7). Ошибка при живом кэше — не пустой экран:
 *  карточки кэша с датой остаются, отказ виден строкой. */
export function useCatalog(open: boolean): CatalogState {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const read = useCallback(() => {
    setLoading(true);
    setError("");
    bridge()
      .catalogSnapshot()
      .then((snapshot) => {
        setEntries(snapshot.entries);
        setStale(snapshot.stale);
        setFetchedAt(snapshot.fetchedAt);
      })
      .catch((reason: unknown) => {
        setEntries([]);
        setStale(false);
        setFetchedAt(null);
        setError(String(reason));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open || loaded) {
      return;
    }
    setLoaded(true);
    read();
  }, [open, loaded, read]);

  const retry = useCallback(() => {
    read();
  }, [read]);

  const search = useCallback((text: string) => setQuery(text), []);
  const found = useMemo(() => foundIn(entries, query), [entries, query]);
  return { entries: found, query, loading, error, stale, fetchedAt, search, retry };
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
