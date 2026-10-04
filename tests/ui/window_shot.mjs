// Снимок главного окна продукта одной командой: Playwright в headless, окна на экране нет.
// Проверка полигона сама поднимает сервер интерфейса на свободном порту (порт 5173 может
// занять `npm run tauri dev`), снимает канонические ракурсы и гасит сервер.
//
//   node tests/ui/window_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2 Playwright не водит.
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const SIZES = [[1440, 900], [1024, 640]];
const TEXTS = ["Новый чат", "Контекст проекта"];

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const [width, height] of SIZES) {
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(url, { waitUntil: "networkidle" });
      const body = await page.innerText("body");
      const missing = TEXTS.filter((text) => !body.includes(text));
      if (missing.length) {
        done(1, `нет текста на экране при ${width}×${height}: ${missing.map((t) => `«${t}»`).join(", ")}`);
      }
      const file = `${OUT_DIR}/main-window-${width}x${height}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${width}×${height}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки окна сняты в ${OUT_DIR}/: ${SIZES.map(([w, h]) => `${w}×${h}`).join(", ")}`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимка упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
