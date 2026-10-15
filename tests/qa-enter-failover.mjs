// QA «Enter-отправка, очередь, failover на ошибке модели» (замечания владельца
// 15.10, вечер-2). Запуск: node tests/qa-enter-failover.mjs (dev-сервер на 5173).
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

// --- Enter отправляет: вопрос появляется в ленте.
await page.goto(`${BASE}/`);
await page.waitForSelector('[data-testid="composer"]');
await page.locator('[data-testid="composer"]').fill("тест Enter-отправки");
await page.keyboard.press("Enter");
await page.waitForTimeout(200);
const feed = await page.locator('[data-testid="feed"]').textContent();
check("Enter отправляет вопрос", (feed ?? "").includes("тест Enter-отправки"));

// --- Очередь (?медленно=1): во время ответа второй вопрос встаёт в очередь
// и уезжает сам, когда первый завершён.
await page.goto(`${BASE}/?медленно=1`);
await page.waitForSelector('[data-testid="composer"]');
await page.locator('[data-testid="composer"]').fill("вопрос первый");
await page.keyboard.press("Enter");
await page.waitForTimeout(150);
await page.locator('[data-testid="composer"]').fill("вопрос второй");
await page.keyboard.press("Enter");
await page.waitForSelector('[data-testid="queue-chip"]');
const chip = await page.locator('[data-testid="queue-chip"]').first().textContent();
check("очередь: второй вопрос в чипе во время ответа", (chip ?? "").includes("вопрос второй"), chip ?? "");
await page.waitForTimeout(500);
let secondIn = true;
try {
  // Ответ на второй тоже едет медленно — ждём его строку в ленте явно;
  // после её появления чипов остаться не должно (очередь разгружена).
  await page.waitForFunction(
    (needle) => document.querySelector('[data-testid="feed"]')?.textContent?.includes(needle),
    "вопрос второй",
    { timeout: 8000 },
  );
} catch {
  secondIn = false;
}
await page.waitForTimeout(300);
const chipsLeft = await page.locator('[data-testid="queue-chip"]').count();
const feedAfter = await page.locator('[data-testid="feed"]').textContent();
check(
  "очередь: чип уехал, оба вопроса в ленте",
  chipsLeft === 0 && secondIn && (feedAfter ?? "").includes("вопрос первый"),
  `чипов: ${chipsLeft}, второй в ленте: ${secondIn}`,
);
// Убрать из очереди: три вопроса на чистой странице, средний снимаем крестиком.
await page.goto(`${BASE}/?медленно=1`);
await page.waitForSelector('[data-testid="composer"]');
await page.locator('[data-testid="composer"]').fill("раз");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
await page.locator('[data-testid="composer"]').fill("два");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);
await page.locator('[data-testid="composer"]').fill("три");
await page.keyboard.press("Enter");
await page.waitForSelector('[data-testid="queue-chip"]');
await page.locator('[data-testid="queue-chip"]').nth(1).locator('[data-testid="queue-chip-close"]').click();
// «раз» уходит сразу, «два» — когда «раз» доехал (медленный мост 1.5 с), «три» снят.
await page.waitForTimeout(7000);
const feedFinal = await page.locator('[data-testid="feed"]').textContent();
check("очередь: «раз» и «два» уехали, снятый «три» — нет", (feedFinal ?? "").includes("раз") && (feedFinal ?? "").includes("два") && !(feedFinal ?? "").includes("три"), feedFinal?.slice(-250) ?? "");

// --- Failover на обеих формах ошибки модели (?состояние=фейловер).
await page.goto(`${BASE}/?состояние=фейловер`);
await page.waitForSelector('[data-testid="feed"]');
await page.waitForTimeout(300);
const hints = await page.locator('[data-testid="feed-failover"]').count();
check("фейловер: подсказка под обеими ошибками модели", hints === 2, `${hints} подсказок`);
const ask = await page.locator('[data-testid="feed-failover"]').first().textContent();
check("фейловер: текст предлагает переключение", (ask ?? "").includes("Переключиться на"), ask ?? "");

await browser.close();
console.log(`\nИТОГ: ${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
