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
// Ракурсы из спецификации экрана, «Где снимать»: два канонических плюс состояния и тема,
// которые иначе снять нечем — все они одной командой и одним файлом проверки.
const SHOTS = [
  { name: "main-window-1440x900", size: [1440, 900], query: "", texts: ["Новый чат", "Контекст проекта"] },
  { name: "main-window-1440x900-light", size: [1440, 900], query: "?тема=светлая", wait: "theme", texts: ["Новый чат"] },
  { name: "main-window-1440x900-empty", size: [1440, 900], query: "?состояние=пусто", wait: "empty", texts: ["Добро пожаловать в GnomeCode", "Открыть проект"] },
  { name: "main-window-1440x900-error", size: [1440, 900], query: "?состояние=ошибка", text: "Сервер OpenCode недоступен", texts: ["Не отвечает"] },
  { name: "main-window-1440x900-long", size: [1440, 900], query: "?состояние=много", wait: "rows:100", texts: ["Открыть проект из Documents"] },
  { name: "main-window-1024x640", size: [1024, 640], query: "", texts: ["Новый чат"] },
  { name: "main-window-1024x640-panel", size: [1024, 640], query: "?правая=открыта", wait: "panel", texts: ["Контекст проекта"] },
  // Кадры пункта 11 (docs/specs/2026-10-06-11-glavnoe.md, «Где снимать»): приветствие
  // и разбор в обеих темах плюс минимум.
  { name: "glavnoe-1440x900-pusto", size: [1440, 900], query: "?состояние=пусто", wait: "empty", texts: ["Добро пожаловать в GnomeCode", "ЧАТЫ", "Открыть проект"] },
  { name: "glavnoe-1440x900-pusto-light", size: [1440, 900], query: "?состояние=пусто&тема=светлая", wait: "empty-light", texts: ["Добро пожаловать в GnomeCode"] },
  { name: "glavnoe-1440x900-razbor", size: [1440, 900], query: "?состояние=разбор", wait: "step", texts: ["Копировать", "Sources used"] },
  { name: "glavnoe-1440x900-razbor-light", size: [1440, 900], query: "?состояние=разбор&тема=светлая", wait: "step-light", texts: ["Копировать", "Sources used"] },
  { name: "glavnoe-1024x640-pusto", size: [1024, 640], query: "?состояние=пусто", wait: "empty", texts: ["Добро пожаловать в GnomeCode"] },
];

const WAITED = { theme: 15000, empty: 15000, panel: 15000 };

/** Чего ждём на странице перед снимком: иначе светлая тема снимется тёмной,
 *  а пустое состояние — лентой. Ошибка здесь называет ракурс и признак. */
const settled = async (page, shot) => {
  if (shot.wait === "theme") {
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", undefined, {
      timeout: WAITED.theme,
    });
    return;
  }
  if (shot.wait === "empty") {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="empty"]')), undefined, {
      timeout: WAITED.empty,
    });
    return;
  }
  if (shot.wait === "empty-light" || shot.wait === "step-light") {
    // Светлая тема и признак состояния вместе: кадр снимается, когда оба на месте.
    await page.waitForFunction(
      (mark) =>
        document.documentElement.dataset.theme === "light" &&
        (mark === "empty"
          ? Boolean(document.querySelector('[data-testid="empty"]'))
          : Boolean(document.querySelector('[data-testid="step"]'))),
      shot.wait === "empty-light" ? "empty" : "step",
      { timeout: WAITED.empty },
    );
    return;
  }
  if (shot.wait === "step") {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="step"]')), undefined, {
      timeout: WAITED.empty,
    });
    return;
  }
  if (shot.wait === "panel") {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="context-panel"]')), undefined, {
      timeout: WAITED.panel,
    });
    return;
  }
  if (shot.wait?.startsWith("rows:")) {
    const wanted = Number(shot.wait.slice("rows:".length));
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="feed"] > .feed__row').length >= n,
      wanted,
      { timeout: 15000 },
    );
    return;
  }
  if (shot.text) {
    await page.waitForFunction(
      (needle) => document.querySelector('[data-testid="feed"]')?.innerText.includes(needle),
      shot.text,
      { timeout: 15000 },
    );
  }
};

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const [width, height] = shot.size;
      const page = await browser.newPage({ viewport: { width, height } });
      await page.goto(`${url}${shot.query}`, { waitUntil: "networkidle" });
      try {
        await settled(page, shot);
      } catch {
        const seen = await page.innerText('[data-testid="feed"]').catch(() => "");
        done(
          1,
          `ракурс ${shot.name} снят, но страница не отдала признак (${shot.wait || shot.text || "строка ленты"}): ${seen.replace(/\s+/g, " ").slice(0, 120)}`,
        );
      }
      const body = await page.innerText("body");
      const missing = shot.texts.filter((text) => !body.includes(text));
      if (missing.length) {
        done(1, `нет текста на экране в ракурсе ${shot.name}: ${missing.map((t) => `«${t}»`).join(", ")}`);
      }
      const file = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${width}×${height}${shot.query}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки окна сняты в ${OUT_DIR}/: ${SHOTS.length} ракурсов — ${SHOTS.map((s) => s.name).join(", ")}`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимка упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}