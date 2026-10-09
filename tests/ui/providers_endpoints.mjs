// Свои endpoints и включённость провайдеров (docs/BATCH.md, пункт 1 партии):
// «Добавить endpoint» с именем и базой URL заводит строку с ключом, модели
// endpoint'а появляются в секции «Модели движка» переключателя чата ценой «—»,
// выключение провайдера прячет их, включение возвращает, endpoint удаляется.
//
//   node tests/ui/providers_endpoints.mjs
// Итог: код возврата и последняя строка вывода (tests/lib/runner_lib.py).
// Страница интерфейса с фикстурой: тихий рестарт движка после добавления
// сценарий не видит — живой путь движка стерегут cargo-тесты
// (tests/checks/providers_store.py).
import { done, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const PAGE = '[data-testid="settings-page"]';
const COMPARE = '[data-testid="compare-panel"]';
const ENDPOINT_ID = "llm-corp-local";
const ENDPOINT_MODEL = `${ENDPOINT_ID}/corp-model-a`;

/** Кнопка переключателя внутри строки провайдера. */
const toggleOf = (page, provider) =>
  page.$(`[data-testid="settings-provider-row"][data-provider="${provider}"] [data-testid="settings-provider-toggle"]`);

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "настройки-модели");
  try {

    // а) Раздел показывает провайдеров движка и кнопку «Добавить endpoint» ------
    try {
      await page.waitForSelector('[data-testid="settings-provider-row"][data-provider="zhipuai"]', { timeout: 5000 });
    } catch {
      done(1, "в разделе «Провайдеры и ключи» нет строки движка ZhipuAI: нет [data-testid=settings-provider-row][data-provider=zhipuai]");
    }
    try {
      await page.waitForSelector('[data-testid="settings-endpoint-add"]', { timeout: 5000 });
    } catch {
      done(1, "в разделе «Провайдеры и ключи» нет кнопки «Добавить endpoint»: нет [data-testid=settings-endpoint-add]");
    }
    await page.click('[data-testid="settings-endpoint-add"]');

    // б) Форма endpoint'а: имя + база URL + ключ, пустые имя/адрес не сохраняются
    try {
      await page.waitForSelector('[data-testid="settings-endpoint-form"]', { timeout: 5000 });
    } catch {
      done(1, "клик «Добавить endpoint» не открыл форму: нет [data-testid=settings-endpoint-form]");
    }
    const emptySave = await page.$eval('[data-testid="settings-endpoint-save"]', (el) => el.disabled);
    if (!emptySave) {
      done(1, "форма endpoint'а без имени и адреса сохраняет: кнопка [data-testid=settings-endpoint-save] не выключена");
    }
    await page.fill('[data-testid="settings-endpoint-name"]', "Корпоративный прокси");
    await page.fill('[data-testid="settings-endpoint-url"]', "http://llm.corp.local/v1");
    await page.fill('[data-testid="settings-endpoint-key"]', "sk-corp-test");

    // в) «Сохранить» → строка endpoint'а с пометкой и ключом ---------------------
    await page.click('[data-testid="settings-endpoint-save"]');
    try {
      await page.waitForSelector(`[data-testid="settings-provider-row"][data-provider="${ENDPOINT_ID}"]`, { timeout: 5000 });
    } catch {
      done(1, `после сохранения нет строки endpoint'а: нет [data-testid=settings-provider-row][data-provider=${ENDPOINT_ID}]`);
    }
    try {
      await page.waitForFunction(
        (id) => document
          .querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`)
          ?.textContent.includes("endpoint"),
        ENDPOINT_ID,
        { timeout: 5000 },
      );
    } catch {
      done(1, "строка endpoint'а без пометки «endpoint» — не отличить от провайдеров движка");
    }
    try {
      await page.waitForFunction(
        (id) => document
          .querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`)
          ?.textContent.includes("ключ задан"),
        ENDPOINT_ID,
        { timeout: 5000 },
      );
    } catch {
      done(1, "у строки endpoint'а ключ не показан как «задан» — ключ не сохранился");
    }

    // г) Панель сравнения: секция «Модели движка» с моделью endpoint'а, цена «—» -
    await page.click('[data-testid="settings-open-compare"]');
    try {
      await page.waitForSelector(COMPARE, { timeout: 5000 });
    } catch {
      done(1, "«Изменить →» не открыл панель сравнения: нет [data-testid=compare-panel]");
    }
    try {
      await page.waitForSelector('[data-testid="compare-engine-section"]', { timeout: 5000 });
    } catch {
      done(1, "в панели сравнения нет секции «Модели движка»: нет [data-testid=compare-engine-section]");
    }
    try {
      await page.waitForSelector(`[data-testid="compare-row"][data-model="${ENDPOINT_MODEL}"]`, { timeout: 5000 });
    } catch {
      done(1, `в секции «Модели движка» нет модели endpoint'а: нет [data-model=${ENDPOINT_MODEL}]`);
    }
    const engineRow = await page.$eval(`[data-testid="compare-row"][data-model="${ENDPOINT_MODEL}"]`, (el) => {
      const text = el.textContent.replace(/\s+/g, " ").trim();
      const choose = el.querySelector('[data-testid="compare-choose"]');
      return { text, chooseDisabled: choose ? choose.disabled : null };
    });
    if (!engineRow.text.includes("—")) {
      done(1, `строка модели endpoint'а не с пустой ценой «—»: «${engineRow.text}»`);
    }
    if (engineRow.chooseDisabled !== false) {
      done(1, "у модели endpoint'а «Выбрать» выключена — модель движка должна выбираться как обычная");
    }
    await page.click(`[data-testid="compare-choose"][data-model="${ENDPOINT_MODEL}"]`);
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );

    // д) Выключение endpoint'а: пометка «выключен», модель уходит из переключателя
    const off = await toggleOf(page, ENDPOINT_ID);
    if (!off) {
      done(1, `у строки endpoint'а нет переключателя включённости: нет [data-testid=settings-provider-toggle] в [data-provider=${ENDPOINT_ID}]`);
    }
    await off.click();
    try {
      await page.waitForFunction(
        (id) => document
          .querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`)
          ?.textContent.includes("выключен"),
        ENDPOINT_ID,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после выключения у строки endpoint'а нет пометки «выключен»");
    }
    await page.click('[data-testid="settings-open-compare"]');
    await page.waitForSelector(COMPARE, { timeout: 5000 });
    try {
      await page.waitForFunction(
        (model) => !document.querySelector(`[data-testid="compare-row"][data-model="${model}"]`),
        ENDPOINT_MODEL,
        { timeout: 5000 },
      );
    } catch {
      done(1, `выключенный endpoint остался в переключателе: [data-model=${ENDPOINT_MODEL}] на месте`);
    }
    await page.click('[data-testid="compare-close"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );

    // е) Включение возвращает модель в секцию ------------------------------------
    const on = await toggleOf(page, ENDPOINT_ID);
    await on.click();
    try {
      await page.waitForFunction(
        (id) => !document
          .querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`)
          ?.textContent.includes("выключен"),
        ENDPOINT_ID,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после включения пометка «выключен» осталась у строки endpoint'а");
    }
    await page.click('[data-testid="settings-open-compare"]');
    await page.waitForSelector(COMPARE, { timeout: 5000 });
    try {
      await page.waitForSelector(`[data-testid="compare-row"][data-model="${ENDPOINT_MODEL}"]`, { timeout: 5000 });
    } catch {
      done(1, "включение endpoint'а не вернуло его модель в секцию «Модели движка»");
    }
    await page.click('[data-testid="compare-close"]');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="compare-panel"]'),
      undefined,
      { timeout: 5000 },
    );

    // ж) Удаление endpoint'а: строка и модель исчезают ----------------------------
    const remove = await page.$(`[data-testid="settings-provider-row"][data-provider="${ENDPOINT_ID}"] [data-testid="settings-endpoint-remove"]`);
    if (!remove) {
      done(1, `у строки endpoint'а нет кнопки удаления: нет [data-testid=settings-endpoint-remove] в [data-provider=${ENDPOINT_ID}]`);
    }
    await remove.click();
    try {
      await page.waitForFunction(
        (id) => !document.querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`),
        ENDPOINT_ID,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после удаления строка endpoint'а осталась в разделе");
    }

    // з) Провайдер движка тоже выключается ----------------------------------------
    const groqToggle = await toggleOf(page, "zhipuai");
    if (!groqToggle) {
      done(1, "у провайдера движка нет переключателя включённости: нет [data-testid=settings-provider-toggle] в [data-provider=zhipuai]");
    }
    await groqToggle.click();
    try {
      await page.waitForFunction(
        (id) => document
          .querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`)
          ?.textContent.includes("выключен"),
        "zhipuai",
        { timeout: 5000 },
      );
    } catch {
      done(1, "выключение провайдера движка не поставило пометку «выключен» на его строке");
    }
    await groqToggle.click();
    try {
      await page.waitForFunction(
        (id) => !document
          .querySelector(`[data-testid="settings-provider-row"][data-provider="${id}"]`)
          ?.textContent.includes("выключен"),
        "zhipuai",
        { timeout: 5000 },
      );
    } catch {
      done(1, "включение провайдера движка не сняло пометку «выключен»");
    }

    await done(
      0,
      "«Добавить endpoint» завёл строку с ключом и пометкой endpoint; его модель появилась в секции «Модели движка» ценой «—» и выбралась по умолчанию; выключение спрятало модель и пометило строку «выключен», включение вернуло; удаление убрало строку; провайдер движка ZhipuAI выключился и включился своим переключателем",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий endpoints и провайдеров упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
