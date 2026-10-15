// QA «драг из дерева»: файл из дерева → чат (чип), файл из дерева → плагины
// (тост установки). Запуск: node tests/qa-tree-drag.mjs (dev-сервер на 5173).
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5173";
let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS ${name}`);
  } else {
    failed++;
    console.log(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();

// --- Дерево → чат: файл перетаскивают, чип появляется в композере.
await page.goto(`${BASE}/?состояние=проект&правая=открыта`);
await page.waitForSelector('[data-testid="tree-row"][data-kind="file"]');
const row = page.locator('[data-testid="tree-row"][data-kind="file"]').first();
await row.scrollIntoViewIfNeeded();
await page.evaluate(() => {
  const source = document.querySelector('[data-testid="tree-row"][data-kind="file"]');
  const target = document.querySelector('[data-testid="chat"]');
  const dt = new DataTransfer();
  source.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true, cancelable: true }));
  target.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
  target.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await page.waitForSelector('[data-testid="context-chip"]');
const chip = await page.locator('[data-testid="context-chip"]').first().textContent();
check("дерево → чат: файл приложен чипом", (chip ?? "").length > 0, chip ?? "чипа нет");

// --- Дерево → плагины: .ts из дерева устанавливается, тост говорит про Disabled.
await page.goto(`${BASE}/?состояние=плагины-раздел`);
await page.waitForSelector('[data-testid="plugins-page"]');
await page.evaluate(() => {
  const target = document.querySelector('[data-testid="plugins-page"]');
  const dt = new DataTransfer();
  dt.items.add("C:\\Users\\Metalismatic\\Documents\\GnomeCode\\components\\bridge.ts", "text/plain");
  target.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
  target.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await page.waitForSelector('[data-testid="plugins-drop-note"]');
const note = await page.locator('[data-testid="plugins-drop-note"]').textContent();
check("дерево → плагины: .ts установлен, тост про Disabled", (note ?? "").includes("bridge"), note ?? "нет тоста");
await page.locator('[data-testid="plugin-tab-disabled"]').click();
check("дерево → плагины: карточка во вкладке Disabled", await page.locator('[data-testid="plugin-card"][data-plugin="bridge"]').count() === 1);

// --- Файл не-.ts из дерева в плагины: честный отказ тостом.
await page.locator('[data-testid="plugin-tab-installed"]').click();
await page.evaluate(() => {
  const target = document.querySelector('[data-testid="plugins-page"]');
  const dt = new DataTransfer();
  dt.items.add("C:\\Users\\Metalismatic\\Documents\\GnomeCode\\README.md", "text/plain");
  target.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
});
await page.waitForTimeout(200);
const bad = await page.locator('[data-testid="plugins-drop-note"]').textContent();
check("дерево → плагины: не-.ts отвергнут", (bad ?? "").includes(".ts"), bad ?? "нет отказа");

await browser.close();
console.log(`\nИТОГ: ${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
