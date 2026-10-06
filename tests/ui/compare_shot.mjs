// Снимки панели «Сравнение моделей» (docs/specs/2026-10-06-10-compare.md, «Где
// снимать»): панель над лентой — в тёмной и светлой теме, 1024×640, раскрытая
// строка, таблица из кэша, ошибка без кэша и загрузка. Отдельная команда (не в
// SHOTS window_shot.mjs): у каждого ракурса своё состояние адреса, а не действия.
//
//   node tests/ui/compare_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки.
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»).
import { done, openShotPage, startInterface, startShot, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const PANEL = '[data-testid="compare-panel"]';

/** Ракурсы: состояние адреса открывает панель сам — кликов владельца не нужно.
 *  Признак кадра — текст, который есть только в этом состоянии. */
const SHOTS = [
  { name: "compare-1440x900", query: "?состояние=сравнение", seen: ["Сравнение моделей", "Claude Sonnet 5.5", "$2.00", "Выбрана"] },
  { name: "compare-1440x900-light", query: "?состояние=сравнение&тема=светлая", theme: "light", seen: ["Сравнение моделей", "Claude Sonnet 5.5"] },
  { name: "compare-1440x900-expanded", query: "?состояние=сравнение-раскрыто", seen: ["Cohere coding model", "SWE-Bench Verified", "Выпущена 2026-06-09", "Open weights"] },
  { name: "compare-1440x900-cache", query: "?состояние=сравнение-кэш", seen: ["Сайт недоступен — данные от", "Обновлено"] },
  { name: "compare-1440x900-error", query: "?состояние=сравнение-ошибка", seen: ["Сайт opencode.ai недоступен", "Данные ещё не загружались"] },
  { name: "compare-1440x900-loading", query: "?состояние=сравнение-загрузка", seen: ["Читаю каталог моделей…"] },
];

// Подъём до try, как у любого сценария-снимка: done() выходит из процесса,
// за остановку сервера следит его exit-хук в startInterface.
const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const shot of SHOTS) {
      const { context, page } = await openShotPage(browser, url, shot.query, shot.theme ?? null);
      // Признак кадра: панель открыта и в ней есть тексты этого состояния.
      await page.waitForSelector(PANEL, { timeout: 15_000 });
      if (shot.query.includes("раскрыто")) {
        try {
          await page.waitForSelector(`${PANEL} [data-testid="compare-details"]`, { timeout: 5000 });
        } catch {
          done(1, "состояние «сравнение-раскрыто» не раскрыло строку North Mini Code: нет [data-testid=compare-details]");
        }
      }
      const body = await page.$eval(PANEL, (el) => el.textContent.replace(/\s+/g, " ").trim());
      for (const text of shot.seen) {
        if (!body.includes(text)) {
          done(1, `в кадре ${shot.name} нет «${text}»: есть «${body.slice(0, 200)}»`);
        }
      }
      const file = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${shot.query}`);
      await context.close();
    }

    // 1024×640 — минимум: панель не выезжает за окно и за шапку чата.
    const context = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await context.newPage();
    await page.goto(`${url}?состояние=сравнение`, { waitUntil: "networkidle" });
    await page.waitForSelector(PANEL, { timeout: 15_000 });
    const frame = await page.$eval("html", (el) => `${el.clientWidth}x${el.clientHeight}`);
    if (frame !== "1024x640") {
      done(1, `кадр 1024×640 снят при размере страницы ${frame}`);
    }
    const box = await page.$eval(PANEL, (el) => {
      const { right, bottom, width } = el.getBoundingClientRect();
      return { right: Math.round(right), bottom: Math.round(bottom), width: Math.round(width) };
    });
    // Панель до низа окна (24 px отступ) и у правого края области чата.
    if (box.bottom !== 616 || box.width > 680) {
      done(1, `в кадре 1024×640 панель не внутри окна: низ ${box.bottom}, ширина ${box.width}`);
    }
    await page.screenshot({ path: `${OUT_DIR}/compare-1024x640.png` });
    console.log(`снимок ${OUT_DIR}/compare-1024x640.png: ?состояние=сравнение 1024×640`);
    await context.close();
  } finally {
    await browser.close();
  }
  done(0, `снимки панели «Сравнение моделей» сняты в ${OUT_DIR}/: 7 кадров (обе темы, 1024×640, раскрыто, кэш, ошибка, загрузка)`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимков сравнения моделей упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
