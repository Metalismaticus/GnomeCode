/** Раздел «Статистика» (docs/BATCH.md, пункт 2, шаг «экран»): расход денег,
 *  токенов и времени по проектам и моделям за период 7/30 дней или всё.
 *  Сводку считает Rust одной командой (stats_summary) — на экране только
 *  группы, тысячи строк stats.jsonl сюда не доходят. Цены — из кэша сравнения:
 *  модель без цен — «стоимость неизвестна», дата кэша видна, когда цены
 *  применились, свежий кэш пересчитывает старые записи.
 *
 *  Открытие — строкой «Статистика» в сайдбаре; у проекта на экране и у
 *  активного проекта в сайдбаре — строка «Этот проект стоил X» (её ставит
 *  Sidebar по данным App). */

import { useState, type ReactNode } from "react";

import type { StatsPeriod, StatsProject, StatsSummary, StatsUsage, StatsModel } from "../bridge/types";
import { dateOf, moneyOf } from "../compare";
import { useStats } from "../features/stats/useStats";

import "./StatsPage.css";

const PERIODS: { key: StatsPeriod; title: string }[] = [
  { key: "7", title: "7 дней" },
  { key: "30", title: "30 дней" },
  { key: "all", title: "Всё" },
];

/** Токены группы: оплаченные — ввод, вывод и рассуждения (чтение кэша — в деньгах). */
const billedOf = (one: StatsUsage): number => one.input + one.output + one.reasoning;

const tokensOf = (one: StatsUsage): string =>
  new Intl.NumberFormat("ru-RU").format(Math.round(billedOf(one)));

/** Время работы: «45 с», «1 мин 30 с», «2 ч». Сценарий читает его обратно
 *  (tests/ui/stats_page.mjs) — единицы не менять незаметно. */
export function durationOf(ms: number): string {
  const total = Math.round(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} ч`);
  }
  if (minutes > 0) {
    parts.push(`${minutes} мин`);
  }
  if (seconds > 0 || parts.length === 0) {
    parts.push(`${seconds} с`);
  }
  return parts.join(" ");
}

/** Деньги группы: сумма известной части; цен нет вовсе — «стоимость неизвестна». */
function costText(one: StatsUsage): string {
  return one.cost === null ? "стоимость неизвестна" : moneyOf(one.cost);
}

/** Пометка «часть моделей без цен»: деньги группы — известная часть. */
function Partial({ visible }: { visible: boolean }) {
  return visible ? <em className="stats-page__partial">часть моделей без цен</em> : null;
}

/** Ячейки чисел строки деления: токены, деньги, время — одни на оба деления. */
function Cells({ one }: { one: StatsUsage }) {
  return (
    <>
      <span className="stats-page__num stats-page__num--tokens">{tokensOf(one)}</span>
      <span className="stats-page__num stats-page__num--money">
        {costText(one)}
        <Partial visible={one.costPartial} />
      </span>
      <span className="stats-page__num stats-page__num--time">{durationOf(one.durationMs)}</span>
    </>
  );
}

function ProjectRow({ one }: { one: StatsProject }) {
  const name = one.path.split(/[\\/]/).filter(Boolean).pop() ?? one.path;
  return (
    <div className="stats-page__row" data-testid="stats-project-row" data-project={one.path}>
      <div className="stats-page__who">
        <span className="stats-page__name">{name}</span>
        <span className="stats-page__sub">
          {one.usage.cost === null ? "стоимость неизвестна" : `Этот проект стоил ${moneyOf(one.usage.cost)}`}
          <Partial visible={one.usage.costPartial} />
        </span>
      </div>
      <Cells one={one.usage} />
    </div>
  );
}

function ModelRow({ one }: { one: StatsModel }) {
  return (
    <div className="stats-page__row" data-testid="stats-model-row">
      <div className="stats-page__who">
        <span className="stats-page__name">{one.name ?? `${one.provider}/${one.model}`}</span>
        {one.name ? (
          <span className="stats-page__sub">
            {one.provider}/{one.model}
          </span>
        ) : null}
      </div>
      <Cells one={one.usage} />
    </div>
  );
}

/** Итог раздела: три числа; у денег — дата применённого кэша цен. */
function TotalsCard({ summary }: { summary: StatsSummary }) {
  const { totals, pricedAt } = summary;
  const empty = summary.projects.length === 0 && summary.models.length === 0;
  return (
    <section className="stats-page__totals" data-testid="stats-totals">
      <div className="stats-page__total stats-page__total--tokens">
        <span className="stats-page__total-label">Токены</span>
        <span className="stats-page__total-value">{tokensOf(totals)}</span>
      </div>
      <div className="stats-page__total stats-page__total--money">
        <span className="stats-page__total-label">Деньги</span>
        <span className="stats-page__total-value">{costText(totals)}</span>
        <Partial visible={totals.costPartial} />
        {pricedAt !== null && totals.cost !== null && !empty ? (
          <span className="stats-page__priced">Цены от {dateOf(pricedAt)}</span>
        ) : null}
      </div>
      <div className="stats-page__total stats-page__total--time">
        <span className="stats-page__total-label">Время</span>
        <span className="stats-page__total-value">{durationOf(totals.durationMs)}</span>
      </div>
    </section>
  );
}

/** Деление с заголовком колонок: строки на одной сетке — числа выровнены. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="stats-page__group">
      <h2 className="stats-page__group-title">{title}</h2>
      <div className="stats-page__columns" aria-hidden="true">
        <span />
        <span>Токены</span>
        <span>Деньги</span>
        <span>Время</span>
      </div>
      {children}
    </section>
  );
}

/** Шапка раздела: заголовок и переключатель периода — тащит окно без рамки. */
function Head({ period, onPick }: { period: StatsPeriod; onPick: (one: StatsPeriod) => void }) {
  return (
    <div className="stats-page__head" data-tauri-drag-region>
      <h1 className="stats-page__title" data-tauri-drag-region>
        Статистика
      </h1>
      <div className="stats-page__periods" role="group" aria-label="Период расхода">
        {PERIODS.map((one) => (
          <button
            key={one.key}
            type="button"
            className="stats-page__period"
            data-testid={`stats-period-${one.key}`}
            aria-pressed={period === one.key}
            onClick={() => onPick(one.key)}
          >
            {one.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>("all");
  const { summary, error } = useStats(period);
  const empty = !!summary && summary.projects.length === 0 && summary.models.length === 0;
  return (
    <main className="stats-page" data-testid="stats-page">
      <Head period={period} onPick={setPeriod} />
      <div className="stats-page__body">
        {error ? (
          <div className="stats-page__note" data-testid="stats-error">
            Статистика не читается: {error}
          </div>
        ) : null}
        {summary ? (
          <>
            <TotalsCard summary={summary} />
            {empty ? (
              <div className="stats-page__note" data-testid="stats-empty">
                Пока нет расхода — статистика появится после первых ответов моделей.
              </div>
            ) : (
              <>
                <Group title="По проектам">
                  {summary.projects.map((one) => (
                    <ProjectRow key={one.path} one={one} />
                  ))}
                </Group>
                <Group title="По моделям">
                  {summary.models.map((one) => (
                    <ModelRow key={`${one.provider}/${one.model}`} one={one} />
                  ))}
                </Group>
              </>
            )}
          </>
        ) : (
          <div className="stats-page__note" data-testid="stats-loading">
            Считаю расход…
          </div>
        )}
      </div>
    </main>
  );
}
