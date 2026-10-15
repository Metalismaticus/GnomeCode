// QA «доделывай всё, что позже» (запрос владельца 15.10): пункты меню «+» без
// «позже», память чата, вкладки Символы/Git правой панели.
// Запуск: node tests/qa-later-items.mjs (dev-сервер на 5173 должен жить).
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

// Проект выбран + правая панель открыта адресом: дерево, символы и git на кадре.
await page.goto(`${BASE}/?состояние=проект&правая=открыта`);
await page.waitForSelector('[data-testid="chat"]');
await page.waitForSelector('[data-testid="context-panel"]');

// --- Меню «+»: все пункты активны, слова «позже» нет нигде.
await page.locator('[data-testid="composer-add"]').click();
await page.waitForSelector('[data-testid="add-menu"]');
const menuText = await page.locator('[data-testid="add-menu"]').textContent();
check("меню «+»: слова «позже» нет", !(menuText ?? "").includes("позже"));
check("меню «+»: восемь активных пунктов", await page.locator('[data-testid="add-menu"] button[role="menuitem"]:not([disabled])').count() === 8);

// «Прикрепить файл»: фикстура отдаёт README корня — чип появляется.
await page.locator('[data-testid="add-attach-file"]').click();
await page.waitForSelector('[data-testid="add-menu"]', { state: "detached" });
await page.waitForSelector('[data-testid="context-chip"]');
const chips = await page.locator('[data-testid="context-chip"]').allTextContents();
check("«Прикрепить файл»: чип README в композере", chips.some((t) => (t ?? "").includes("README.md")), chips.join(", "));

// «Весь проект»: файлы корня прикрепляются (package.json догоняет).
await page.locator('[data-testid="composer-add"]').click();
await page.locator('[data-testid="add-whole-project"]').click();
await page.waitForTimeout(150);
const chipsAll = await page.locator('[data-testid="context-chip"]').allTextContents();
check("«Весь проект»: файлы корня в чипах", chipsAll.some((t) => (t ?? "").includes("package.json")), chipsAll.join(", "));

// «Терминал»: вызов дошёл до моста (фикстура ставит флаг страницы).
await page.locator('[data-testid="composer-add"]').click();
await page.locator('[data-testid="add-terminal"]').click();
await page.waitForTimeout(150);
check("«Терминал»: мост позван", await page.evaluate(() => Boolean(window.__terminalOpened)));

// «MCP-серверы»: настройки открываются на вкладке «Плагины».
await page.locator('[data-testid="composer-add"]').click();
await page.locator('[data-testid="add-mcp"]').click();
await page.waitForSelector('[data-testid="settings-page"]');
const mcpTab = page.locator('[data-testid="settings-tab-плагины"]');
check("«MCP-серверы»: настройки на вкладке «Плагины»", (await mcpTab.getAttribute("aria-selected")) === "true");
await page.keyboard.press("Escape");
await page.waitForSelector('[data-testid="chat"]');

// «Память чата»: окно открывается, сохранённый текст возвращается при переоткрытии.
await page.locator('[data-testid="composer-add"]').click();
await page.locator('[data-testid="add-chat-memory"]').click();
await page.waitForSelector('[data-testid="memory-dialog"]');
await page.locator('[data-testid="memory-text"]').fill("Отвечай кратко, проект на React");
await page.locator('[data-testid="memory-save"]').click();
await page.waitForSelector('[data-testid="memory-dialog"]', { state: "detached" });
await page.locator('[data-testid="composer-add"]').click();
await page.locator('[data-testid="add-chat-memory"]').click();
await page.waitForSelector('[data-testid="memory-dialog"]');
const held = await page.locator('[data-testid="memory-text"]').inputValue();
check("«Память чата»: текст пережил закрытие", held === "Отвечай кратко, проект на React", held);
await page.keyboard.press("Escape");

// Память не видна в ленте: вопрос уходит как вопрос.
await page.locator('[data-testid="composer"]').fill("сделай доклад");
await page.locator('[data-testid="send"]').click();
await page.waitForTimeout(200);
const feed = await page.locator('[data-testid="feed"]').textContent();
check("память не светится в ленте", (feed ?? "").includes("сделай доклад") && !(feed ?? "").includes("Отвечай кратко"), feed?.slice(0, 120) ?? "");

// --- Правая панель: «Символы» и «Git» без «позже». Панель могла закрыться
// кликами по чату (она оверлей) — переоткрываем меню «⋯» → «Контекст проекта».
await page.locator('[data-testid="header-more"]').click();
const panelVisible = await page.locator('[data-testid="context-panel"]').isVisible();
if (!panelVisible) {
  await page.locator('[data-testid="menu-context"]').click();
}
await page.waitForSelector('[data-testid="context-panel"]');
check("правая панель: слова «позже» нет", !((await page.locator('[data-testid="context-panel"]').textContent()) ?? "").includes("позже"));
await page.locator('[role="tab"]', { hasText: "Символы" }).click();
await page.waitForSelector('[data-testid="symbols-list"]');
const symbols = await page.locator('[data-testid="tree-symbol"]').count();
check("вкладка «Символы»: список по приложенным файлам", symbols >= 4, `${symbols} строк`);
await page.locator('[role="tab"]', { hasText: "Git" }).click();
await page.waitForSelector('[data-testid="git-status"]');
const branch = await page.locator('[data-testid="git-branch"]').textContent();
check("вкладка «Git»: ветка показана", branch === "main", branch ?? "");

// Клик по изменённому файлу подсвечивает его в дереве: вкладка «Файлы» не сбилась.
await page.locator('[data-testid="git-change"]').first().click();
await page.waitForTimeout(150);
check("«Git»: клик по файлу не роняет панель", await page.locator('[data-testid="context-panel"]').isVisible());

await browser.close();
console.log(`\nИТОГ: ${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
