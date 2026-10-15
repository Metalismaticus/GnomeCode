// QA «через движок» (замечание владельца 15.10: для OpenCode Go форма ключа —
// ложь, ключа не существует). Запуск: node tests/qa-engine-auth.mjs.
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
await page.goto(`${BASE}/?состояние=настройки-модели`);
await page.waitForSelector('[data-testid="settings-providers"]');

const goRow = page.locator('[data-testid="settings-provider-row"][data-provider="opencode-go"]');
check("opencode-go: пометка «через движок ✓»", await goRow.locator('[data-testid="settings-engine-mark"]').count() === 1);
const goText = await goRow.textContent();
check("opencode-go: подсказка про управление в OpenCode", (goText ?? "").includes("opencode auth login"), goText ?? "");
check("opencode-go: кнопки ключа нет", await goRow.locator('[data-testid="settings-key-open"]').count() === 0);
check("opencode-go: «ключ не задан» не рисуется", await goRow.locator('[data-testid="settings-key-mark"]').count() === 0);

const anthroRow = page.locator('[data-testid="settings-provider-row"][data-provider="anthropic"]');
check("anthropic: обычная строка с ключом на месте", await anthroRow.locator('[data-testid="settings-key-open"]').count() === 1);

await browser.close();
console.log(`\nИТОГ: ${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
