// Окно настроек (docs/specs/2026-10-06-12-nastrojki.md): шестерёнка сайдбара →
// страница, смена темы применяется сразу, модель по умолчанию через панель
// сравнения в режиме «по умолчанию», значения переживают перезагрузку страницы.
//
//   node tests/ui/settings.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: фикстура зеркалит мост (src/fixture*),
// рестарт движка после ключа сценарий не видит (живой шаг владельца).
import { done, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const GEAR = '[data-testid="sidebar-settings"]';
const PAGE = '[data-testid="settings-page"]';
const THEME = '[data-testid="settings-theme-switch"]';
const BADGE = '[data-testid="model-badge"]';
const COMPARE = '[data-testid="compare-panel"]';

/** Первый вопрос в композере: чат без своей модели — бейдж сменил дефолт. */
const ask = async (page, text) => {
  await page.fill('[data-testid="composer"]', text);
  await page.click('[data-testid="send"]');
  await page.waitForSelector(BADGE, { timeout: 5000 });
};

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "настройки");
  try {

    // а) Шестерёнка сайдбара ведёт на страницу настроек ----------------------------
    try {
      await page.waitForSelector(GEAR, { timeout: 5000 });
    } catch {
      done(1, "в сайдбаре нет шестерёнки настроек: нет [data-testid=sidebar-settings] — вход в окно настроек не появился");
    }
    await page.click(GEAR);
    try {
      await page.waitForSelector(`${PAGE} [data-testid="settings-tab-вид"]`, { timeout: 5000 });
    } catch {
      done(1, "клик по шестерёнке не открыл страницу настроек: нет [data-testid=settings-page] или вкладки «Внешний вид»");
    }

    // б) Смена темы применяется к data-theme сразу (без перезапуска) ---------------
    const before = await page.$eval("html", (el) => el.getAttribute("data-theme"));
    await page.click(THEME);
    try {
      await page.waitForFunction(
        (was) => document.documentElement.getAttribute("data-theme") !== was,
        before,
        { timeout: 5000 },
      );
    } catch {
      done(1, `смена темы на странице настроек не изменила html[data-theme] (было «${before}») — применение не без перезапуска`);
    }
    const applied = await page.$eval("html", (el) => el.getAttribute("data-theme"));

    // в) Вкладка «Модели» → «Изменить →» → панель сравнения в режиме «по умолчанию»
    await page.click('[data-testid="settings-tab-модели"]');
    try {
      await page.waitForSelector('[data-testid="settings-default-model"]', { timeout: 5000 });
    } catch {
      done(1, "на вкладке «Модели» нет строки модели по умолчанию: нет [data-testid=settings-default-model]");
    }
    const wasDefault = await page.$eval(
      '[data-testid="settings-default-model"] .settings-row__main',
      (el) => el.textContent.trim(),
    );
    await page.click('[data-testid="settings-open-compare"]');
    try {
      await page.waitForSelector(COMPARE, { timeout: 5000 });
    } catch {
      done(1, "клик по «Изменить →» не открыл панель сравнения: нет [data-testid=compare-panel]");
    }
    try {
      await page.waitForFunction(
        () => document.querySelector('[data-testid="compare-panel"]')?.textContent.includes("Выбор модели по умолчанию"),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "панель сравнения из настроек открылась не в режиме «по умолчанию»: заголовка «Выбор модели по умолчанию» нет");
    }

    // г) «По умолчанию» у другой модели: дефолт сменился, бейдж чата без своей модели тоже
    await page.click('[data-testid="compare-choose"][data-model="anthropic/claude-sonnet-5-5"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );
    try {
      await page.waitForFunction(
        (was) => document.querySelector('[data-testid="settings-default-model"] .settings-row__main')?.textContent.trim() !== was,
        wasDefault,
        { timeout: 5000 },
      );
    } catch {
      done(1, `выбор «По умолчанию» не сменил строку настроек: осталось «${wasDefault}»`);
    }
    const defaultModel = await page.$eval(
      '[data-testid="settings-default-model"] .settings-row__main',
      (el) => el.textContent.trim(),
    );

    // д) Перезагрузка страницы — значения пережили её (состояние в фикстуре моста)
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector(GEAR, { timeout: 90_000 });
    await page.click(GEAR);
    await page.waitForSelector(PAGE, { timeout: 5000 });
    await page.click('[data-testid="settings-tab-модели"]');
    const after = await page.$eval(
      '[data-testid="settings-default-model"] .settings-row__main',
      (el) => el.textContent.trim(),
    );
    if (after !== defaultModel) {
      done(1, `после перезагрузки страницы модель по умолчанию потерялась: было «${defaultModel}», стало «${after}»`);
    }
    await page.$eval("html", (el, want) => {
      if (document.documentElement.getAttribute("data-theme") !== want) {
        throw new Error(`тема не та: ${document.documentElement.getAttribute("data-theme")}`);
      }
    }, applied);

    // е) Бейдж чата без собственной модели сменился дефолтом; с моделью — нет ------
    await page.click('[data-testid="chat-active"]');
    await page.waitForSelector(BADGE, { timeout: 5000 });
    const badge = await page.$eval(BADGE, (el) => el.textContent.trim());
    if (badge !== defaultModel) {
      done(1, `бейдж чата без своей модели показывает «${badge}», а не новый дефолт «${defaultModel}»`);
    }
    await ask(page, "Вопрос с моделью этого чата");
    let ownBadge = await page.$eval(BADGE, (el) => el.textContent.trim());

    // ж) Бейдж чата открывает панель в режиме чата: «Выбрать» даёт чату свою модель
    await page.click(BADGE);
    try {
      await page.waitForFunction(
        () => document.querySelector('[data-testid="compare-panel"]')?.textContent.includes("Сравнение моделей"),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "клик по бейджу чата не открыл панель сравнения в режиме чата: заголовка «Сравнение моделей» нет");
    }
    await page.waitForSelector('[data-testid="compare-choose"][data-model="zhipuai/glm-5.3-flash"]', { timeout: 5000 });
    await page.click('[data-testid="compare-choose"][data-model="zhipuai/glm-5.3-flash"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );
    ownBadge = await page.$eval(BADGE, (el) => el.textContent.trim());
    if (ownBadge === defaultModel) {
      done(1, `«Выбрать» у другой модели не дала чату свою модель: бейдж остался «${ownBadge}»`);
    }

    // з) Смена дефолта из настроек не трогает бейдж чата со своей моделью -----------
    await page.click(GEAR);
    await page.waitForSelector(PAGE, { timeout: 5000 });
    await page.click('[data-testid="settings-tab-модели"]');
    await page.click('[data-testid="settings-open-compare"]');
    await page.waitForFunction(
      () => document.querySelector('[data-testid="compare-panel"]')?.textContent.includes("Выбор модели по умолчанию"),
      undefined,
      { timeout: 5000 },
    );
    await page.waitForSelector('[data-testid="compare-choose"][data-model="cohere/north-mini-code-1-0"]', { timeout: 5000 });
    await page.click('[data-testid="compare-choose"][data-model="cohere/north-mini-code-1-0"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );
    const secondDefault = await page.$eval(
      '[data-testid="settings-default-model"] .settings-row__main',
      (el) => el.textContent.trim(),
    );
    if (secondDefault === defaultModel) {
      done(1, `второй выбор «По умолчанию» не сменил строку настроек: осталось «${secondDefault}»`);
    }
    await page.click('[data-testid="chat-active"]');
    const keptBadge = await page.$eval(BADGE, (el) => el.textContent.trim());
    if (keptBadge !== ownBadge) {
      done(1, `смена дефолта тронула бейдж чата со своей моделью: был «${ownBadge}», стал «${keptBadge}»`);
    }

    await done(
      0,
      `шестерёнка открывает страницу настроек; смена темы применила html[data-theme] («${before}» → «${applied}») сразу; «Изменить →» открыл панель в режиме «по умолчанию», «По умолчанию» сменил дефолт («${wasDefault}» → «${defaultModel}») и бейдж чата без своей модели; перезагрузка — значения на месте; бейдж чата с собственной моделью остался «${ownBadge}»`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий окна настроек упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
