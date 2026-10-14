// Полоса статистики над чатом (B10, концепт владельца): периоды, карточки
// Токены/Стоимость/Модели и donut разбивки по моделям. Данные — useStats
// (те же, что у раздела «Статистика», суммы считает Rust). Прогресс-бары
// против квот не рисуем: квот в данных нет — выдумывать нельзя.

import { useState } from "react";

import { moneyOf } from "../compare";
import { tokensOf, useStats } from "../features/stats/useStats";
import type { StatsPeriod } from "../bridge";

import "./StatsBar.css";

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7", label: "Неделя" },
  { key: "30", label: "Месяц" },
];

const DONUT_COLORS = ["#7c5cff", "#34d399", "#fbbf24", "#38bdf8", "#f472b6", "#94a3b8"];

/** Donut разбивки по моделям: дуги по доле стоимости (без цены — по токенам). */
function Donut({ shares }: { shares: { name: string; percent: number; color: string }[] }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg className="stats-bar__donut" width={64} height={64} viewBox="0 0 64 64" role="img" aria-label="Доля моделей в расходе">
      {shares.map((one) => {
        const dash = (one.percent / 100) * circumference;
        const arc = (
          <circle
            key={one.name}
            cx={32}
            cy={32}
            r={radius}
            fill="none"
            stroke={one.color}
            strokeWidth={7}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 32 32)"
          />
        );
        offset += dash;
        return arc;
      })}
    </svg>
  );
}

export function StatsBar({ currentModel }: { currentModel: string }) {
  const [period, setPeriod] = useState<StatsPeriod>("today");
  const { summary } = useStats(period);

  if (!summary) {
    return null;
  }
  const models = [...summary.models]
    .sort((a, b) => (b.usage.cost ?? 0) - (a.usage.cost ?? 0))
    .slice(0, 6);
  const totalCost = models.reduce((sum, one) => sum + (one.usage.cost ?? 0), 0);
  const byTokens = totalCost === 0;
  const grand = byTokens
    ? models.reduce((sum, one) => sum + one.usage.input + one.usage.output, 0)
    : totalCost;
  const shares = models
    .map((one, index) => {
      const own = byTokens
        ? one.usage.input + one.usage.output
        : one.usage.cost ?? 0;
      return {
        name: one.name ?? one.model,
        percent: grand > 0 ? Math.round((own / grand) * 100) : 0,
        color: DONUT_COLORS[index % DONUT_COLORS.length],
      };
    })
    .filter((one) => one.percent > 0);

  return (
    <div className="stats-bar" data-testid="stats-bar">
      <div className="stats-bar__periods">
        {PERIODS.map((one) => (
          <button
            key={one.key}
            type="button"
            className={`stats-bar__period${period === one.key ? " stats-bar__period--on" : ""}`}
            data-testid={`stats-period-${one.key}`}
            onClick={() => setPeriod(one.key)}
          >
            {one.label}
          </button>
        ))}
      </div>
      <div className="stats-bar__cards">
        <div className="stats-bar__card" data-testid="stats-tokens">
          <span className="stats-bar__value">{tokensOf(summary.totals)}</span>
          <span className="stats-bar__label">Токены</span>
        </div>
        <div className="stats-bar__card" data-testid="stats-cost">
          <span className="stats-bar__value">{moneyOf(summary.totals.cost)}</span>
          <span className="stats-bar__label">Стоимость, USD</span>
        </div>
        <div className="stats-bar__card" data-testid="stats-models">
          <span className="stats-bar__value">{summary.models.length}</span>
          <span className="stats-bar__label">Модели</span>
        </div>
      </div>
      {shares.length ? (
        <div className="stats-bar__donut-wrap" data-testid="stats-donut">
          <Donut shares={shares} />
          <div className="stats-bar__legend">
            {shares.map((one) => (
              <div className="stats-bar__legend-row" key={one.name}>
                <span className="stats-bar__legend-chip" style={{ background: one.color }} aria-hidden="true" />
                <span className="stats-bar__legend-name" title={one.name === currentModel ? "Модель чата" : undefined}>
                  {one.name}
                  {one.name === currentModel ? " ·" : ""}
                </span>
                <span className="stats-bar__legend-percent">{one.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
