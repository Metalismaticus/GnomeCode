// Снимок окна «Плагины» (список Connect plugin) одной командой: разделы
// «Избранные» / «Недавние» / «Все плагины» и заполненный ⭐ — в тёмной и светлой
// теме. Отдельная команда (не в SHOTS window_shot.mjs): кадр открывается
// действиями владельца, а не параметром страницы.
//
//   node tests/ui/plugins_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки.
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»).
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const WIDE = { width: 1440, height: 900 };
const PICKER = '[data-testid="plugin-picker"]';
const CONNECT = "[data-testid=add-connect-plugin]";
const SOLO = "docs";

/** Ракурсы: обе темы одного окна; список наполняют те же кнопки, что жмёт владелец. */
const SHOTS = [
  { name: "plugins-picker-1440x900", query: "?состояние=плагины", theme: null },
  { name: "plugins-picker-1440x900-light", query: "?состояние=плагины&тема=светлая", theme: "light" },
];

const { url, stop, ok, port } = await startInterface();
// done() выходит из процесса: за остановку сервера следит его exit-хук в startInterface,
// поэтому возвышение vite — до try, а не внутри него, как в проверках страницы.
if (!ok) {
  done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
}
try {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      // Свежий контекст: хранилище страницы не приносит пины прошлого ракурса.
      const context = await browser.newContext({ viewport: WIDE });
      const page = await context.newPage();
      await page.goto(`${url}${shot.query}`, { waitUntil: "networkidle" });
      if (shot.theme) {
        await page.waitForFunction(
          (wanted) => document.documentElement.dataset.theme === wanted,
          shot.theme,
          { timeout: 15000 },
        );
      }

      // Как у владельца: подключить плагин, пинуть его, снова открыть список.
      await page.click('[data-testid="composer-add"]');
      await page.click(CONNECT);
      await page.waitForSelector(PICKER, { timeout: 5000 });
      await page.click(`${PICKER} [data-testid="plugin-row"][data-plugin="${SOLO}"]`);
      await page.waitForSelector(`[data-testid="plugin-button"][data-plugin="${SOLO}"]`, { timeout: 5000 });
      await page.click('[data-testid="composer-add"]');
      await page.click(CONNECT);
      await page.waitForSelector(PICKER, { timeout: 5000 });
      await page.click(`${PICKER} [data-testid="plugin-row"][data-plugin="${SOLO}"] [data-testid="plugin-favorite"]`);
      await page.click('[data-testid="composer-add"]');
      await page.click(CONNECT);
      await page.waitForSelector(PICKER, { timeout: 5000 });

      // Признак кадра: три раздела и заполненный ⭐ — иначе снимок снят не того окна.
      const groups = await page.$$eval(
        `${PICKER} [data-testid="plugin-group"]`,
        (els) => els.map((el) => el.getAttribute("data-group")),
      );
      for (const name of ["Избранные", "Недавние", "Все плагины"]) {
        if (!groups.includes(name)) {
          done(1, `в кадре ${shot.name} нет раздела «${name}»: есть ${groups.join(", ") || "ни одного"}`);
        }
      }
      const pinned = await page.$eval(
        `${PICKER} [data-testid="plugin-row"][data-plugin="${SOLO}"] [data-testid="plugin-favorite"]`,
        (el) => el.getAttribute("aria-pressed"),
      );
      if (pinned !== "true") {
        done(1, `в кадре ${shot.name} ⭐ у «${SOLO}» не заполнен (aria-pressed=${pinned})`);
      }
      const body = await page.innerText("body");
      for (const text of ["Плагины", SOLO]) {
        if (!body.includes(text)) {
          done(1, `нет текста на экране в ракурсе ${shot.name}: «${text}»`);
        }
      }

      const file = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${WIDE.width}×${WIDE.height}${shot.query}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки окна «Плагины» сняты в ${OUT_DIR}/: ${SHOTS.map((s) => s.name).join(", ")}`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимка плагинов упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
