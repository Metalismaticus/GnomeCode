// Раскладка главного окна и две темы — числами, не глазами на снимке: ширины колонок
// читаются из getBoundingClientRect, акцентные пятна считаются по вычисленному
// background-image, темы сравниваются до/после переключения. Снимок судит владелец,
// числа стережёт регресс (docs/specs/2026-10-05-4-glavnoe-okno.md, «По чему судить снимок»).
//
//   node tests/ui/window_look.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixture.ts, параметры адреса — src/viewparams.ts).
import { chromium } from "@playwright/test";

import { attachAllFixtureFiles, closeMore, done, openContextPanel, openMore, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
const NARROW = { width: 1024, height: 640 };
const SIDEBAR_W = 240;
const SIDEBAR_NARROW_W = 200;
const CONTEXT_W = 280;
const EMPTY_TITLE_PX = 22;
const CENTER_TOLERANCE = 4;
/** Сборка стоит вверху прокручиваемой ленты: паддинг ленты 24 px — запас на него. */
const TOP_TOLERANCE = 30;
const FOCUS_RING_PX = "2px";

/** Ширина элемента по странице: null — элемента в кадре нет.
 *  Селекторы — классы колонок: ими меряется сама раскладка, а не разметка проверки. */
const widthOf = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect().width : null;
  }, selector);

/** Элементы с акцент-градиентом на экране: «акцентных пятен ровно два» — измеримое утверждение.
 *  Скрытые элементы («↑» на пустом поле невидима, место её зарезервировано) пятном не счёт —
 *  владелец их не видит («тихий хром», §7). */
const gradientSpots = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll("*"))
      .filter((el) => getComputedStyle(el).backgroundImage.includes("gradient"))
      .filter((el) => getComputedStyle(el).visibility !== "hidden")
      .map((el) => el.getAttribute("data-testid") || el.className || el.tagName),
  );

/** Вычисленные цвета тумблера строки правой панели: дорожка — фон кнопки,
 *  ручка — её кружок; фон панели рядом, с тем же разбором. Числа, не глаза:
 *  ручку/дорожку на тёмной теме владелец назвал «ползунок белый» — меряется
 *  максимумом канала (255 — чистый белый, 210 — порог «не белая»). */
const switchColors = (page, testid) =>
  page.evaluate((id) => {
    const parse = (value) =>
      value.match(/\d+/g)?.slice(0, 3).map(Number) ?? null;
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!button) return null;
    const knob = button.querySelector(".context-row__knob");
    const panel = document.querySelector(".context");
    return {
      knob: knob ? parse(getComputedStyle(knob).backgroundColor) : null,
      track: parse(getComputedStyle(button).backgroundColor),
      panel: parse(getComputedStyle(panel).backgroundColor),
    };
  }, testid);

/** Максимум канала цвета: у белого — 255. */
const brightest = (components) => (components ? Math.max(...components) : -1);

/** Наибольшая разность каналов двух цветов: рядом тона дают малую разность. */
const channelGap = (one, other) =>
  one && other ? Math.max(...one.map((value, i) => Math.abs(value - other[i]))) : -1;

const SWITCH_IDS = ["context-toggle-fs", "context-toggle-net"];

/** Что лежит сверху в центре элемента: сам элемент, его класс или перекрывший его слой.
 *  Оверлей правой панели перехватывает клик раньше шапки — этим меряется доступность «⋯»
 *  и переключателя темы при открытой панели. */
const topmostAt = (page, selector) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "нет элемента";
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!hit) return "ничего";
    return hit.getAttribute("data-testid") || hit.className || hit.tagName;
  }, selector);

/** Якорь смонтированной страницы с одним повтором: после domcontentloaded vite мог
 *  уйти в собственную перезагрузку на оптимизации зависимостей и страница так и не
 *  смонтировалась (полная группа 2026-10-07 — 90 с ожидания впустую). Повтор не трогает
 *  утверждений: ширины и цвета читаются после, честно красное остаётся красным. */
const waitReady = async (page, selector) => {
  try {
    await page.waitForSelector(selector, { timeout: 45_000 });
  } catch {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector(selector, { timeout: 90_000 });
  }
};

const measure = (page) =>
  page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    return {
      sidebar: box(".sidebar"),
      chat: box(".chat"),
      context: box(".context"),
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      contextBackground: document.querySelector(".context")
        ? getComputedStyle(document.querySelector(".context")).backgroundColor
        : "",
      titleFontSize: document.querySelector('[data-testid="chat-title"]')
        ? getComputedStyle(document.querySelector('[data-testid="chat-title"]')).fontSize
        : "",
      bodyFontSize: getComputedStyle(document.body).fontSize,
      theme: document.documentElement.dataset.theme || "",
    };
  });

/** Кольцо фокуса с клавиатуры: обводка 2 px (docs/DESIGN.md, раздел 6). */
const focusRing = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const style = getComputedStyle(el);
    return { testid: el.getAttribute("data-testid"), cls: el.className, width: style.outlineWidth };
  });

/** Прокрутить клавиатурой до элемента: Tab по порядку обхода, как у владельца. */
const tabUntil = async (page, testid, steps = 20) => {
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press("Tab");
    const hit = await page.evaluate(
      (id) => document.activeElement?.getAttribute("data-testid") === id,
      testid,
    );
    if (hit) return true;
  }
  return false;
};

/** Строка чипов контекста над полем ввода: сколько чипов, ширины строки и её
 *  переполнение, стиль прокрутки и верхние кромки чипов — одна линия означает
 *  одинаковые кромки (перенос дал бы вторую линию с другим верхом). */
const chipLine = (page) =>
  page.evaluate(() => {
    const row = document.querySelector(".chips");
    if (!row) return null;
    const chips = [...document.querySelectorAll('[data-testid="context-chip"]')];
    return {
      count: chips.length,
      clientWidth: row.clientWidth,
      scrollWidth: row.scrollWidth,
      overflowX: getComputedStyle(row).overflowX,
      tops: chips.map((chip) => Math.round(chip.getBoundingClientRect().top)),
    };
  });

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    // --- 1440×900: сайдбар и центр, панель скрыта по умолчанию («тихий хром», §6) ------
    const wide = await browser.newPage({ viewport: WIDE });
    // domcontentloaded, а не networkidle, и запас (ловушка TESTING): networkidle на
    // медленном старте vite не дожидался страницы; ширины читает evaluate — auto-wait
    // его не ждёт, поэтому колонки дожидаемся явно.
    await wide.goto(`${url}?состояние=много`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitReady(wide, '[data-testid="chat-header"]');
    const wideSidebar = await widthOf(wide, ".sidebar");
    if (wideSidebar !== SIDEBAR_W) {
      done(1, `сайдбар при 1440×900 — ${wideSidebar} px, а не ${SIDEBAR_W} px`);
    }
    const defaultPanel = await widthOf(wide, ".context");
    if (defaultPanel !== null) {
      done(1, `правая панель видна при 1440×900 без запроса (${defaultPanel} px) — по умолчанию она скрыта на любой ширине`);
    }

    // --- Акцентные пятна — по составу образца: CTA, активный чат, бейдж модели --------
    // («↑» на пустом поле не видна — местом зарезервирована, пятном не счёт, §7) --------
    const SPOTS = ["btn-primary", "chat-active", "model-badge"];
    const spots = await gradientSpots(wide);
    if (spots.length !== SPOTS.length) {
      done(1, `в кадре 1440×900 акцентных пятен ${spots.length}, а не ${SPOTS.length} (${spots.join(", ")})`);
    }
    for (const part of SPOTS) {
      if (!spots.some((name) => String(name).includes(part))) {
        done(1, `в кадре 1440×900 нет «${part}» среди акцентных пятен (${spots.join(", ")})`);
      }
    }

    // Панель открывается из меню «⋯» — оверлеем на любой ширине («тихий хром», §6).
    await openContextPanel(wide);

    // --- Тёмная тема: ручка тумблера не белая, различима с дорожкой и панелью -------
    // Замечание владельца 2026-10-06, живая копия 21:46: «ползунок белый на темной
    // теме» — ручка выключенного тумблера --on-accent читалась как белый ползунок.
    for (const id of SWITCH_IDS) {
      const colors = await switchColors(wide, id);
      if (!colors || !colors.knob || !colors.track) {
        done(1, `в правой панели нет тумблера ${id} — цвета нечему мерить`);
      }
      if (brightest(colors.knob) >= 210) {
        done(1, `на тёмной теме ручка выключенного ${id} светла (максимум канала ${brightest(colors.knob)} ≥ 210) — владелец читал её «ползунок белый»`);
      }
      const gap = channelGap(colors.knob, colors.track);
      if (gap < 40) {
        done(1, `на тёмной теме ручка ${id} не видна на дорожке (разность каналов ${gap} < 40)`);
      }
      if (brightest(colors.track) <= brightest(colors.panel)) {
        done(1, `дорожка ${id} не светлее фона панели (каналы ${colors.track} против панели ${colors.panel}) — тумблер теряется`);
      }
    }

    // --- Темы совпадают по раскладке и различаются по цвету ----------------------------
    const before = await measure(wide);
    // Кластер кнопок окна живёт в шапке чата — единственный дом («тихий хром», §4).
    // Клик по шапке панель закрывает (клик снаружи, §6) — после переключения панель
    // открывается из меню «⋯» снова: обе меры сняты с открытой панелью.
    await wide.click('[data-testid="chat-header"] [data-testid="theme-switch"]');
    try {
      await wide.waitForFunction(() => document.documentElement.dataset.theme === "light", undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "тема переключилась по кнопке, но <html> не получил data-theme=\"light\"");
    }
    await openContextPanel(wide);
    const after = await measure(wide);
    if (after.bodyBackground === before.bodyBackground) {
      done(1, `тема переключилась, а фон страницы не изменился: ${after.bodyBackground}`);
    }
    if (after.contextBackground === before.contextBackground) {
      done(1, `тема переключилась, а фон панели не изменился: ${after.contextBackground}`);
    }
    for (const key of ["sidebar", "chat", "context"]) {
      if (Math.abs(after[key].width - before[key].width) > 0.01) {
        done(
          1,
          `после переключения темы ширина ${key} стала ${after[key].width} px, была ${before[key].width} — раскладка поехала`,
        );
      }
    }
    if (after.titleFontSize !== before.titleFontSize || after.bodyFontSize !== before.bodyFontSize) {
      done(
        1,
        `после переключения темы размер шрифта стал ${after.titleFontSize}/${after.bodyFontSize}, был ${before.titleFontSize}/${before.bodyFontSize} — раскладка поехала`,
      );
    }

    // Светлая тема — пара к тёмной: ручка выключенного тумблера светлая (узнаётся,
    // не гаснет), дорожка темнее фона панели и различима с ручкой.
    for (const id of SWITCH_IDS) {
      const colors = await switchColors(wide, id);
      if (!colors || !colors.knob || !colors.track) {
        done(1, `в правой панели светлой темы нет тумблера ${id} — цвета нечему мерить`);
      }
      if (brightest(colors.knob) < 200) {
        done(1, `на светлой теме ручка выключенного ${id} погасла (максимум канала ${brightest(colors.knob)} < 200) — она должна читаться светлой`);
      }
      const gap = channelGap(colors.knob, colors.track);
      if (gap < 40) {
        done(1, `на светлой теме ручка ${id} не видна на дорожке (разность каналов ${gap} < 40)`);
      }
      if (brightest(colors.track) >= brightest(colors.panel)) {
        done(1, `дорожка ${id} светлой темы не темнее фона панели (каналы ${colors.track} против панели ${colors.panel}) — тумблер теряется`);
      }
    }

    // --- Фокус с клавиатуры: обводка 2 px у главной кнопки и у поля ввода -------------
    // Свежая страница: порядок обхода начинается с начала окна, а не с места последнего клика.
    const keys = await browser.newPage({ viewport: WIDE });
    await keys.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitReady(keys, '[data-testid="btn-primary"]');
    await keys.keyboard.press("Tab");
    const firstFocus = await focusRing(keys);
    if (!firstFocus || !String(firstFocus.cls).includes("primary")) {
      done(1, `первый Tab дал фокус не главной кнопке, а ${firstFocus ? firstFocus.cls : "ничему"} — порядок обхода нарушен`);
    }
    if (firstFocus.width !== FOCUS_RING_PX) {
      done(1, `у главной кнопки обводка фокуса ${firstFocus.width}, а не ${FOCUS_RING_PX}`);
    }
    if (!(await tabUntil(keys, "composer"))) {
      done(1, "клавиатурой не дошли до поля ввода — порядок обхода нарушен");
    }
    const inputFocus = await focusRing(keys);
    if (inputFocus.width !== FOCUS_RING_PX) {
      done(1, `у поля ввода обводка фокуса ${inputFocus.width}, а не ${FOCUS_RING_PX}`);
    }
    await keys.close();
    await wide.close();

    // --- 1024×640: сайдбар сужается, панель скрыта и открывается из меню «⋯» -----------
    const narrow = await browser.newPage({ viewport: NARROW });
    await narrow.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitReady(narrow, ".sidebar");
    const narrowSidebar = await widthOf(narrow, ".sidebar");
    if (narrowSidebar !== SIDEBAR_NARROW_W) {
      done(1, `сайдбар при 1024×640 - ${narrowSidebar} px, а не ${SIDEBAR_NARROW_W} px`);
    }
    const narrowContext = await widthOf(narrow, ".context");
    if (narrowContext !== null) {
      done(1, `правой панели в кадре 1024×640 нет - она на месте (${narrowContext} px)`);
    }
    if (await narrow.isVisible('[data-testid="panel-toggle"]')) {
      done(1, "кнопка ☰ в шапке на месте — её больше нет, панель открывается из меню «⋯» («тихий хром», §4)");
    }
    await openMore(narrow);
    await narrow.click('[data-testid="menu-context"]');
    try {
      await narrow.waitForFunction(() => document.querySelector(".context") !== null, undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "пункт «Контекст проекта» меню «⋯» не открыл правую панель");
    }
    const overlay = await measure(narrow);
    if (overlay.context.width !== CONTEXT_W) {
      done(1, `оверлей правой панели — ${overlay.context.width} px, а не ${CONTEXT_W} px`);
    }
    const fromRight = Math.round(overlay.chat.right - overlay.context.right);
    if (fromRight !== 0) {
      done(1, `оверлей правой панели отстал от правого края чата на ${fromRight} px`);
    }
    await narrow.keyboard.press("Escape");
    try {
      await narrow.waitForFunction(() => document.querySelector(".context") === null, undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "Esc не закрыл правую панель");
    }
    await openMore(narrow);
    await narrow.click('[data-testid="menu-context"]');
    await narrow.waitForFunction(() => document.querySelector(".context") !== null, undefined, {
      timeout: 5000,
    });
    await narrow.mouse.click(200, 400);
    try {
      await narrow.waitForFunction(() => document.querySelector(".context") === null, undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "клик снаружи не закрыл правую панель");
    }
    // Крестик шапки панели — третий жест закрытия («тихий хром», §6).
    await openMore(narrow);
    await narrow.click('[data-testid="menu-context"]');
    await narrow.waitForFunction(() => document.querySelector(".context") !== null, undefined, {
      timeout: 5000,
    });
    await narrow.click('[data-testid="panel-close"]');
    try {
      await narrow.waitForFunction(() => document.querySelector(".context") === null, undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "крестик шапки не закрыл правую панель");
    }

    // --- «⋯» и переключатель темы доступны при открытой панели, пункт меню её закрывает -
    // Что окажется сверху в центре элемента: накрывший оверлей перехватит клик — шапка
    // должна оставаться доступной под открытой панелью (спека «тихого хрома», §6).
    await openMore(narrow);
    await narrow.click('[data-testid="menu-context"]');
    await narrow.waitForFunction(() => document.querySelector(".context") !== null, undefined, {
      timeout: 5000,
    });
    const overMore = await topmostAt(narrow, '[data-testid="header-more"]');
    if (!String(overMore).includes("header-more")) {
      done(1, `при открытой правой панели поверх кнопки «⋯» лежит ${overMore} — оверлей накрыл шапку, меню открыть нельзя`);
    }
    const overTheme = await topmostAt(
      narrow,
      '[data-testid="chat-header"] [data-testid="theme-switch"]',
    );
    if (!String(overTheme).includes("theme-switch")) {
      done(1, `при открытой правой панели поверх переключателя темы лежит ${overTheme} — оверлей накрыл шапку, тему не переключить`);
    }
    // Клик по «⋯» панель не закрывает; закрытая ею же пункт «Контекст проекта» («⋯» →
    // «Контекст проекта» — открытую панель закрывает, спека §5).
    await openMore(narrow);
    try {
      await narrow.waitForFunction(() => document.querySelector(".context") !== null, undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "клик по «⋯» при открытой панели закрыл её — жест открытия меню панель не меняет");
    }
    await narrow.click('[data-testid="menu-context"]');
    try {
      await narrow.waitForFunction(() => document.querySelector(".context") === null, undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "пункт «Контекст проекта» при открытой панели не закрыл её");
    }

    // --- Переключатель темы в шапке при открытой панели: клик доходит и переключает ---
    await openMore(narrow);
    await narrow.click('[data-testid="menu-context"]');
    await narrow.waitForFunction(() => document.querySelector(".context") !== null, undefined, {
      timeout: 5000,
    });
    await narrow.click('[data-testid="chat-header"] [data-testid="theme-switch"]');
    try {
      await narrow.waitForFunction(() => document.documentElement.dataset.theme === "light", undefined, {
        timeout: 5000,
      });
    } catch {
      done(1, "переключатель темы в шапке не сработал при открытой правой панели");
    }
    await narrow.close();

    // --- Пикер из правой панели: окно области чата, не внутри панели -------------------
    // Замечание владельца 2026-10-07 22:30: «выбор появляется на самом верху правой
    // части и мне ничего не видно» — пикер, открытый кнопкой «Подключить» панели,
    // монтировался внутри самой панели и отрезался её верхом. От какой бы двери
    // пикер ни открылся, окно его лежит в области чата, как панель сравнения:
    // не выше шапки чата, не за её пределами и не под панелью.
    const docks = await browser.newPage({ viewport: WIDE });
    await docks.goto(`${url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitReady(docks, '[data-testid="chat-header"]');
    await openContextPanel(docks);
    await waitReady(docks, '[data-testid="context-connect"]');
    await docks.click('[data-testid="context-connect"]');
    try {
      await docks.waitForSelector('[data-testid="plugin-picker"]', { timeout: 5000 });
    } catch {
      done(1, "клик «Подключить» правой панели не открыл список плагинов ([data-testid=plugin-picker] нет)");
    }
    const pickerBox = await docks.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
      };
      return {
        inPanel: document.querySelector('[data-testid="plugin-picker"]').closest(".context") !== null,
        picker: box('[data-testid="plugin-picker"]'),
        chat: box(".chat"),
      };
    });
    if (pickerBox.inPanel) {
      done(1, "пикер из правой панели монтируется внутри самой панели — владелец видит отрезанный верх правой части");
    }
    if (pickerBox.picker.top < pickerBox.chat.top + 40) {
      done(
        1,
        `пикер из правой панели стоит на ${Math.round(pickerBox.picker.top - pickerBox.chat.top)} px ниже верха чата (шапка 48 px) — окно выше шапки`,
      );
    }
    if (pickerBox.picker.left < pickerBox.chat.left - 1 || pickerBox.picker.right > pickerBox.chat.right + 1) {
      done(1, `пикер из правой панели выходит за область чата (${Math.round(pickerBox.picker.left)}…${Math.round(pickerBox.picker.right)} при чате ${Math.round(pickerBox.chat.left)}…${Math.round(pickerBox.chat.right)}) — отрезан краем`);
    }
    const overPicker = await docks.evaluate(() => {
      const picker = document.querySelector('[data-testid="plugin-picker"]');
      if (!picker) return false;
      const r = picker.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && picker.contains(hit);
    });
    if (!overPicker) {
      done(1, `центр пикера из правой панели перекрыт — пикер накрыт правой панелью`);
    }
    await docks.keyboard.press("Escape");
    await docks.close();

    // --- Чипы контекста: одна линия без переноса («тихий хром», §7) ---------------------
    // Все приложимые файлы фикстуры уходят в контекст вопроса; чипы встают на одну
    // линию — верхние кромки равны. На канонических ширинах (1440, 1024) шесть чипов
    // в колонку чтения помещаются, поэтому переполнение меряется на пробной ширине
    // 800: строка шире колонки — и всё равно одна линия, излишек уходит в
    // горизонтальную прокрутку (overflow-x: auto), а не в перенос.
    const chipsPage = await browser.newPage({ viewport: WIDE });
    await chipsPage.goto(`${url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitReady(chipsPage, '[data-testid="chat-header"]');
    await openContextPanel(chipsPage);
    const attached = await attachAllFixtureFiles(chipsPage);
    const wideChips = await chipLine(chipsPage);
    if (!wideChips || wideChips.count !== attached) {
      done(1, `чипов контекста ${wideChips ? wideChips.count : 0}, а приложено файлов ${attached} — не по чипу на файл`);
    }
    if (new Set(wideChips.tops).size !== 1) {
      done(1, `чипы контекста легли в ${new Set(wideChips.tops).size} линии при ${attached} файлах — перенос включился, а чипы идут одной линией («тихий хром», §7)`);
    }
    await chipsPage.setViewportSize({ width: 800, height: 640 });
    await chipsPage.waitForTimeout(300);
    const squeezed = await chipLine(chipsPage);
    if (!squeezed || new Set(squeezed.tops).size !== 1) {
      done(1, `при переполнении чипы легли в ${squeezed ? new Set(squeezed.tops).size : 0} линии — перенос вместо горизонтальной прокрутки («тихий хром», §7)`);
    }
    if (squeezed.scrollWidth <= squeezed.clientWidth) {
      done(1, `при ширине 800 чипы не переполнили колонку (${squeezed.scrollWidth} ≤ ${squeezed.clientWidth}) — переполнение нечем мерить`);
    }
    if (squeezed.overflowX !== "auto") {
      done(1, `у строки чипов overflow-x: ${squeezed.overflowX} — излишек не уходит в горизонтальную прокрутку`);
    }
    await chipsPage.setViewportSize({ width: NARROW.width, height: NARROW.height });
    await chipsPage.waitForTimeout(300);
    const narrowChips = await chipLine(chipsPage);
    if (!narrowChips || new Set(narrowChips.tops).size !== 1) {
      done(1, `на 1024×640 чипы контекста не идут одной линией при ${attached} файлах («тихий хром», §7)`);
    }
    await chipsPage.close();

    // --- Пустое состояние: сборка вверху ленты, заголовок 22 px (спека §3) -------------
    const empty = await browser.newPage({ viewport: WIDE });
    await empty.goto(`${url}?состояние=пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await waitReady(empty, '[data-testid="empty"]');
    const emptyBox = await empty.evaluate(() => {
      const block = document.querySelector('[data-testid="empty"]');
      const feed = document.querySelector('[data-testid="feed"]');
      const title = document.querySelector('[data-testid="empty-title"]');
      if (!block || !feed || !title) return null;
      const b = block.getBoundingClientRect();
      const f = feed.getBoundingClientRect();
      return {
        titlePx: parseFloat(getComputedStyle(title).fontSize),
        dx: Math.abs((b.left + b.right) / 2 - (f.left + f.right) / 2),
        top: b.top - f.top,
      };
    });
    if (!emptyBox) {
      done(1, "при ?состояние=пусто на экране нет приветственной сборки — заголовок и ряды карточек");
    }
    if (emptyBox.titlePx !== EMPTY_TITLE_PX) {
      done(1, `заголовок приветствия ${emptyBox.titlePx} px, а не ${EMPTY_TITLE_PX} px`);
    }
    if (emptyBox.top > TOP_TOLERANCE) {
      done(
        1,
        `приветственная сборка висит на ${emptyBox.top.toFixed(1)} px ниже верха ленты (допуск ${TOP_TOLERANCE} px) — сборка стоит вверху прокручиваемой области`,
      );
    }
    if (emptyBox.dx > CENTER_TOLERANCE) {
      done(
        1,
        `сборка не по центру ленты по горизонтали: на ${emptyBox.dx.toFixed(1)} px (допуск ${CENTER_TOLERANCE} px)`,
      );
    }
    await empty.close();

    done(
      0,
      `раскладка ${SIDEBAR_W}/${SIDEBAR_NARROW_W}/${CONTEXT_W} px, панель скрыта по умолчанию и открывается из меню «⋯» оверлеем (Esc, клик снаружи, крестик и повторный пункт её закрывают), «⋯» и переключатель темы доступны под оверлеем, чипы контекста при всех файлах фикстуры идут одной линией и в переполнении уходят в горизонтальную прокрутку без переноса, приветственная сборка вверху ленты с заголовком ${EMPTY_TITLE_PX} px, акцентных пятен ${SPOTS.length} (невидимая «↑» не счёт), тумблеры обеих тем читаются (ручка не белая и различима с дорожкой и панелью), темы совпали по раскладке и разошлись по цвету, фокус ${FOCUS_RING_PX}`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий раскладки упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}