// Сводка расхода вне окна Tauri: те же формы, что отдаёт `stats_summary`
// (src-tauri/src/stats.rs), и те же состояния экрана — `?состояние=статистика`
// открывает раздел с данными, `статистика-пусто` — честный ноль, а
// `?статистика=нет` не отдаёт сводку вовсе (счётчики приветственной сборки
// честно показывают прочерк, спека приветствия §9). Числа — «настоящие
// данные»: посчитаны руками по ценам фикстуры сравнения (src/fixtureCompare.ts —
// GLM 0.14/0.56/0.02, Claude 2.0/10.0/0.2 за 1 млн токенов, рассуждения по цене
// вывода). Арифметику сводки фикстура не повторяет: на странице её считает
// Rust, сценарий сверяет суммы строк с итогом прямо на экране
// (tests/ui/stats_page.mjs). Период «today» сверён по тем же ценам:
// 450 000×0.14 + 180 000×0.56 + 20 000×0.56 + 300 000×0.02 за 1 млн = $0.181
// → «$0.18», токены 450 000 + 180 000 + 20 000 = 650 000 (спека приветствия §8).

import type { StatsPeriod, StatsProject, StatsSummary, StatsUsage } from "./bridge/types";
import { ROOT } from "./fixtureTree";
import { params } from "./viewparams";

const NORD = "C:\\Users\\Metalismatic\\Documents\\Nord";

/** Дата кэша цен фикстуры — та же, что у свежего каталога сравнения. */
const PRICED_AT = new Date(2026, 9, 6, 11, 24).getTime();

const usage = (
  input: number,
  output: number,
  reasoning: number,
  cacheRead: number,
  cost: number | null,
  costPartial: boolean,
  durationMs: number,
): StatsUsage => ({ input, output, reasoning, cacheRead, cacheWrite: 0, cost, costPartial, durationMs });

const project = (path: string, one: StatsUsage): StatsProject => ({ path, usage: one });

const model = (provider: string, id: string, name: string | null, one: StatsUsage) => ({
  provider,
  model: id,
  name,
  usage: one,
});

// Строки деления. Токены группы — ввод, вывод и рассуждения; время — сумма
// длительностей; деньги — по ценам фикстуры, у «corp-model-a» цен нет.
const GLM_7 = usage(500_000, 250_000, 0, 0, 0.21, false, 12_000);
const GLM_30 = usage(1_500_000, 750_000, 0, 500_000, 0.64, false, 72_000);
const GLM_ALL = usage(3_500_000, 750_000, 0, 500_000, 0.92, false, 87_000);
const CLAUDE = usage(100_000, 50_000, 50_000, 1_000_000, 1.4, false, 48_000);
const CORP = usage(40_000, 10_000, 0, 0, null, false, 30_000);

/** «За сегодня» (спека приветствия §8): одна модель GLM — ввод 450 000, вывод
 *  180 000, рассуждения 20 000, чтение кэша 300 000; время 36 000 мс. */
const GLM_TODAY = usage(450_000, 180_000, 20_000, 300_000, 0.181, false, 36_000);

const GNOME_7 = usage(600_000, 300_000, 50_000, 1_000_000, 1.61, false, 60_000);
const GNOME_30 = usage(640_000, 310_000, 50_000, 1_000_000, 1.61, true, 90_000);
const NORD_30 = usage(1_000_000, 500_000, 0, 500_000, 0.43, false, 60_000);
const NORD_ALL = usage(3_000_000, 500_000, 0, 500_000, 0.71, false, 75_000);

const TOTALS_7 = usage(600_000, 300_000, 50_000, 1_000_000, 1.61, false, 60_000);
const TOTALS_30 = usage(1_640_000, 810_000, 50_000, 1_500_000, 2.04, true, 150_000);
const TOTALS_ALL = usage(3_640_000, 810_000, 50_000, 1_500_000, 2.32, true, 165_000);

/** Сводка по периоду: суммы строк сходятся с итогом — это стережёт сценарий. */
const PERIODS: Record<StatsPeriod, StatsSummary> = {
  "7": {
    totals: TOTALS_7,
    projects: [project(ROOT, GNOME_7)],
    models: [model("zai-coding-plan", "glm-5.3-flash", "GLM-5.3 High", GLM_7), model("anthropic", "claude-sonnet-5-5", "Claude Sonnet 5.5", CLAUDE)],
    pricedAt: PRICED_AT,
  },
  "30": {
    totals: TOTALS_30,
    projects: [project(NORD, NORD_30), project(ROOT, GNOME_30)],
    models: [
      model("zai-coding-plan", "glm-5.3-flash", "GLM-5.3 High", GLM_30),
      model("anthropic", "claude-sonnet-5-5", "Claude Sonnet 5.5", CLAUDE),
      model("llm-corp", "corp-model-a", null, CORP),
    ],
    pricedAt: PRICED_AT,
  },
  all: {
    totals: TOTALS_ALL,
    projects: [project(NORD, NORD_ALL), project(ROOT, GNOME_30)],
    models: [
      model("zai-coding-plan", "glm-5.3-flash", "GLM-5.3 High", GLM_ALL),
      model("anthropic", "claude-sonnet-5-5", "Claude Sonnet 5.5", CLAUDE),
      model("llm-corp", "corp-model-a", null, CORP),
    ],
    pricedAt: PRICED_AT,
  },
  today: {
    // Одна модель за сегодня — итог равен строке деления (спека приветствия §8).
    // Кнопки «Сегодня» на странице «Статистика» от этого нет: период виден
    // только в счётчиках сборки.
    totals: GLM_TODAY,
    projects: [project(ROOT, GLM_TODAY)],
    models: [model("zai-coding-plan", "glm-5.3-flash", "GLM-5.3 High", GLM_TODAY)],
    pricedAt: PRICED_AT,
  },
};

/** Сводка по состоянию страницы: пустые данные — честный ноль без подсказки
 *  цен (даты нет — цены ни к чему не применились). */
export function summary(period: StatsPeriod): Promise<StatsSummary> {
  // «?статистика=нет»: мост не ответил — сводка не приходит, счётчики
  // приветственной сборки показывают прочерк с причиной (спека приветствия §9).
  if (params.noStats) {
    return Promise.reject(new Error("статистика недоступна (?статистика=нет)"));
  }
  if (params.feed === "статистика-пусто") {
    return Promise.resolve({
      totals: usage(0, 0, 0, 0, 0, false, 0),
      projects: [],
      models: [],
      pricedAt: null,
    });
  }
  return Promise.resolve(PERIODS[period]);
}
