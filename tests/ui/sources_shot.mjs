// Снимки «Sources used» (docs/BATCH.md, пункт 9): блок источников под ответом —
// в тёмной и светлой теме. Отдельная команда (не в SHOTS window_shot.mjs): блок
// собирается действиями владельца — чип файла, отправка вопроса, ответ модели.
//
//   node tests/ui/sources_shot.mjs
// Итог: код возврат и последняя строка вывода — как у любой проверки.
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»).
import { done, openContextPanel, openShotPage, startInterface, startShot, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const FILE = "bridge.ts";
const DIR = "components";
const BLOCK = '[data-testid="sources-used"]';

/** Вопрос с файлом, как его делает владелец: панель «Контекст проекта» из меню «⋯»,
 *  раскрыть папку, клик по файлу, отправить. */
const askWithFile = async (page) => {
  await openContextPanel(page);
  await page.click(`[data-testid="tree-toggle"][data-name="${DIR}"]`);
  await page.click(`[data-testid="tree-row"][data-name="${FILE}"]`);
  await page.fill('[data-testid="composer"]', "Что делает этот мост?");
  await page.keyboard.press("Control+Enter");
  await page.waitForSelector(BLOCK, { timeout: 5000 });
};

const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const theme of [null, "light"]) {
      const name = `sources-1440x900${theme ? `-${theme}` : ""}`;
      const { context, page } = await openShotPage(
        browser,
        url,
        `?состояние=проект${theme ? "&тема=светлая" : ""}`,
        theme,
      );
      await askWithFile(page);
      const listed = await page.$eval(BLOCK, (el) => el.textContent.replace(/\s+/g, " "));
      if (!listed.includes(FILE)) {
        done(1, `в кадре ${name} блок источников не называет «${FILE}» — есть «${listed}»`);
      }
      const file = `${OUT_DIR}/${name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: 1440×900${theme ? " светлая" : ""}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки «Sources used» сняты в ${OUT_DIR}/: 2 кадра (тёмная и светлая тема)`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимков источников упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
