// Панель «Сравнение моделей» (docs/BATCH.md, пункт 10; docs/specs/2026-10-06-10-compare.md):
// бейдж модели в шапке открывает панель, «Выбрать» меняет модель текущего чата.
//
//   python -X utf8 tools/run_checks.py compare
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: вне окна мост отдаёт фикстуру
// (src/fixtureCompare.ts, состояния `?состояние=сравнение…`).
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
const PANEL = '[data-testid="compare-panel"]';
const BADGE = '[data-testid="model-badge"]';
const SEARCH = '[data-testid="compare-search"]';
const REFRESH = '[data-testid="compare-refresh"]';
const ROW = '[data-testid="compare-row"]';
const CHOOSE = '[data-testid="compare-choose"]';

const panelText = (page) =>
  page.$eval(PANEL, (el) => el.textContent.replace(/\s+/g, " ").trim());
const rows = (page) =>
  page.$$eval(`${PANEL} ${ROW}`, (els) => els.map((el) => el.getAttribute("data-model")));
const chooseButtons = (page) =>
  page.$$eval(`${PANEL} ${CHOOSE}`, (els) =>
    els.map((el) => `${el.getAttribute("data-model")}:${el.textContent.trim()}:${el.disabled ? "выкл" : "вкл"}`),
  );
const badgeText = (page) => page.$eval(BADGE, (el) => el.textContent.trim());
const expanded = (page) =>
  page.$eval(`${PANEL} ${ROW}[aria-expanded="true"]`, (el) => el.getAttribute("data-model")).catch(() => null);

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: WIDE });
    // Нейтральное состояние: панель сравнения открывается бейджем, а не адресом —
    // в состояниях `?состояние=сравнение*` панель уже открыта (это кадры снимков).
    await page.goto(`${url}?состояние=пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // а) Клик по бейджу модели открывает панель ----------------------------------------
    try {
      await page.waitForSelector(BADGE, { timeout: 15_000 });
    } catch {
      done(1, "в шапке чата нет бейджа модели [data-testid=model-badge] — входа панели не существует");
    }
    await page.click(BADGE);
    try {
      await page.waitForSelector(PANEL, { timeout: 5000 });
    } catch {
      done(1, "клик по бейджу модели не открыл панель «Сравнение моделей»: нет [data-testid=compare-panel]");
    }
    // Панель открылась — фокус сразу в поиск (спека «Клавиатура»), бейдж нажат.
    const pressed = await page.$eval(BADGE, (el) => el.getAttribute("aria-pressed"));
    if (pressed !== "true") {
      done(1, `у открытого бейджа модели нет aria-pressed=true: ${pressed ?? "атрибута нет"}`);
    }
    const focused = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? "",
    );
    if (focused !== "compare-search") {
      done(1, `панель открылась, но фокус не в поиске: «${focused || "ничего не в фокусе"}»`);
    }

    // б) Шапка панели: заголовок, подзаголовок с источником, дата, кнопки --------------
    let text = await panelText(page);
    for (const part of [
      "Сравнение моделей",
      "Цена за 1 млн токенов, контекст, бенчмарки. Источник: opencode.ai",
      "Обновлено",
      "Обновить",
    ]) {
      if (!text.includes(part)) {
        done(1, `в шапке панели нет «${part}»: «${text.slice(0, 160)}»`);
      }
    }
    for (const part of ["Модель", "Ввод", "Вывод", "Контекст", "Оценка"]) {
      if (!text.includes(part)) {
        done(1, `в панели нет столбца «${part}» — таблицу не собрать`);
      }
    }

    // в) Строки каталога фикстуры: имена, цены моно, контекст, оценка -------------------
    text = await panelText(page);
    for (const part of ["Claude Sonnet 5.5", "$2.00", "$10.00", "1M", "70.6%", "North Mini Code", "256K"]) {
      if (!text.includes(part)) {
        done(1, `в таблице моделей нет «${part}»: «${text.slice(0, 200)}»`);
      }
    }
    const seen = await rows(page);
    for (const id of ["anthropic/claude-sonnet-5-5", "cohere/north-mini-code-1-0", "alibaba/qwen-image-2.1"]) {
      if (!seen.includes(id)) {
        done(1, `в каталоге нет строки «${id}»: есть ${seen.join(", ")}`);
      }
    }

    // г) Текущая модель помечена «Выбрана» (кнопка выключена), недоступная — «Нет у провайдера»
    const buttons = await chooseButtons(page);
    const chosen = buttons.find((one) => one.startsWith("zhipuai/glm-5.3-flash:"));
    if (!chosen || !chosen.endsWith(":Выбрана:выкл")) {
      done(1, `текущая модель (GLM-5.3 High) не помечена «Выбрана» выключенной кнопкой: ${buttons.join(" | ")}`);
    }
    const unavailable = buttons.find((one) => one.startsWith("deepseek/deepseek-v4-1-flash:"));
    if (!unavailable || !unavailable.endsWith(":выкл")) {
      done(1, `у модели «Нет у провайдера» кнопка «Выбрать» включена: ${buttons.join(" | ")}`);
    }
    text = await panelText(page);
    if (!text.includes("Нет у провайдера")) {
      done(1, "в панели нет пометки «Нет у провайдера» — недоступную модель видно не по чему");
    }

    // д) Модель без бенчмарков: «—» в столбце «Оценка» ---------------------------------
    const noBench = await page.$eval(`${PANEL} ${ROW}[data-model="alibaba/qwen-image-2.1"]`, (el) =>
      el.textContent.replace(/\s+/g, " "),
    );
    if (!noBench.includes("—")) {
      done(1, `у модели без бенчмарков в столбце «Оценка» нет «—»: «${noBench.trim()}»`);
    }

    // е) Клик по строке раскрывает подробности; открыт один раскрытий ------------------
    await page.click(`${PANEL} ${ROW}[data-model="cohere/north-mini-code-1-0"]`);
    try {
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="compare-panel"] [data-testid="compare-details"]') !== null,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "клик по строке North Mini Code не раскрыл подробности: нет [data-testid=compare-details]");
    }
    text = await panelText(page);
    for (const part of [
      "Cohere coding model",
      "Цена за 1 млн: Ввод $0.00 · Вывод $0.00",
      "Выпущена 2026-06-09",
      "SWE-Bench Verified",
      "67.6%",
      "Open weights",
    ]) {
      if (!text.includes(part)) {
        done(1, `в раскрытии North Mini Code нет «${part}»: «${text.slice(0, 260)}»`);
      }
    }
    // У раскрытой бесплатные цены нет «Из кэша»: cache-цены у North нет.
    if (text.includes("Из кэша") && text.indexOf("Из кэша") < text.indexOf("Выпущена")) {
      done(1, "в раскрытии North Mini Code есть «Из кэша», которого у модели нет");
    }
    await page.click(`${PANEL} ${ROW}[data-model="anthropic/claude-sonnet-5-5"]`);
    const nowExpanded = await expanded(page);
    if (nowExpanded !== "anthropic/claude-sonnet-5-5") {
      done(1, `клик по другой строке не перенёс раскрытие: открыто «${nowExpanded}»`);
    }
    // У Claude — цена из кэша и Elo-метрика.
    text = await panelText(page);
    for (const part of ["Из кэша $0.20", "1844 Elo", "Reasoning · Tool call"]) {
      if (!text.includes(part)) {
        done(1, `в раскрытии Claude Sonnet 5.5 нет «${part}»: «${text.slice(0, 260)}»`);
      }
    }

    // ж) Поиск фильтрует строки; пусто в поиске — своё состояние ------------------------
    await page.fill(SEARCH, "qwen");
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="compare-panel"] [data-testid="compare-row"]').length === 1,
      undefined,
      { timeout: 5000 },
    );
    const left = (await rows(page))[0];
    if (left !== "alibaba/qwen-image-2.1") {
      done(1, `поиск «qwen» оставил строку «${left}», а не Qwen-Image-2.1`);
    }
    await page.fill(SEARCH, "ничего такого нет");
    try {
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="compare-panel"]').innerText.includes("Ничего не нашлось"),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "пустой поиск не показал «Ничего не нашлось»");
    }
    await page.fill(SEARCH, "");

    // з) «Выбрать» меняет модель текущего чата: бейдж обновился, панель закрылась -------
    await page.click(`${PANEL} ${ROW}[data-model="cohere/north-mini-code-1-0"]`);
    await page.click(`${PANEL} ${CHOOSE}[data-model="cohere/north-mini-code-1-0"]`);
    try {
      await page.waitForFunction(
        (want) => document.querySelector('[data-testid="model-badge"]')?.textContent.trim() === want,
        "North Mini Code",
        { timeout: 5000 },
      );
    } catch {
      done(1, `после «Выбрать» бейдж шапки показывает «${await badgeText(page)}», а не «North Mini Code»`);
    }
    if (await page.isVisible(PANEL)) {
      done(1, "после «Выбрать» панель осталась открытой — выбор не вернул сценарий разговора");
    }

    // и) Повторный клик по бейджу открывает и закрывает панель --------------------------
    await page.click(BADGE);
    if (!(await page.isVisible(PANEL))) {
      done(1, "повторный клик по бейджу не открыл панель снова");
    }
    await page.click(BADGE);
    try {
      await page.waitForSelector(PANEL, { state: "detached", timeout: 5000 });
    } catch {
      done(1, "второй клик по бейджу не закрыл панель");
    }

    // к) Esc закрывает панель -----------------------------------------------------------
    await page.click(BADGE);
    await page.waitForSelector(PANEL, { timeout: 5000 });
    await page.keyboard.press("Escape");
    try {
      await page.waitForSelector(PANEL, { state: "detached", timeout: 5000 });
    } catch {
      done(1, "Esc не закрыл панель «Сравнение моделей»");
    }
    // Esc возвращает фокус бейджу, как и путь ✕ (спека «Клавиатура»): вернуть фокус
    // некуда, если поиск панели остался в DOM — проверяем до следующего клика.
    const back = await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid") ?? "",
    );
    if (back !== "model-badge") {
      done(1, `Esc закрыл панель, но фокус не вернулся бейджу модели: «${back || "ничего не в фокусе"}»`);
    }

    // л) «Обновить» перечитывает каталог (фикстура отвечает свежим списком) --------------
    await page.click(BADGE);
    await page.waitForSelector(PANEL, { timeout: 5000 });
    await page.click(REFRESH);
    try {
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="compare-panel"]').innerText.includes("Claude Sonnet 5.5"),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "клик по «Обновить» не вернул каталог моделей");
    }

    // м) Загрузка без кэша: строка ожидания, «Обновить» выключена.
    // Состояние `сравнение-загрузка` — панель уже открыта адресом; бейдж закрыл бы её.
    const loading = await browser.newPage({ viewport: WIDE });
    await loading.goto(`${url}?состояние=сравнение-загрузка`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await loading.waitForSelector(PANEL, { timeout: 15_000 });
    const waiting = await panelText(loading);
    if (!waiting.includes("Читаю каталог моделей…")) {
      done(1, `при загрузке каталога панель не сказала «Читаю каталог моделей…»: «${waiting.slice(0, 160)}»`);
    }
    const refresh = await loading.$eval(REFRESH, (el) => ({ disabled: el.disabled, title: el.title }));
    if (!refresh.disabled) {
      done(1, "при загрузке каталога кнопка «Обновить» включена — повторный запрос в сеть не запрещён");
    }

    // н) Сайт недоступен, кэша нет: ошибка и подсказка ----------------------------------
    const error = await browser.newPage({ viewport: WIDE });
    await error.goto(`${url}?состояние=сравнение-ошибка`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await error.waitForSelector(PANEL, { timeout: 15_000 });
    const failed = await panelText(error);
    for (const part of ["Сайт opencode.ai недоступен", "Данные ещё не загружались — нажмите «Обновить» позже"]) {
      if (!failed.includes(part)) {
        done(1, `без кэша и без сети в панели нет «${part}»: «${failed.slice(0, 200)}»`);
      }
    }

    // о) Сайт недоступен, кэш есть: таблица из кэша и пометка с датой --------------------
    const cached = await browser.newPage({ viewport: WIDE });
    await cached.goto(`${url}?состояние=сравнение-кэш`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await cached.waitForSelector(PANEL, { timeout: 15_000 });
    await cached.waitForSelector(`${PANEL} ${ROW}`, { timeout: 15_000 });
    const stale = await panelText(cached);
    for (const part of ["Сайт недоступен — данные от 6 окт, 07:38", "Claude Sonnet 5.5"]) {
      if (!stale.includes(part)) {
        done(1, `при недоступном сайте с кэшем в панели нет «${part}»: «${stale.slice(0, 200)}»`);
      }
    }
    const refresh2 = await cached.$eval(REFRESH, (el) => el.disabled);
    if (refresh2) {
      done(1, "при кэше кнопка «Обновить» выключена — данные с сайта перечитать нечем");
    }

    done(
      0,
      "бейдж модели открывает панель «Сравнение моделей» с каталогом фикстуры (цены, контекст, оценка), «Выбрана» помечает текущую, «Нет у провайдера» выключает «Выбрать», клик строки раскрывает подробности (одна за раз), поиск фильтрует, «Выбрать» меняет модель чата и закрывает панель, бейдж и Esc закрывают, загрузка/ошибка/кэш показывают свои состояния",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий сравнения моделей упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
