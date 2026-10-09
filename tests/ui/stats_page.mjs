// Раздел «Статистика» (docs/BATCH.md, пункт 2, шаг «экран»): строка сайдбара
// открывает раздел, периоды 7/30/всё переключаются, сумма строк деления
// сходится с итогом, модель без цен — «стоимость неизвестна», пустые данные —
// честный ноль с подсказкой, у активного проекта в сайдбаре — «этот проект стоил X».
//
//   python -X utf8 tools/run_checks.py stats_page
// Итог: код возврата и последняя строка вывода — как у любой проверки
// (tests/lib/runner_lib.py). Страница интерфейса на фикстуре
// (src/fixtureStats.ts): `?состояние=проект` + клик по строке сайдбара,
// пустые данные — `?состояние=статистика-пусто`.
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
const ROW = '[data-testid="sidebar-stats"]';
const PAGE = '[data-testid="stats-page"]';
const TOTALS = '[data-testid="stats-totals"]';
const PROJECT_ROW = '[data-testid="stats-project-row"]';
const MODEL_ROW = '[data-testid="stats-model-row"]';

const text = async (page, selector) =>
  (await page.$eval(selector, (el) => el.textContent.replace(/\s+/g, " ").trim()));

/** Число из ячейки «950 000» → 950000 (разделители групп — не цифры). */
const digits = (value) => Number(value.replace(/\D/g, ""));

/** Деньги ячейки «$1.61» → 1.61; «стоимость неизвестна» → null. */
const money = (value) => (value.includes("неизвестна") ? null : Number(value.replace(/[^\d.]/g, "")));

/** Время «2 мин 45 с» / «1 ч 03 мин» → миллисекунды. */
const ms = (value) => {
  const hours = /(\d+)\s*ч\b/.exec(value);
  const minutes = /(\d+)\s*мин/.exec(value);
  const seconds = /(\d+)\s*с/.exec(value);
  return (hours ? +hours[1] * 3_600_000 : 0) + (minutes ? +minutes[1] * 60_000 : 0) +
    (seconds ? +seconds[1] * 1_000 : 0);
};

const cell = (row, name) =>
  row.$eval(`.stats-page__num--${name}`, (el) => el.textContent.replace(/\s+/g, " ").trim());

/** Строка деления → токены, деньги и время её ячеек. */
const groupOfRow = async (row) => ({
  tokens: digits(await cell(row, "tokens")),
  cost: money(await cell(row, "money")),
  time: ms(await cell(row, "time")),
});

const periodTotals = async (page) => ({
  tokens: digits(await text(page, `${TOTALS} .stats-page__total--tokens .stats-page__total-value`)),
  cost: money(await text(page, `${TOTALS} .stats-page__total--money .stats-page__total-value`)),
  time: ms(await text(page, `${TOTALS} .stats-page__total--time .stats-page__total-value`)),
});

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: WIDE });
    await page.goto(`${url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // а) В сайдбаре строка «Статистика»: клик открывает раздел ---------------
    try {
      await page.waitForSelector(ROW, { timeout: 5000 });
    } catch {
      done(1, `в сайдбаре нет строки «Статистика»: нет [data-testid="sidebar-stats"]`);
    }
    await page.click(ROW);
    try {
      await page.waitForSelector(PAGE, { timeout: 5000 });
    } catch {
      done(1, `строка «Статистика» есть, но раздел не открылся: нет [data-testid="stats-page"]`);
    }

    // б) Периоды 7 / 30 / всё переключаются: числа растут вместе с периодом ---
    await page.click('[data-testid="stats-period-7"]');
    const seven = await periodTotals(page);
    await page.click('[data-testid="stats-period-30"]');
    const thirty = await periodTotals(page);
    await page.click('[data-testid="stats-period-all"]');
    const all = await periodTotals(page);
    if (!(seven.tokens < thirty.tokens && thirty.tokens < all.tokens)) {
      done(1, `периоды не растут 7 → 30 → всё: токены ${seven.tokens} / ${thirty.tokens} / ${all.tokens}`);
    }

    // в) Цифры сходятся: сумма строк деления равна итогу ----------------------
    const converge = async (selector, label) => {
      const rows = await page.$$(selector);
      if (!rows.length) {
        done(1, `в делении «${label}» нет строк — сводка пустая при данных`);
      }
      let tokens = 0;
      let cost = 0;
      let time = 0;
      for (const row of rows) {
        const one = await groupOfRow(row);
        tokens += one.tokens;
        time += one.time;
        if (one.cost !== null) {
          cost += one.cost;
        }
      }
      const totals = await periodTotals(page);
      if (tokens !== totals.tokens) {
        done(1, `«${label}»: сумма токенов строк ${tokens} ≠ итогу ${totals.tokens}`);
      }
      if (totals.cost === null || Math.abs(cost - totals.cost) > 0.005) {
        done(1, `«${label}»: сумма денег строк ${cost} ≠ итогу ${totals.cost}`);
      }
      if (time !== totals.time) {
        done(1, `«${label}»: сумма времени строк ${time} мс ≠ итогу ${totals.time} мс`);
      }
    };
    await converge(PROJECT_ROW, "по проектам");
    await converge(MODEL_ROW, "по моделям");

    // г) Модель без цен: токены считаются, деньги — «стоимость неизвестна» ----
    const models = await page.$$eval(MODEL_ROW, (els) =>
      els.map((el) => el.textContent.replace(/\s+/g, " ").trim()));
    const corp = models.find((one) => one.includes("corp-model-a"));
    if (!corp) {
      done(1, `в делении по моделям нет строки «corp-model-a»: есть ${models.join(" | ") || "ни одной"}`);
    }
    if (!corp.includes("стоимость неизвестна")) {
      done(1, `модель без цен не говорит «стоимость неизвестна»: «${corp}»`);
    }

    // д) Даты цен видны, когда цены применились -------------------------------
    const totalsText = await text(page, TOTALS);
    if (!/Цены от \d{1,2} \S+/.test(totalsText)) {
      done(1, `в итогах нет даты цен «Цены от …»: «${totalsText}»`);
    }
    // Пометка о моделях без цен у итога: в период «всё» есть неоценённая строка.
    if (!totalsText.includes("часть моделей без цен")) {
      done(1, `у итога нет пометки «часть моделей без цен»: «${totalsText}»`);
    }

    // е) «Этот проект стоил X» у проекта на экране -----------------------------
    const projectText = await text(page, `${PROJECT_ROW}[data-project$="GnomeCode"]`);
    if (!/Этот проект стоил \$\d/.test(projectText)) {
      done(1, `у проекта на экране статистики нет строки «Этот проект стоил X»: «${projectText}»`);
    }

    // ж) Пустые данные — честный ноль с подсказкой -----------------------------
    await page.goto(`${url}?состояние=статистика-пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await page.waitForSelector(PAGE, { timeout: 5000 });
    } catch {
      done(1, `состояние «статистика-пусто» не открыло раздел: нет [data-testid="stats-page"]`);
    }
    try {
      await page.waitForSelector('[data-testid="stats-empty"]', { timeout: 5000 });
    } catch {
      done(1, `пустые данные не показали подсказку: нет [data-testid="stats-empty"]`);
    }
    const empty = await periodTotals(page);
    if (empty.tokens !== 0 || empty.time !== 0 || empty.cost !== 0) {
      done(1, `пустые данные не честный ноль: токены ${empty.tokens}, деньги ${empty.cost}, время ${empty.time} мс`);
    }

    // з) У активного проекта в сайдбаре вторая линия «Этот проект стоил X» -----
    await page.goto(`${url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.click(ROW);
    await page.waitForSelector(PAGE, { timeout: 5000 });
    const sidebarProject = await text(page, '[data-testid="sidebar-project"]');
    if (!/Этот проект стоил \$\d/.test(sidebarProject)) {
      done(1, `у активного проекта в сайдбаре нет второй линии «Этот проект стоил X»: «${sidebarProject}»`);
    }

    done(
      0,
      "строка «Статистика» открывает раздел из сайдбара; периоды 7/30/всё переключаются и растут; суммы токенов, денег и времени строк по проектам и по моделям сходятся с итогом; модель без цен — «стоимость неизвестна» с посчитанными токенами; у итога видны дата цен и пометка «часть моделей без цен»; у проекта на экране и у активного проекта в сайдбаре — «Этот проект стоил X»; пустые данные — честный ноль с подсказкой",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий раздела «Статистика» упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  stop();
}
