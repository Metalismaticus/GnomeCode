// Полоса статистики над чатом (B10, концепт владельца): периоды, карточки
// Токены/Стоимость/Модели и donut разбивки по моделям. Данные — useStats
// (те же, что у раздела «Статистика», суммы считает Rust). Прогресс-бары
// против квот не рисуем: квот в данных нет — выдумывать нельзя.

import { useState } from "react";

import { moneyOf } from "../compare";
import type { StatsPeriod } from "../bridge";
import { tokensOf, useStats } from "../features/stats/useStats";

import "./StatsBar.css";

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: "today", label: "Сегодня" },
  { key: "7", label: "Неделя" },
  { key: "30", label: "Месяц" },
];

const DONUT_COLORS = ["#7c5cff", "#34d399", "#fbbf24", "#38bdf8", "#f472b6", "#94a3b8"];

/** Donut разбивки по моделям: дуги по доле стоимости (без цены — по токенам).
 *  Компактный (44px), легенда справа — как на концепте владельца. */
function Donut({ shares }: { shares: { name: string; percent: number; color: string }[] }) {
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg className="stats-bar__donut" width={44} height={44} viewBox="0 0 44 44" role="img" aria-label="Доля моделей в расходе">
      {shares.map((one) => {
        const dash = (one.percent / 100) * circumference;
        const arc = (
          <circle
            key={one.name}
            cx={22}
            cy={22}
            r={radius}
            fill="none"
            stroke={one.color}
            strokeWidth={5}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 22 22)"
          />
        );
        offset += dash;
        return arc;
      })}
    </svg>
  );
}

/** Лимиты использования в месяц (концепт: «4.8M / 20M»): владелец задаёт
 *  в настройках, stats-bar показывает «использовано / лимит» с прогрессом.
 *  Хранятся в localStorage — движок квоты не отдаёт, это настройка окна. */
const LIMITS_KEY = "gnomecode-usage-limits";

function readLimits(): { tokens: number; cost: number } {
  try {
    const raw = localStorage.getItem(LIMITS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return { tokens: 0, cost: 0 };
}

/** Карточка статистики с прогресс-баром, если задан лимит (концепт: «4.8M / 20M»
 *  с зелёной полосой 24%). Без лимита — просто значение и подпись. */
function StatCard({ label, value, used, limit, unit, testid }: {
  label: string;
  value: string;
  used: number;
  limit: number;
  unit: string;
  testid: string;
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return (
    <div className="stats-bar__card" data-testid={testid}>
      <span className="stats-bar__value">
        {value}
        {limit > 0 ? <span className="stats-bar__limit"> / {limit.toLocaleString("ru-RU")}{unit}</span> : null}
      </span>
      <span className="stats-bar__label">{label}</span>
      {percent !== null ? (
        <span className="stats-bar__progress" aria-hidden="true">
          <span className="stats-bar__progress-fill" style={{ width: `${percent}%` }} />
        </span>
      ) : null}
    </div>
  );
}

export function StatsBar({ currentModel }: { currentModel: string }) {
  const [period, setPeriod] = useState<StatsPeriod>("today");
  const { summary } = useStats(period);
  /** Фильтр по провайдеру (концепт: «Все провайдеры ▾»): пусто — все. */
  const [providerFilter, setProviderFilter] = useState("");

  if (!summary) {
    return null;
  }
  const models = [...summary.models]
    .sort((a, b) => (b.usage.cost ?? 0) - (a.usage.cost ?? 0))
    .slice(0, 6);
  const labs = [...new Set(models.map((one) => one.provider))].sort();
  const shown = providerFilter
    ? models.filter((one) => one.provider === providerFilter)
    : models;
  const totalCost = shown.reduce((sum, one) => sum + (one.usage.cost ?? 0), 0);
  const byTokens = totalCost === 0;
  const grand = byTokens
    ? shown.reduce((sum, one) => sum + one.usage.input + one.usage.output, 0)
    : totalCost;
  const shares = shown
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
        {/* Фильтр «Все провайдеры ▾» (концепт владельца): пусто — все. */}
        <select
          className="stats-bar__provider"
          data-testid="stats-provider-filter"
          value={providerFilter}
          onChange={(event) => setProviderFilter(event.target.value)}
          aria-label="Фильтр по провайдеру"
        >
          <option value="">Все провайдеры</option>
          {labs.map((one) => (
            <option key={one} value={one}>{one}</option>
          ))}
        </select>
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
        <StatCard label="Токены" value={tokensOf(summary.totals)} used={summary.totals.input + summary.totals.output} limit={readLimits().tokens} unit="M" testid="stats-tokens" />
        <StatCard label="Стоимость, USD" value={moneyOf(summary.totals.cost)} used={summary.totals.cost ?? 0} limit={readLimits().cost} unit="$" testid="stats-cost" />
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
