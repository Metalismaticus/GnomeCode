// Окно без рамки — своя шапка (docs/ROADMAP.md, «Окно без рамки: своя шапка»):
// кнопки свернуть/развернуть/закрыть стоят в шапке чата и в верхних полосах
// страниц «Плагины» и «Настройки», верхние полосы размечены зоной перетаскивания
// (data-tauri-drag-region), клики по кнопкам уходят мосту окна.
//
//   node tests/ui/frameless.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Системную рамку, перетаскивание и ресайз за края страница не показывает — это
// живой шаг владельца; сценарий стережёт кнопки, разметку и мост (фикстура
// записывает вызовы в window.__windowCalls — реального окна на странице нет).
import { done, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const MIN = '[data-testid="window-minimize"]';
const MAX = '[data-testid="window-maximize"]';
const CLOSE = '[data-testid="window-close"]';
const BUTTONS = '"window-minimize", "window-maximize", "window-close"';
const DRAG = (testid) =>
  `зоны перетаскивания нет на «${testid}»: у шапки нет атрибута data-tauri-drag-region`;

/** Элемент в своей центральной точке должен быть им самим или потомком:
 *  кто-то другой на этом месте — наездка, клик по нему не проходит. */
const hitOwn = (page, sel, label) =>
  page
    .$eval(sel, (el) => {
      const r = el.getBoundingClientRect();
      const at = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return at && at !== el && !el.contains(at)
        ? `${at.tagName.toLowerCase()}.${String(at.className).split(" ")[0]}`
        : "";
    })
    .then((who) => {
      if (who) {
        done(1, `«${label}» накрыт ${who} — клик по нему не проходит`);
      }
    });

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "");
  try {

    // а) Кнопки окна стоят в шапке чата ------------------------------------------
    for (const [testid, name] of [[MIN, "свернуть"], [MAX, "развернуть"], [CLOSE, "закрыть"]]) {
      let there = false;
      try {
        there = Boolean(await page.waitForSelector(`[data-testid="chat-header"] ${testid}`, { timeout: 5000 }));
      } catch {
        // ниже общая строка провала
      }
      if (!there) {
        done(1, `в шапке чата нет кнопки окна «${name}»: не появился [data-testid] из ${BUTTONS}`);
      }
    }
    // Кнопки окна и кнопки подключённых плагинов делят полосу чата — друг друга
    // не накрывают: у каждой своя точка клика.
    for (const [testid, name] of [[MIN, "свернуть"], [MAX, "развернуть"], [CLOSE, "закрыть"]]) {
      await hitOwn(page, `[data-testid="chat-header"] ${testid}`, `кнопка окна «${name}» в шапке чата`);
    }
    if (await page.$('[data-testid="chat-header"] [data-testid="plugin-button"]')) {
      await hitOwn(page, '[data-testid="chat-header"] [data-testid="plugin-button"]', "кнопка команды плагина в шапке чата");
    }

    // б) Клик по каждой кнопке уходит мосту: фикстура записывает вызовы -----------
    await page.click(MIN);
    await page.click(MAX);
    await page.click(CLOSE);
    const calls = await page.evaluate(() => window.__windowCalls ?? []);
    if (JSON.stringify(calls) !== JSON.stringify(["minimize", "maximize", "close"])) {
      done(1, `клики по кнопкам окна не дошли мосту: window.__windowCalls = ${JSON.stringify(calls)}`);
    }
    if (!(await page.$(MIN)) || !(await page.$(MAX))) {
      done(1, "после кликов кнопки окна пропали — окно закрылось на странице вместо записи вызова");
    }

    // в) Шапка чата — зона перетаскивания ----------------------------------------
    if (!(await page.$eval('[data-testid="chat-header"]', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("chat-header"));
    }

    // г) Страница «Плагины»: своя кнопка закрытия и зона перетаскивания -----------
    await page.goto(`${iface.url}?состояние=плагины-раздел`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="plugins-page"]', { timeout: 90_000 });
    try {
      await page.waitForSelector(`[data-testid="plugins-page"] ${CLOSE}`, { timeout: 5000 });
    } catch {
      done(1, `на странице «Плагины» нет кнопки окна: не появился [data-testid] из ${BUTTONS}`);
    }
    await page.click(`[data-testid="plugins-page"] ${CLOSE}`);
    const pluginsClose = await page.evaluate(() => window.__windowCalls ?? []);
    if (!pluginsClose.includes("close")) {
      done(1, `кнопка закрытия страницы «Плагины» не ушла мосту: window.__windowCalls = ${JSON.stringify(pluginsClose)}`);
    }
    if (!(await page.$eval('[data-testid="plugins-page"] .plugins-page__head', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("plugins-page__head"));
    }
    for (const tab of ["installed", "available", "updates", "disabled"]) {
      await hitOwn(page, `[data-testid="plugin-tab-${tab}"]`, `вкладка «${tab}» страницы «Плагины»`);
    }

    // д) Страница «Настройки»: своя кнопка закрытия и зона перетаскивания ---------
    await page.goto(`${iface.url}?состояние=настройки`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="settings-page"]', { timeout: 90_000 });
    try {
      await page.waitForSelector(`[data-testid="settings-page"] ${CLOSE}`, { timeout: 5000 });
    } catch {
      done(1, `на странице «Настройки» нет кнопки окна: не появился [data-testid] из ${BUTTONS}`);
    }
    await page.click(CLOSE);
    const settingsClose = await page.evaluate(() => window.__windowCalls ?? []);
    if (!settingsClose.includes("close")) {
      done(1, `кнопка закрытия страницы «Настройки» не ушла мосту: window.__windowCalls = ${JSON.stringify(settingsClose)}`);
    }
    if (!(await page.$eval('[data-testid="settings-page"] .settings-page__head', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("settings-page__head"));
    }

    // е) Тело страницы не наезжает на вкладки: голова растянута верхней полосой
    //    окна (титул + кнопки окна), фиксированных 48 px больше нет -------------
    const gap = await page.$eval('[data-testid="settings-page"]', (root) => {
      const tabs = root.querySelector(".settings-page__tabs").getBoundingClientRect();
      const body = root.querySelector(".settings-page__body").getBoundingClientRect();
      return Math.round(body.top - tabs.bottom);
    });
    if (gap < 0) {
      done(1, `тело страницы «Настройки» наезжает на вкладки на ${-gap} px — вкладки под скролл-областью, клик по ним не проходит`);
    }
    for (const tab of ["вид", "модели", "плагины", "данные"]) {
      await hitOwn(page, `[data-testid="settings-tab-${tab}"]`, `вкладка «${tab}» страницы «Настройки»`);
    }

    // ж) Панель сравнения не накрывает вкладки: при открытой панели вкладка
    //    остаётся нажимаемой, панель начинается под головой страницы ------------
    await page.click('[data-testid="settings-tab-модели"]');
    await page.click('[data-testid="settings-open-compare"]');
    await page.waitForSelector('[data-testid="compare-panel"]', { timeout: 5000 });
    await hitOwn(page, '[data-testid="settings-tab-плагины"]', "вкладка «плагины» при открытой панели сравнения");
    await page.click('[data-testid="compare-close"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="compare-panel"]'), undefined, { timeout: 5000 });

    await done(
      0,
      `окно без рамки: кнопки свернуть/развернуть/закрыть в шапке чата уходят мосту (${calls.length} вызова) и стоят на страницах «Плагины» и «Настройки»; верхние полосы чата, «Плагины» и «Настройки» размечены data-tauri-drag-region — перетаскивание за шапку; вкладки страниц и кнопки шапок не накрыты телом страниц и панелью сравнения`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий окна без рамки упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
