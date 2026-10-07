// Встроенный вариант B (docs/specs/2026-10-06-11-glavnoe.md, §8 «Встраивание»):
// тёмные панели — явными шагами светлоты от фона (--bg-panel/--bg-panel-2/--border),
// свечение в цвет акцента — только в тёмной теме: кнопка отправки через box-shadow,
// знак логотипа через filter: var(--glow-filter) — drop-shadow по круглому силуэту
// файла (box-shadow на png с прозрачными углами давал бы прямоугольный ореол).
// Светлая тема остаётся на уровнях варианта A — её встраивание не трогает.
// Числа стерегут числа, снимок судит владелец.
//
//   node tests/ui/variant_b.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixture.ts, параметры адреса — src/viewparams.ts).
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
// Токены тёмной темы варианта B (лист сравнения, строка варианта B).
const DARK = { "--bg-panel": "#212d51", "--bg-panel-2": "#2c3867", "--border": "#34436f" };
const DARK_PANEL_A = "#f7f7fa"; // светлая — уровни A, их не трогаем
const GLOW = "rgba(109, 92, 255, 0.32)";
const GLOW_BLUR = "24px";
const GLOW_PLACES = [".composer__send", ".sidebar__logo-mark"];
const SEND = ".composer__send";
const MARK = ".sidebar__logo-mark";
// Знак логотипа по высоте строки сайдбара: 24–28 px, ширина авто.
const LOGO_MIN_PX = 24;
const LOGO_MAX_PX = 28;

/** Значение CSS-переменной у <html> — малыми буквами, пробелы обрезаны. */
const tokenOf = (page, name) =>
  page.$eval("html", (el, custom) => getComputedStyle(el).getPropertyValue(custom), name);

/** box-shadow элемента: null — элемента нет. */
const shadowOf = (page, selector) =>
  page.$eval(selector, (el) => getComputedStyle(el).boxShadow).catch(() => null);

/** filter элемента: null — элемента нет. */
const filterOf = (page, selector) =>
  page.$eval(selector, (el) => getComputedStyle(el).filter).catch(() => null);

/** Знак логотипа: alt, загрузился, размер по рамке. */
const logoOf = (page) =>
  page.$eval(".sidebar__logo-mark", (img) => {
    const r = img.getBoundingClientRect();
    return {
      alt: img.getAttribute("alt") ?? "",
      loaded: img.complete && img.naturalWidth > 0,
      height: r.height,
      width: r.width,
    };
  }).catch(() => null);

const iface = await startInterface();
try {
  if (!iface.ok) {
    done(1, `сервер интерфейса не поднялся на порту ${iface.port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    // --- Тёмная тема: токены варианта B, свечение, маскот -------------------------------
    const dark = await browser.newPage({ viewport: WIDE });
    await dark.goto(`${iface.url}?состояние=пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await dark.waitForSelector(".sidebar", { timeout: 15000 });
    for (const [name, wanted] of Object.entries(DARK)) {
      const value = (await tokenOf(dark, name)).trim().toLowerCase();
      if (value !== wanted) {
        done(1, `--${name} тёмной темы — «${value}», а не «${wanted}» (вариант B: панели разведены явными шагами)`);
      }
    }
    for (const where of GLOW_PLACES) {
      if (where === SEND) {
        const shadow = await shadowOf(dark, where);
        if (!shadow || !shadow.includes(GLOW) || !shadow.includes(GLOW_BLUR)) {
          done(1, `свечение в цвет акцента не на ${where}: box-shadow «${shadow}», а не ${GLOW} с размытием ${GLOW_BLUR}`);
        }
      } else {
        const filter = await filterOf(dark, where);
        if (!filter || !filter.includes("drop-shadow") || !filter.includes(GLOW) || !filter.includes(GLOW_BLUR)) {
          done(1, `свечение в цвет акцента не на ${where}: filter «${filter}», а не drop-shadow ${GLOW} с размытием ${GLOW_BLUR}`);
        }
      }
    }
    // Картинка маскота тяжёлая: ждать загрузки, а не мерить недогруженное.
    try {
      await dark.waitForFunction(() => {
        const img = document.querySelector(".sidebar__logo-mark");
        return img instanceof HTMLImageElement && img.complete && img.naturalWidth > 0;
      }, undefined, { timeout: 15000 });
    } catch {
      done(1, "картинка маскота не загрузилась за 15 с — файл логотипа не подключён");
    }
    const logo = await logoOf(dark);
    if (!logo) {
      done(1, "в сайдбаре нет знака логотипа — маскот не вставлен");
    }
    if (logo.alt !== "GnomeCode") {
      done(1, `alt знака логотипа — «${logo.alt}», а не «GnomeCode»`);
    }
    if (!logo.loaded) {
      done(1, "картинка маскота не загрузилась — файл логотипа не подключён");
    }
    if (logo.height < LOGO_MIN_PX || logo.height > LOGO_MAX_PX) {
      done(1, `знак логотипа ${logo.height.toFixed(1)} px высотой, а не ${LOGO_MIN_PX}–${LOGO_MAX_PX} px по рамке строки`);
    }
    if (logo.width < LOGO_MIN_PX || logo.width > LOGO_MAX_PX) {
      done(1, `знак логотипа ${logo.width.toFixed(1)} px шириной — ширина должна быть авто по квадрату маскота`);
    }
    await dark.close();

    // --- Светлая тема: свечения нет, уровни A на месте, маскот тот же -------------------
    const light = await browser.newPage({ viewport: WIDE });
    await light.goto(`${iface.url}?состояние=пусто&тема=светлая`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await light.waitForSelector(".sidebar", { timeout: 15000 });
    const lightPanel = (await tokenOf(light, "--bg-panel")).trim().toLowerCase();
    if (lightPanel !== DARK_PANEL_A) {
      done(1, `--bg-panel светлой темы — «${lightPanel}», а не «${DARK_PANEL_A}» — светлую тему встраивание варианта B трогать не должно`);
    }
    for (const where of GLOW_PLACES) {
      const shadow = await shadowOf(light, where);
      if (shadow && shadow !== "none") {
        done(1, `в светлой теме у ${where} box-shadow «${shadow}» — свечение только у тёмной`);
      }
    }
    const lightFilter = await filterOf(light, MARK);
    if (lightFilter && lightFilter !== "none") {
      done(1, `в светлой теме у ${MARK} filter «${lightFilter}» — свечение только у тёмной`);
    }
    const lightLogo = await logoOf(light);
    if (!lightLogo || !lightLogo.loaded) {
      done(1, "в светлой теме знак логотипа пропал — маскот один на обе темы");
    }
    await light.close();

    done(
      0,
      `вариант B в тёмной теме: --bg-panel/${DARK["--bg-panel"]} --bg-panel-2/${DARK["--bg-panel-2"]} --border/${DARK["--border"]}, свечение ${GLOW} ${GLOW_BLUR} на кнопке отправки и знаке логотипа, маскот ${LOGO_MIN_PX}–${LOGO_MAX_PX} px с alt «GnomeCode»; светлая тема без свечения, уровни A и маскот на месте`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий варианта B упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
