// QA «клик-проводник + дерево в плагинах» (замечания владельца 15.10, вечер):
// зона в настройках→Плагины, клик по зоне открывает выбор файла (фикстура),
// дерево проекта на странице Плагинов с установкой .ts кликом.
// Запуск: node tests/qa-drop-click.mjs (dev-сервер на 5173 должен жить).
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

// --- Настройки → Плагины: зона есть, клик по ней ставит плагин (фикстура выбора).
await page.goto(`${BASE}/?состояние=настройки-плагины`);
await page.waitForSelector('[data-testid="settings-plugins-drop"]');
check("настройки→Плагины: зона .ts на месте", true);
await page.locator('[data-testid="settings-plugins-drop"]').click();
await page.waitForSelector('[data-testid="settings-plugins-drop-note"]');
const note = await page.locator('[data-testid="settings-plugins-drop-note"]').textContent();
check("настройки→Плагины: клик по зоне ставит плагин", (note ?? "").includes("picked-skill"), note ?? "нет заметки");

// --- Страница Плагинов: колонка «Файлы проекта» с деревом, .ts ставится кликом.
await page.goto(`${BASE}/?состояние=плагины-раздел`);
await page.waitForSelector('[data-testid="plugins-tree"]');
const rows = await page.locator('[data-testid="plugins-tree-row"]').count();
check("Плагины: дерево проекта видно", rows >= 5, `${rows} строк`);
// Папка раскрывается: components → bridge.ts внутри, клик ставит плагин.
const toggle = page.locator('[data-testid="plugins-tree-toggle"][data-name="components"]');
await toggle.click();
await page.waitForTimeout(200);
await page.locator('[data-testid="plugins-tree-pick"]', { hasText: "bridge.ts" }).first().click();
await page.waitForSelector('[data-testid="plugins-drop-note"]');
const installNote = await page.locator('[data-testid="plugins-drop-note"]').textContent();
check("Плагины: клик по .ts ставит плагин", (installNote ?? "").includes("bridge"), installNote ?? "нет тоста");

// Не-.ts в дереве не ставится: кнопка задизейблена.
const mdPick = page.locator('[data-testid="plugins-tree-pick"]', { hasText: "README.md" }).first();
check("Плагины: не-.ts в дереве задизейблен", (await mdPick.isDisabled()) === true);

await browser.close();
console.log(`\nИТОГ: ${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
