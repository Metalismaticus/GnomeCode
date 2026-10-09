// Снимки раздела «Статистика» (docs/BATCH.md, пункт 2, шаг «экран»): раздел
// в тёмной и светлой теме, пустые данные и минимум 1024×640. Раздел открывается
// кликом по строке сайдбара из состояния «проект» — в кадре и вторая линия
// проекта «Этот проект стоил X».
//
//   python -X utf8 tools/run_checks.py stats_shot
// Итог: код возврата и последняя строка вывода — как у любой проверки.
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»).
import { done, openShotPage, startInterface, startShot, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const PAGE = '[data-testid="stats-page"]';
const ROW = '[data-testid="sidebar-stats"]';

/** Ракурсы: состояние адреса плюс клик по строке сайдбара (раздел из чата).
 *  Признак кадра — текст, который есть только в этом состоянии. */
const SHOTS = [
  {
    name: "stats-1440x900",
    query: "?состояние=проект",
    click: true,
    seen: ["Статистика", "По проектам", "По моделям", "Этот проект стоил", "стоимость неизвестна", "Цены от"],
  },
  {
    name: "stats-1440x900-light",
    query: "?состояние=проект&тема=светлая",
    click: true,
    theme: "light",
    seen: ["Статистика", "По проектам", "По моделям"],
  },
  {
    name: "stats-1440x900-empty",
    query: "?состояние=статистика-пусто",
    seen: ["Пока нет расхода"],
  },
];

const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const shot of SHOTS) {
      const { context, page } = await openShotPage(browser, url, shot.query, shot.theme ?? null);
      if (shot.click) {
        await page.click(ROW, { timeout: 15_000 });
      }
      await page.waitForSelector(PAGE, { timeout: 15_000 });
      const body = await page.$eval(PAGE, (el) => el.textContent.replace(/\s+/g, " ").trim());
      for (const want of shot.seen) {
        if (!body.includes(want)) {
          done(1, `в кадре ${shot.name} нет «${want}»: есть «${body.slice(0, 200)}»`);
        }
      }
      const file = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${shot.query}${shot.click ? " + клик по строке сайдбара" : ""}`);
      await context.close();
    }

    // 1024×640 — минимум: раздел помещается в окно без горизонтального скролла.
    const context = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await context.newPage();
    await page.goto(`${url}?состояние=проект`, { waitUntil: "networkidle" });
    await page.click(ROW, { timeout: 15_000 });
    await page.waitForSelector(PAGE, { timeout: 15_000 });
    const frame = await page.$eval("html", (el) => `${el.clientWidth}x${el.clientHeight}`);
    if (frame !== "1024x640") {
      done(1, `кадр 1024×640 снят при размере страницы ${frame}`);
    }
    const box = await page.$eval(PAGE, (el) => {
      const { left, right, bottom } = el.getBoundingClientRect();
      return { left: Math.round(left), right: Math.round(right), bottom: Math.round(bottom) };
    });
    // Раздел между сайдбаром и правым краем окна, до низа окна.
    if (box.left < 200 || box.right > 1024 || box.bottom > 640) {
      done(1, `в кадре 1024×640 раздел не внутри окна: левый ${box.left}, правый ${box.right}, низ ${box.bottom}`);
    }
    await page.screenshot({ path: `${OUT_DIR}/stats-1024x640.png` });
    console.log(`снимок ${OUT_DIR}/stats-1024x640.png: ?состояние=проект + клик, 1024×640`);
    await context.close();
  } finally {
    await browser.close();
  }
  done(0, `снимки раздела «Статистика» сняты в ${OUT_DIR}/: 4 кадра (обе темы, пустые данные, 1024×640)`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимков статистики упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
