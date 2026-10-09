// Сводка расхода раздела «Статистика»: одна команда моста на период — сводку
// считает Rust (stats_summary), экран тысяч строк stats.jsonl не видит. Смена
// периода перечитывает сводку; устаревший ответ после смены не рисуется.

import { useCallback, useEffect, useState } from "react";

import { bridge } from "../../bridge";
// Типы stats — из канонического источника (src/bridge/types.ts): фасад
// переэкспортирует не всё, а мост зовётся как у всех фич — через ../../bridge.
import type { StatsPeriod, StatsSummary } from "../../bridge/types";

export function useStats(period: StatsPeriod): {
  summary: StatsSummary | null;
  error: string | null;
  reload: () => void;
} {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((one) => one + 1), []);
  useEffect(() => {
    let alive = true;
    setError(null);
    bridge()
      .statsSummary(period)
      .then((one) => {
        if (alive) {
          setSummary(one);
        }
      })
      .catch((reason: unknown) => {
        if (alive) {
          setError(String(reason));
        }
      });
    return () => {
      alive = false;
    };
  }, [period, tick]);
  return { summary, error, reload };
}
