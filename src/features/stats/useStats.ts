// Сводка расхода раздела «Статистика» и счётчиков приветственной сборки: одна
// команда моста на период — сводку считает Rust (stats_summary), экран тысяч
// строк stats.jsonl не видит. Смена периода перечитывает сводку; устаревший
// ответ после смены не рисуется.

import { useCallback, useEffect, useState } from "react";

import { bridge } from "../../bridge";
// Типы stats — из канонического источника (src/bridge/types.ts): фасад
// переэкспортирует не всё, а мост зовётся как у всех фич — через ../../bridge.
import type { StatsPeriod, StatsSummary, StatsUsage } from "../../bridge/types";

/** Оплаченные токены группы: ввод, вывод и рассуждения (чтение кэша — в деньгах).
 *  Одно определение для «Статистики» и счётчиков приветственной сборки — числа
 *  двух экранов не могут разойтись (спека приветствия §13). */
export const billedOf = (one: StatsUsage): number => one.input + one.output + one.reasoning;

/** Токены группы строкой: разряды ru-RU («650 000») — тот же формат, что у итога
 *  «Статистики». */
export const tokensOf = (one: StatsUsage): string =>
  new Intl.NumberFormat("ru-RU").format(Math.round(billedOf(one)));

/** Начало местных суток (unix-мс): «за сегодня» — с полуночи по часам владельца,
 *  не скользящие 24 часа — после полуночи те показали бы вчерашний расход.
 *  Полночь считает интерфейс и передаёт мосту вторым аргументом: Rust часовых
 *  поясов не заводит (спека приветствия §13). */
export function dayStartOf(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

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
      .statsSummary(period, dayStartOf())
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
