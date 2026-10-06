// Снимки Usage/Audit (docs/BATCH.md, пункт 8, сцена J): раскрытая деталями строка
// вызова плагина и счётчик на карточке — в тёмной и светлой теме. Отдельная
// команда (не в SHOTS window_shot.mjs): кадры собираются действиями владельца —
// вызов команды, клик по строке, переход в раздел «Плагины».
//
//   node tests/ui/usage_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки.
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»).
import { done, startInterface, startShot, openShotPage, connectPlugin, commandButton, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const CARD = '[data-testid="plugin-card"][data-plugin="git"]';

/** Ракурсы: раскрытые детали вызова и счётчик карточки — обе темы одного пути владельца. */
const THEMES = [
  { suffix: null, mark: "" },
  { suffix: "light", mark: "&тема=светлая" },
];

/** Вызов diff, как его делает владелец: кнопка команды в шапке — строка в ленте. */
const runDiff = async (page) => {
  await connectPlugin(page, "git");
  await page.click(commandButton("git:diff"));
  await page.waitForFunction(
    () => Array.from(document.querySelectorAll('[data-testid="feed"] .feed__row--tool'))
      .some((row) => row.textContent.includes("git · diff")),
    undefined,
    { timeout: 5000 },
  );
};

const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const theme of THEMES) {
      const name = `usage-details-1440x900${theme.suffix ? `-${theme.suffix}` : ""}`;
      const { context, page } = await openShotPage(browser, url, `?состояние=плагины${theme.mark}`, theme.suffix);
      await runDiff(page);
      await page.click('[data-testid="feed"] .feed__row--tool:has-text("git · diff")');
      await page.waitForSelector('[data-testid="feed-row-details"]', { timeout: 5000 });
      const details = await page.$eval('[data-testid="feed-row-details"]', (el) => el.textContent);
      for (const text of ["Плагин: git", "Чат: Новый чат", "Модель: GLM-5.3 High"]) {
        if (!details.includes(text)) {
          done(1, `в кадре ${name} нет детали «${text}» — снято не того окна`);
        }
      }
      const file = `${OUT_DIR}/${name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: 1440×900${theme.mark}`);
      await context.close();
    }
    for (const theme of THEMES) {
      const name = `usage-counter-1440x900${theme.suffix ? `-${theme.suffix}` : ""}`;
      const { context, page } = await openShotPage(browser, url, `?состояние=плагины${theme.mark}`, theme.suffix);
      await runDiff(page);
      await page.click('[data-testid="sidebar-plugins"]');
      await page.waitForSelector(CARD, { timeout: 5000 });
      const usage = await page.$eval(`${CARD} [data-testid="plugin-card-usage"]`, (el) => el.textContent.trim());
      if (usage !== "Вызовов: 1") {
        done(1, `в кадре ${name} счётчик карточки не равен «Вызовов: 1» — есть «${usage}»`);
      }
      const file = `${OUT_DIR}/${name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: 1440×900${theme.mark}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки Usage/Audit сняты в ${OUT_DIR}/: 4 кадра (детали и счётчик, обе темы)`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимков Usage упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
