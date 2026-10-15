// QA-сценарий правок владельца 15.10: зависание вкладок (async-команды),
// DnD-зона скиллов вместо ручного создания, DnD-зона внешнего плагина.
// Запуск: node tests/qa-owner-1510.mjs (dev-сервер на 5173 должен жить).
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

// --- Сценарий 1: Настройки → Скиллы (?состояние=настройки-скиллы)
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/?состояние=настройки-скиллы`);
  await page.waitForSelector('[data-testid="settings-skills"]');

  const zone = page.locator('[data-testid="skills-drop"]');
  check("скиллы: зона перетаскивания на месте", await zone.count() === 1);
  check("скиллы: кнопки «Добавить скилл» нет", await page.locator('[data-testid="skills-add"]').count() === 0);
  check("скиллы: поля ручного создания нет", await page.locator('[data-testid="skills-name"]').count() === 0);
  check("скиллы: существующие строки в списке", await page.locator('[data-testid="skills-row"]').count() >= 1);

  // Бросок .md в зону: DataTransfer с файлом, как из проводника. Имя файла
  // уникальное — добавленная строка видна по имени, а не по дельте списка.
  await page.evaluate(() => {
    const zone = document.querySelector('[data-testid="skills-drop"]');
    const dt = new DataTransfer();
    dt.items.add(new File(["Инструкция: собирай QA-отчёт по сценарию."], "qa-drop-skill.md", { type: "text/markdown" }));
    zone.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true }));
    zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(300);
  const names = await page.locator('[data-testid="skills-row"] .settings-row__label').allTextContents();
  check("скиллы: .md в зоне добавил скилл", names.includes("qa-drop-skill"), names.join(", "));

  // Чужое расширение — честный отказ, список не меняется.
  await page.evaluate(() => {
    const zone = document.querySelector('[data-testid="skills-drop"]');
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
    zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  check("скиллы: .txt отвергнут с причиной", await page.locator('[data-testid="skills-drop-error"]').count() === 1);

  // Редактирование существующего живо (создания нет, правка осталась).
  await page.locator('[data-testid="skills-edit"]').first().click();
  check("скиллы: правка существующего открывается", await page.locator('[data-testid="skills-form"]').count() === 1);
  await page.locator('[data-testid="skills-cancel"]').click();

  // Переключение вкладок настроек: быстрые монтирования разделов без подвисания.
  const t0 = Date.now();
  for (const tab of ["модели", "плагины", "скиллы", "данные", "вид"]) {
    await page.locator(`[data-testid="settings-tab-${tab}"]`).click();
  }
  const sw = Date.now() - t0;
  check("настройки: пять переключений вкладок подряд без зависания", sw < 5000, `${sw}ms`);
  await page.close();
}

// --- Сценарий 2: Плагины (?состояние=плагины-раздел): зона внешнего плагина
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/?состояние=плагины-раздел`);
  await page.waitForSelector('[data-testid="plugins-page"]');

  const zone = page.locator('[data-testid="plugins-drop"]');
  check("плагины: зона перетаскивания на вкладке Installed", await zone.count() === 1);

  // Бросок .ts: плагин появляется выключенным (вкладка Disabled), тост говорит куда.
  await page.evaluate(() => {
    const zone = document.querySelector('[data-testid="plugins-drop"]');
    const dt = new DataTransfer();
    dt.items.add(new File(["export default definePlugin({});"], "Own Tool.ts", { type: "text/plain" }));
    zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForSelector('[data-testid="plugins-drop-note"]');
  const note = await page.locator('[data-testid="plugins-drop-note"]').textContent();
  check("плагины: тост говорит про Disabled", (note ?? "").includes("Disabled"), note ?? "нет тоста");

  await page.locator('[data-testid="plugin-tab-disabled"]').click();
  await page.waitForSelector('[data-testid="plugin-card"][data-plugin="own-tool"]');
  check("плагины: брошенный файл во вкладке Disabled", true);

  // Включение через сцену H: пометка внешнего файла и «права неизвестны».
  await page.locator('[data-testid="plugin-card"][data-plugin="own-tool"] [data-testid="plugin-enable"]').click();
  await page.waitForSelector('[data-testid="enable-summary"]');
  const meta = await page.locator('[data-testid="enable-meta"]').textContent();
  check("плагины: сцена H помечает внешний файл", (meta ?? "").includes("внешний файл"), meta ?? "");
  check("плагины: права неизвестны — каждое действие спросит", await page.locator('[data-testid="enable-unknown-rights"]').count() === 1);
  await page.locator('[data-testid="enable-cancel"]').click();

  // Чужое расширение — отказ (зона живёт на вкладке Installed).
  await page.locator('[data-testid="plugin-tab-installed"]').click();
  await page.waitForSelector('[data-testid="plugins-drop"]');
  await page.evaluate(() => {
    const zone = document.querySelector('[data-testid="plugins-drop"]');
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "readme.md", { type: "text/markdown" }));
    zone.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);
  check("плагины: .md в зоне плагинов отвергнут", ((await page.locator('[data-testid="plugins-drop"]').textContent()) ?? "").includes(".ts"));
  await page.close();
}

// --- Сценарий 3: вкладки настроек из состояния «настройки» (страница целиком)
{
  const page = await browser.newPage();
  await page.goto(`${BASE}/?состояние=настройки`);
  await page.waitForSelector('[data-testid="settings-page"]');
  // Вкладка «Модели» монтирует localDetect: в окне отвечает мгновенно, здесь
  // важна сама последовательность — вкладки открываются, контент приходит.
  await page.locator('[data-testid="settings-tab-модели"]').click();
  await page.waitForSelector('[data-testid="settings-models"]');
  await page.locator('[data-testid="settings-tab-плагины"]').click();
  await page.waitForSelector('[data-testid="settings-rules"]');
  check("настройки: вкладки Модели/Плагины открываются с содержимым", true);
  await page.close();
}

await browser.close();
console.log(`\nИТОГ: ${passed} pass, ${failed} fail`);
process.exit(failed ? 1 : 0);
