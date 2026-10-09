// Панель «Сравнение моделей» читает каталог ровно один раз на открытие
// (docs/BATCH.md, пункт 1, замечание проверяющего круга 2): цикл перечитывания
// виден только на задержке моста — мгновенный ответ фикстуры батчится до
// коммита и проверку не проходит (замер проверяющего: 154 переворота
// «Обновить» за 5 с при invoke ~60 мс, в конце кнопка выключена).
//
//   python -X utf8 tools/run_checks.py compare_read_once
// Итог: код возврата и последняя строка вывода (tests/lib/runner_lib.py).
// Мост-фикстура считает чтения в window.__compareListCalls (src/bridge/fixture.ts),
// состояние `?состояние=сравнение-медленно` отвечает через ~60 мс, как живой
// invoke. Счётчик общий на страницу (пустой чат за панелью читает свой каталог
// тем же хуком), поэтому утверждения — о темпе: пока панель открыта, счётчик
// стоит; повторное открытие добавляет ровно одно чтение.
import { done, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const PANEL = '[data-testid="compare-panel"]';
const BADGE = '[data-testid="model-badge"]';
const REFRESH = '[data-testid="compare-refresh"]';

const reads = (page) => page.evaluate(() => window.__compareListCalls ?? 0);
const refreshEnabled = (page) => page.$eval(REFRESH, (el) => !el.disabled);

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "сравнение-медленно");
  try {

    // а) Панель открылась с адреса, каталог дочитался, «Обновить» живая ----------
    try {
      await page.waitForSelector(PANEL, { timeout: 15000 });
    } catch {
      done(1, "состояние «сравнение-медленно» не открыло панель сравнения: нет [data-testid=compare-panel]");
    }
    try {
      await page.waitForSelector('[data-testid="compare-date"]', { timeout: 15000 });
    } catch {
      done(1, "каталог не дочитался за 15 с: нет [data-testid=compare-date] — задержка моста не кончается");
    }
    if (!(await refreshEnabled(page))) {
      done(1, "после загрузки «Обновить» осталась выключенной — панель вечно «обновляется»");
    }

    // б) Панель открыта — счётчик стоит: цикл перечитывания растёт без конца -----
    const before = await reads(page);
    // 900 мс — больше десятка циклов цикла-бага (invoke ~60 мс): рост виден наверняка.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const quiet = await reads(page);
    if (quiet !== before) {
      done(1, `пока панель открыта, каталог дочитан ${quiet - before} раз за 0,9 с — цикл: invoke + чтение файла + запросы движку без конца`);
    }

    // в) Закрыли и открыли снова — ровно одно чтение на открытие -----------------
    await page.click('[data-testid="compare-close"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );
    await page.click(BADGE);
    // Чтение едет ~60 мс: «Обновить» гаснет на время запроса и оживает после.
    try {
      await page.waitForFunction(
        (sel) => document.querySelector(sel)?.disabled === true,
        REFRESH,
        { timeout: 5000 },
      );
    } catch {
      done(1, "повторное открытие не начало чтение: «Обновить» не погасла — каталог не перечитывается на открытие");
    }
    try {
      await page.waitForFunction(
        (sel) => document.querySelector(sel)?.disabled === false,
        REFRESH,
        { timeout: 5000 },
      );
    } catch {
      done(1, "чтение повторного открытия не кончилось за 5 с: «Обновить» осталась выключенной");
    }
    const reopened = await reads(page);
    if (reopened !== quiet + 1) {
      done(1, `повторное открытие добавило ${reopened - quiet} чтений вместо одного`);
    }
    await new Promise((resolve) => setTimeout(resolve, 600));
    const settled = await reads(page);
    if (settled !== reopened) {
      done(1, `после повторного открытия каталог дочитан ${settled - reopened} раз — цикл вернулся`);
    }

    await done(
      0,
      `пока панель открыта, счётчик чтений каталога стоит; повторное открытие добавило ровно одно чтение (было ${quiet}, стало ${reopened}); «Обновить» после загрузки живая`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий темпа чтения сравнения упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
