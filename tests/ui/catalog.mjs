// Каталог «Available»: «+» → Connect plugin → Browse plugins… → поиск → Install →
// сводка прав → Allow → плагин подключён к текущему чату — без конфигов и перезапуска
// (docs/BATCH.md, пункт 1; docs/SPEC/plugins.md, сцены C и H).
//
//   python -X utf8 tools/run_checks.py catalog
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: вне окна интерфейс получает фикстуру
// (src/fixtureCatalog.ts, состояние `?состояние=каталог`).
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
/** Плагин каталога, который ставим: одна команда — одна кнопка. */
const ENTRY = "github";
const ENTRY_BUTTON = "issues";
const BROWSE = '[data-testid="browse-plugins"]';
const CATALOG = '[data-testid="catalog-picker"]';
const CARD = '[data-testid="catalog-card"]';
const SUMMARY = '[data-testid="plugin-summary"]';
const PICKER = '[data-testid="plugin-picker"]';
const CONNECT = "[data-testid=add-connect-plugin]";

/** Карточки каталога подряд: поиск видно по именам, а не по счётчику. */
const cards = (page) => page.$$eval(`${CATALOG} ${CARD}`, (els) => els.map((el) => el.getAttribute("data-plugin")));

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: WIDE });
    await page.goto(`${url}?состояние=каталог`, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // а) «+» → Connect plugin открывает список плагинов --------------------------------
    await page.click('[data-testid="composer-add"]');
    try {
      await page.waitForSelector(CONNECT, { timeout: 5000 });
    } catch {
      done(1, `клик по «+» в композере не открыл меню: на экране нет пункта ${CONNECT}`);
    }
    await page.click(CONNECT);
    try {
      await page.waitForSelector(PICKER, { timeout: 5000 });
    } catch {
      done(1, `пункт Connect plugin не открыл список плагинов: на экране нет ${PICKER}`);
    }

    // б) Browse plugins… открывает каталог ---------------------------------------------
    try {
      await page.waitForSelector(BROWSE, { timeout: 5000 });
    } catch {
      done(1, `внизу списка плагинов нет строки «Browse plugins…»: на экране нет ${BROWSE}`);
    }
    await page.click(BROWSE);
    try {
      await page.waitForSelector(CATALOG, { timeout: 5000 });
    } catch {
      done(1, "клик по «Browse plugins…» не открыл каталог: на экране нет [data-testid=catalog-picker]");
    }

    // в) Поиск по каталогу оставляет нужную карточку -----------------------------------
    try {
      await page.waitForSelector('[data-testid="catalog-search"]', { timeout: 5000 });
    } catch {
      done(1, "в каталоге нет поиска [data-testid=catalog-search] — найти плагин нечем");
    }
    await page.fill('[data-testid="catalog-search"]', "hub");
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid="catalog-picker"] [data-testid="catalog-card"]').length === 1,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, `поиск «hub» не оставил одну карточку: в каталоге ${(await cards(page)).length}`);
    }
    const [left] = await cards(page);
    if (left !== ENTRY) {
      done(1, `поиск «hub» оставил карточку «${left}», а не «${ENTRY}» — ищет не по тому полю`);
    }
    const cardText = await page.$eval(`${CATALOG} ${CARD}[data-plugin="${ENTRY}"]`, (el) => el.textContent.replace(/\s+/g, " ").trim());
    for (const part of ["GitHub", "1.4.2"]) {
      if (!cardText.includes(part)) {
        done(1, `в карточке «${ENTRY}» нет «${part}»: «${cardText}» — карточка без имени и версии`);
      }
    }

    // г) Install открывает сводку прав с категориями -----------------------------------
    await page.click(`${CATALOG} ${CARD}[data-plugin="${ENTRY}"] [data-testid="catalog-install"]`);
    try {
      await page.waitForSelector(SUMMARY, { timeout: 5000 });
    } catch {
      done(1, `клик по Install не открыл сводку прав: на экране нет [data-testid=plugin-summary]`);
    }
    const summary = await page.$eval(SUMMARY, (el) => el.textContent.replace(/\s+/g, " ").trim());
    for (const part of ["Network", "api.github.com", "Write", "ask"]) {
      if (!summary.includes(part)) {
        done(1, `в сводке прав нет категории/значения «${part}»: «${summary}»`);
      }
    }
    const answers = await page.$$eval(`${SUMMARY} button`, (els) => els.map((el) => el.textContent.trim()));
    for (const answer of ["Разрешить", "Отмена"]) {
      if (!answers.includes(answer)) {
        done(1, `в сводке прав нет ответа «${answer}»: кнопки — ${answers.join(", ") || "ни одной"}`);
      }
    }
    if (answers.some((answer) => answer.toLowerCase().includes("customize"))) {
      done(1, "в сводке прав есть Customize — его в этом пункте нет, только Allow/Cancel");
    }

    // д) Отмена ничего не ставит и не подключает --------------------------------------
    await page.click('[data-testid="summary-cancel"]');
    try {
      await page.waitForSelector(SUMMARY, { timeout: 5000 });
      done(1, "окно сводки после «Отмена» осталось открытым — решение принято, окно должно уйти");
    } catch {
      // Окно ушло — так и должно быть.
    }
    if ((await page.$$eval('[data-testid="plugin-button"]', (els) => els.length)) !== 0) {
      done(1, "после «Отмена» в шапке есть кнопки плагина — установка прошла без разрешения");
    }

    // е) Allow: установка без конфигов и перезапуска, кнопки в шапке -------------------
    await page.click(`${CATALOG} ${CARD}[data-plugin="${ENTRY}"] [data-testid="catalog-install"]`);
    await page.waitForSelector(SUMMARY, { timeout: 5000 });
    await page.click('[data-testid="summary-allow"]');
    try {
      await page.waitForSelector(`[data-testid="plugin-button"][data-plugin="${ENTRY}"]`, { timeout: 5000 });
    } catch {
      const got = await page.$$eval('[data-testid="plugin-button"]', (els) =>
        els.map((el) => `${el.getAttribute("data-plugin")}:${el.textContent.trim()}`),
      );
      done(1, `после «Разрешить» в шапке нет кнопки плагина «${ENTRY}» — кнопки: ${JSON.stringify(got)}`);
    }
    const button = await page.$eval(`[data-testid="plugin-button"][data-plugin="${ENTRY}"]`, (el) => el.textContent.trim());
    if (button !== ENTRY_BUTTON) {
      done(1, `на кнопке плагина «${ENTRY}» написано «${button}», а команда «${ENTRY_BUTTON}»`);
    }
    for (const overlay of [SUMMARY, CATALOG, PICKER]) {
      if (await page.isVisible(overlay)) {
        done(1, `после установки окно ${overlay} не закрылось — сценарий разговора не возвращён владельцу`);
      }
    }

    // ж) Установленный плагин виден в списке установленных ----------------------------
    await page.click('[data-testid="composer-add"]');
    await page.click(CONNECT);
    await page.waitForSelector(PICKER, { timeout: 5000 });
    const installed = await page.$$eval(`${PICKER} [data-testid="plugin-row"]`, (els) =>
      els.map((el) => el.getAttribute("data-plugin")),
    );
    if (!installed.includes(ENTRY)) {
      done(1, `установленный «${ENTRY}» не появился в списке установленных: есть ${installed.join(", ") || "ни одного"}`);
    }

    done(
      0,
      `«+» → Connect plugin → Browse plugins… открывает каталог с поиском и карточками (имя, версия), Install открывает сводку прав с категориями и кнопками Разрешить/Отмена без Customize, «Отмена» ничего не ставит, «Разрешить» ставит плагин и подключает его к текущему чату кнопкой команды в шапке, окно каталога закрывается, плагин виден среди установленных`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий каталога упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
