// Снимок главного окна продукта одной командой: Playwright в headless, окна на экране нет.
// Проверка полигона сама поднимает сервер интерфейса на свободном порту (порт 5173 может
// занять `npm run tauri dev`), снимает канонические ракурсы и гасит сервер.
//
//   node tests/ui/window_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2 Playwright не водит.
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const OUT_DIR = "shots";
const SIZES = [[1440, 900], [1024, 640]];
const TEXTS = ["Новый чат", "Контекст проекта"];
const INSTALL = "npx playwright install chromium";
const done = (code, line) => {
  console.log(line);
  process.exit(code);
};

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer().on("error", reject).listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const waiting = async (url, seconds) => {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
};

const port = await freePort();
const url = `http://127.0.0.1:${port}/`;
// npx на Windows — это .cmd, и Node 22 не запускает его без оболочки; аргументы свои, не пользовательские.
const server = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
  stdio: "ignore",
  shell: true,
});
const stop = () => server.kill();
process.on("exit", stop);
try {
  if (!(await waiting(url, 60))) {
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
