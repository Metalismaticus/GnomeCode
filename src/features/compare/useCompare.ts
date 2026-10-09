// Каталог моделей панели «Сравнение моделей»: ленивая загрузка мостом при
// первом открытии панели, поиск на клиенте и перечитывание кнопкой «Обновить».
// Узор `useCatalog` (docs/BATCH.md, пункт 1): состояние loading/error/data.
//
// Форму снимка отдаёт Rust (ADR-0001) — здесь только состояние окна: открыть,
// найти, выбрать, перечитать. Пометка «сайт недоступен» живёт вместе с данными
// (`stale` + дата снимка) — её ставит мост, не интерфейс.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { bridge } from "../../bridge";
import type { CompareModel, CompareSnapshot } from "../../compare";

export type CompareState = {
  /** Строки после поиска; пусто — либо в каталоге нет такого, либо ещё едет. */
  models: CompareModel[];
  /** Что ищет владелец; пусто — показываем весь каталог. */
  query: string;
  /** Дата снимка в «Обновлено …»; 0 — данных ещё нет. */
  fetchedAt: number;
  /** Таблица читалась из кэша: пометка «Сайт недоступен — данные от …». */
  stale: boolean;
  /** Каталог ещё едет от opencode.ai — панель ждёт и «Обновить» выключена. */
  loading: boolean;
  /** Сайт не ответил и кэша нет: причина словами, а не пустота. */
  error: string;
  search: (text: string) => void;
  refresh: () => void;
};

export function useCompare(open: boolean): CompareState {
  const [snapshot, setSnapshot] = useState<CompareSnapshot | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Панель перечитывает снимок на каждом открытии: модели движка (свои
  // endpoint'ы) меняются без перезапуска окна — выключенный endpoint и его
  // модели должны исчезнуть из переключателя, как только панель открыли.
  // Чтение кэш-первое (compare.rs) — повторное открытие дешёвое.
  //
  // Ровно одно чтение на открытие: зависимость от loading перезапускала бы
  // эффект самим завершением загрузки — панель перечитывала бы каталог,
  // пока открыта (tests/ui/compare_read_once.mjs ловит это на задержке моста;
  // мгновенный ответ фикстуры батчится до коммита и цикл прячет).
  const readForOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      readForOpen.current = false; // следующее открытие перечитает каталог
      return;
    }
    if (readForOpen.current) {
      return; // это открытие каталог уже читало
    }
    readForOpen.current = true;
    setLoading(true);
    bridge()
      .compareList()
      .then(setSnapshot)
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setLoading(false));
  }, [open]);

  const refresh = useCallback(() => {
    if (loading || refreshing) {
      return;
    }
    setRefreshing(true);
    bridge()
      .compareRefresh()
      .then(setSnapshot)
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setRefreshing(false));
  }, [loading, refreshing]);

  const search = useCallback((text: string) => setQuery(text), []);
  const models = useMemo(() => foundIn(snapshot?.models ?? [], query), [snapshot, query]);
  return {
    models,
    query,
    fetchedAt: snapshot?.fetchedAt ?? 0,
    stale: snapshot?.stale ?? false,
    loading: loading || refreshing,
    error,
    search,
    refresh,
  };
}

/** Поиск по имени, лабе и идентификатору — без учёта регистра, как ищет владелец. */
function foundIn(models: CompareModel[], query: string): CompareModel[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return models;
  }
  return models.filter(
    (model) =>
      model.name.toLowerCase().includes(needle) ||
      model.lab.toLowerCase().includes(needle) ||
      model.id.toLowerCase().includes(needle),
  );
}
