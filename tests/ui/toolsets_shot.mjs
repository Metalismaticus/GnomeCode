// Снимки окна Tool Sets (docs/BATCH.md, пункт 7) одной командой: строка сета
// «Chat Basics» (git, docs) с мини-полосой Chat/Project и формой «Save as Tool
// Set» внизу, затем подключённый сет — пункты обеих команд в меню «⋯»;
// обе темы главного окна 1440×900. Отдельная команда (не в SHOTS
// window_shot.mjs): кадр открывается действиями владельца, а не параметром страницы.
//
//   node tests/ui/toolsets_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки.
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»).
import { closeMore, connectPlugin, done, openMore, startInterface, startShot, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const WIDE = { width: 1440, height: 900 };
const ADD = '[data-testid="composer-add"]';
const PICKER = '[data-testid="toolset-picker"]';
const NAME = '[data-testid="toolset-name"]';
const SAVE = '[data-testid="toolset-save"]';
const SET_NAME = "Chat Basics";
const ROW = (name) => `${PICKER} [data-testid="toolset-row"][data-toolset="${name}"]`;

/** Ракурсы: обе темы — окно сетов и шапка после подключения сета. */
const SHOTS = [
  { name: "toolsets-picker-1440x900", light: false },
  { name: "toolsets-picker-1440x900-light", light: true },
];

// Подъём до try, как у любого сценария-снимка: done() выходит из процесса,
// за остановку сервера следит его exit-хук в startInterface; папку снимков
// и браузер открывает startShot уже внутри.
const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const shot of SHOTS) {
      // Свежий контекст: хранилище страницы не приносит сетов прошлой темы.
      const context = await browser.newContext({ viewport: WIDE });
      const page = await context.newPage();
      await page.goto(`${url}?состояние=плагины${shot.light ? "&тема=светлая" : ""}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
      if (shot.light) {
        await page.waitForFunction(
          (wanted) => document.documentElement.dataset.theme === wanted,
          "light",
          { timeout: 15000 },
        );
      }

      // Как у владельца: подключить git и docs к чату, «+» → Tool Set → имя → Save.
      await connectPlugin(page, "git");
      await connectPlugin(page, "docs");
      await page.click(ADD);
      await page.click('[data-testid="add-tool-set"]');
      await page.waitForSelector(PICKER, { timeout: 5000 });
      await page.fill(NAME, SET_NAME);
      await page.click(SAVE);
      await page.waitForSelector(ROW(SET_NAME), { timeout: 5000 });

      // Признак кадра: строка сета с обоими плагинами и мини-полосой Chat/Project —
      // иначе снимок снят не того окна.
      const rowText = await page.$eval(ROW(SET_NAME), (el) => el.textContent);
      for (const id of ["git", "docs"]) {
        if (!rowText.includes(id)) {
          done(1, `строка сета «${SET_NAME}» не показывает плагин «${id}»: ${rowText.trim()}`);
        }
      }
      await page.$eval(`${ROW(SET_NAME)} [data-testid="toolset-row-scopes"]`, () => {});
      for (const kind of ["chat", "project"]) {
        await page.$eval(`${ROW(SET_NAME)} [data-testid="toolset-scope-${kind}"]`, () => {});
      }
      const pickerFile = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: pickerFile });
      console.log(`снимок ${pickerFile}: ${WIDE.width}×${WIDE.height}${shot.light ? " светлая" : " тёмная"}`);

      // Подключить сет кликом по строке: пункты обеих команд — в меню «⋯».
      await page.click(ROW(SET_NAME));
      await openMore(page);
      await page.waitForSelector('[data-testid="plugin-button"][data-command="git:diff"]', { timeout: 5000 });
      await page.waitForSelector('[data-testid="plugin-button"][data-command="docs:search"]', { timeout: 5000 });
      const shown = await page.$$eval('[data-testid="plugin-button"]', (els) =>
        els.map((el) => el.getAttribute("data-command")),
      );
      for (const command of ["git:diff", "docs:search"]) {
        if (!shown.includes(command)) {
          done(1, `после подключения сета нет пункта «${command}» в меню «⋯»: ${JSON.stringify(shown)}`);
        }
      }
      const headerFile = `${OUT_DIR}/${shot.name.replace("-picker-", "-header-")}.png`;
      await page.screenshot({ path: headerFile });
      console.log(`снимок ${headerFile}: ${WIDE.width}×${WIDE.height}${shot.light ? " светлая" : " тёмная"}`);
      await closeMore(page);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки окна Tool Sets сняты в ${OUT_DIR}/: ${SHOTS.map((s) => s.name).join(", ")}`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимка Tool Sets упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
