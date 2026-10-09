// Окно без рамки — своя шапка (docs/ROADMAP.md, «Окно без рамки: своя шапка»):
// свернуть/развернуть/закрыть — один набор на экране, кластер «тема + кнопки»
// в правом краю окна: единственный дом — шапка чата на любой ширине («тихий
// хром», §4); страницы «Плагины» и «Настройки» своих копий не рисуют. Верхние
// полосы размечены зоной перетаскивания (data-tauri-drag-region), клики по
// кнопкам уходят мосту окна.
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

    // а) Кнопки окна стоят в правом краю окна: их единственный дом — шапка чата
    //    на любой ширине («тихий хром», §4; замечание владельца: «кнопки свернуть,
    //    тема и т.д. должны быть справа») ------------------------------------------
    const HEADER = '[data-testid="chat-header"]';
    const CLUSTER = `${HEADER} [data-testid="window-cluster"]`;
    for (const [testid, name] of [[MIN, "свернуть"], [MAX, "развернуть"], [CLOSE, "закрыть"]]) {
      let there = false;
      try {
        there = Boolean(await page.waitForSelector(`${HEADER} ${testid}`, { timeout: 5000 }));
      } catch {
        // ниже общая строка провала
      }
      if (!there) {
        done(1, `в правом краю окна (шапка чата) нет кнопки окна «${name}»: не появился [data-testid] из ${BUTTONS}`);
      }
    }
    try {
      await page.waitForSelector(`${CLUSTER} [data-testid="theme-switch"]`, { timeout: 5000 });
    } catch {
      done(1, "переключателя темы нет в шапке чата рядом с кнопками окна: кластер разрознен");
    }
    // Кластер один: «доп пустой блок» с дублем кнопок не возвращается.
    const clusters = await page.$$eval('[data-testid="window-cluster"]', (els) => els.length);
    if (clusters !== 1) {
      done(1, `кластер кнопок окна на экране ${clusters} раз, а не один — у кнопок окна два дома сразу`);
    }
    for (const [testid, name] of [[MIN, "свернуть"], [MAX, "развернуть"], [CLOSE, "закрыть"]]) {
      await hitOwn(page, `${HEADER} ${testid}`, `кнопка окна «${name}» в шапке чата`);
    }

    // б) Клик по каждой кнопке уходит мосту: фикстура записывает вызовы -----------
    await page.click(`${HEADER} ${MIN}`);
    await page.click(`${HEADER} ${MAX}`);
    await page.click(`${HEADER} ${CLOSE}`);
    const calls = await page.evaluate(() => window.__windowCalls ?? []);
    if (JSON.stringify(calls) !== JSON.stringify(["minimize", "maximize", "close"])) {
      done(1, `клики по кнопкам окна не дошли мосту: window.__windowCalls = ${JSON.stringify(calls)}`);
    }
    if (!(await page.$(`${HEADER} ${MIN}`)) || !(await page.$(`${HEADER} ${MAX}`))) {
      done(1, "после кликов кнопки окна пропали — окно закрылось на странице вместо записи вызова");
    }

    // в) Верхние полосы — зоны перетаскивания: шапка чата и шапка правой панели ---
    if (!(await page.$eval('[data-testid="chat-header"]', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("chat-header"));
    }
    // Шапка панели существует, пока панель открыта: открываем из меню «⋯» («тихий хром», §6).
    await page.click('[data-testid="header-more"]');
    await page.click('[data-testid="menu-context"]');
    await page.waitForSelector('[data-testid="context-panel"]', { timeout: 5000 });
    if (!(await page.$eval('[data-testid="context-panel"] .context__header', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("context__header"));
    }
    // Кнопки не наследуют зону перетаскивания: клик по ним — действие, не перенос окна.
    if (await page.$eval(`${CLUSTER}`, (el) => el.querySelectorAll("button[data-tauri-drag-region]").length > 0)) {
      done(1, "кнопка окна внутри кластера несёт data-tauri-drag-region — клик по ней перетащил бы окно вместо действия");
    }

    // г) Узкое окно (правая панель складывается): кластер возвращается в шапку чата
    const narrow = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await narrow.goto(`${iface.url}?состояние=`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await narrow.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
    for (const [testid, name] of [[MIN, "свернуть"], [MAX, "развернуть"], [CLOSE, "закрыть"]]) {
      let there = false;
      try {
        there = Boolean(await narrow.waitForSelector(`[data-testid="chat-header"] ${testid}`, { timeout: 5000 }));
      } catch {
        // ниже общая строка провала
      }
      if (!there) {
        done(1, `при узком окне в шапке чата нет кнопки окна «${name}»: не появился [data-testid] из ${BUTTONS}`);
      }
    }
    try {
      await narrow.waitForSelector('[data-testid="chat-header"] [data-testid="theme-switch"]', { timeout: 5000 });
    } catch {
      done(1, "при узком окне переключателя темы нет в шапке чата рядом с кнопками окна");
    }
    await narrow.click(`[data-testid="chat-header"] ${MIN}`);
    await narrow.click(`[data-testid="chat-header"] ${MAX}`);
    await narrow.click(`[data-testid="chat-header"] ${CLOSE}`);
    const narrowCalls = await narrow.evaluate(() => window.__windowCalls ?? []);
    if (JSON.stringify(narrowCalls) !== JSON.stringify(["minimize", "maximize", "close"])) {
      done(1, `при узком окне клики по кнопкам не дошли мосту: window.__windowCalls = ${JSON.stringify(narrowCalls)}`);
    }
    await narrow.close();

    // д) Страница «Плагины»: своих кнопок окна нет; единственный дом кластера —
    //    шапка чата, на страницах он не монтируется; полоса страницы — перетаскивание -
    await page.goto(`${iface.url}?состояние=плагины-раздел`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="plugins-page"]', { timeout: 90_000 });
    const pluginsOwn = await page.$$eval(
      '[data-testid="plugins-page"] [data-testid="window-buttons"]',
      (els) => els.length,
    );
    if (pluginsOwn !== 0) {
      done(1, `на странице «Плагины» своя копия кнопок окна (${pluginsOwn} набор поверх кластера шапки) — у экрана два набора`);
    }
    const pluginsSets = await page.$$eval('[data-testid="window-buttons"]', (els) => els.length);
    if (pluginsSets !== 0) {
      done(1, `на «Плагинах» наборов кнопок окна ${pluginsSets}, а не ноль: единственный дом кластера — шапка чата, у страниц своего нет`);
    }
    if (!(await page.$eval('[data-testid="plugins-page"] .plugins-page__head', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("plugins-page__head"));
    }
    for (const tab of ["installed", "available", "updates", "disabled"]) {
      await hitOwn(page, `[data-testid="plugin-tab-${tab}"]`, `вкладка «${tab}» страницы «Плагины»`);
    }

    // е) Страница «Настройки»: своих кнопок окна нет — тот же единственный дом
    //    (шапка чата) на страницах не монтируется; полоса страницы — перетаскивание -
    await page.goto(`${iface.url}?состояние=настройки`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="settings-page"]', { timeout: 90_000 });
    const settingsOwn = await page.$$eval(
      '[data-testid="settings-page"] [data-testid="window-buttons"]',
      (els) => els.length,
    );
    if (settingsOwn !== 0) {
      done(1, `на странице «Настройки» своя копия кнопок окна (${settingsOwn} набор поверх кластера шапки) — у экрана два набора`);
    }
    const settingsSets = await page.$$eval('[data-testid="window-buttons"]', (els) => els.length);
    if (settingsSets !== 0) {
      done(1, `на «Настройках» наборов кнопок окна ${settingsSets}, а не ноль: единственный дом кластера — шапка чата, у страниц своего нет`);
    }
    if (!(await page.$eval('[data-testid="settings-page"] .settings-page__head', (el) => el.hasAttribute("data-tauri-drag-region")))) {
      done(1, DRAG("settings-page__head"));
    }

    // ж) Тело страницы не наезжает на вкладки: голова растянута полосой титула
    //    и вкладками, фиксированных 48 px больше нет -----------------------------
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

    // з) Панель сравнения не накрывает вкладки: при открытой панели вкладка
    //    остаётся нажимаемой, панель начинается под головой страницы ------------
    await page.click('[data-testid="settings-tab-модели"]');
    await page.click('[data-testid="settings-open-compare"]');
    await page.waitForSelector('[data-testid="compare-panel"]', { timeout: 5000 });
    await hitOwn(page, '[data-testid="settings-tab-плагины"]', "вкладка «плагины» при открытой панели сравнения");
    await page.click('[data-testid="compare-close"]');
    await page.waitForFunction(() => !document.querySelector('[data-testid="compare-panel"]'), undefined, { timeout: 5000 });

    // и) Узкое окно на страницах: кластер живёт в шапке чата (см. г), на страницах
    //    кнопок окна нет вовсе; их полосы остаются зонами перетаскивания ----------
    const narrowPage = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    for (const [state, marker, head] of [
      ["настройки", '[data-testid="settings-page"]', ".settings-page__head"],
      ["плагины-раздел", '[data-testid="plugins-page"]', ".plugins-page__head"],
    ]) {
      await narrowPage.goto(`${iface.url}?состояние=${state}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await narrowPage.waitForSelector(marker, { timeout: 90_000 });
      const sets = await narrowPage.$$eval('[data-testid="window-buttons"]', (els) => els.length);
      if (sets !== 0) {
        done(1, `при узком окне на странице «${state}» ${sets} набор(а) кнопок окна — кластер живёт в шапке чата, страницам свои копии не нужны`);
      }
      if (!(await narrowPage.$eval(`${marker} ${head}`, (el) => el.hasAttribute("data-tauri-drag-region")))) {
        done(1, DRAG(head));
      }
    }
    await narrowPage.close();

    await done(
      0,
      `окно без рамки: свернуть/развернуть/закрыть и тема — один кластер в шапке чата на любой ширине и уходят мосту (${calls.length} вызова); у страниц «Плагины» и «Настройки» своих копий нет, там кластера нет вовсе — единственный дом кнопок, шапка чата, на страницах не монтируется; верхние полосы чата, правой панели, «Плагинов» и «Настроек» размечены data-tauri-drag-region — перетаскивание за шапку; кластер кнопок один, вкладки страниц и кнопки шапок не накрыты`,
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
