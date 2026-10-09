// Снимки окна без рамки (docs/ROADMAP.md, «Окно без рамки: своя шапка», «Как
// увидеть»): главный экран в тёмной и светлой теме 1440×900 — кластер кнопок
// окна (тема + свернуть/развернуть/закрыть) стоит в правом краю шапки чата,
// полоса размечена перетаскиванием.
//
//   node tests/ui/frameless_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Ограничение: снимается страница интерфейса, а не окно Tauri — системную
// рамку и её отсутствие WebView2 Playwright не рисует (живой шаг владельца).
import { done, openShotPage, startInterface, startShot, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const HEADER = '[data-testid="chat-header"]';

/** Ракурсы: тема адресом, признак кадра — кнопки окна в шапке чата. */
const SHOTS = [
  { name: "frameless-1440x900", query: "" },
  { name: "frameless-1440x900-light", query: "?тема=светлая", theme: "light" },
];

const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const shot of SHOTS) {
      const { context, page } = await openShotPage(browser, url, shot.query, shot.theme ?? null);
      await page.waitForSelector(`${HEADER} [data-testid="window-close"]`, { timeout: 15_000 });
      // Кластер кнопок окна — в правом краю окна: шапка чата держит полосу 48 px,
      // кнопки прижаты к её правому концу (WindowCluster.tsx, «тихий хром» §4).
      const line = await page.$eval(HEADER, (el) => {
        const header = el.getBoundingClientRect();
        const buttons = document.querySelector('[data-testid="window-buttons"]')?.getBoundingClientRect();
        if (!buttons) {
          return null;
        }
        return { height: Math.round(header.height), gap: Math.round(header.right - buttons.right) };
      });
      if (!line) {
        done(1, `в кадре ${shot.name} нет кнопок окна в шапке чата: нет [data-testid=window-buttons]`);
      }
      if (line.height < 48 || line.gap < 0 || line.gap > 32) {
        done(1, `кнопки окна не в полосе чата: полоса ${line.height} px, отступ правого края ${line.gap} px`);
      }
      if (!(await page.$eval(HEADER, (el) => el.hasAttribute("data-tauri-drag-region")))) {
        done(1, `в кадре ${shot.name} шапка чата без data-tauri-drag-region — перетаскивать не за что`);
      }
      const file = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${shot.query || "тёмная тема"}`);
      await context.close();
    }
    done(0, "снимки окна без рамки сняты в shots/: frameless-1440x900.png, frameless-1440x900-light.png");
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимков окна без рамки упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
