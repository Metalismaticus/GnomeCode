// Один полный цикл шагами пользователя: открыть проект → вопрос с файлом в контексте →
// ответ модели со строкой вызова инструмента → переключить тему → «перезапустить
// приложение» → чат, тема и проект на месте.
//
//   node tests/ui/full_cycle.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
//
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixture.ts, состояние `?состояние=проект`, посылки —
// fixture.push). Перезапуск имитирует page.reload() в том же браузерном контексте:
// чистое хранилище даёт только свежий контекст, сценарий localStorage не трогает —
// между страницами состояние перезапуска несёт зеркало state.json для страницы
// (src/fixtureState.ts), его наполняют те же действия, что и в окне.
import {
  INSTALL,
  activeChat,
  done,
  openContextPanel,
  openProjectPage,
  panelFolder,
  startInterface,
  themeOf,
} from "../lib/ui_lib.mjs";

const FILE = "bridge.ts";
const QUESTION = "Посмотри, откуда приходит ответ";
/** Строка ответа модели и строка вызова инструмента — те же, что собирает лента окна. */
const TOOL = "✓ read · src/bridge.ts";
const DONE = "Ответ модели получен";
const FIXTURE_CHAT = "Разбор главного окна";
const LIGHT = "light";

/** Переключатель темы: кластер кнопок окна в шапке чата — единственный дом
 *  («тихий хром», §4). */
const themeSwitch = '[data-testid="chat-header"] [data-testid="theme-switch"]';

const iface = await startInterface();
try {
  const { browser, page } = await openProjectPage(iface);
  try {
    // 1. Открыть проект и приложить файл к вопросу: чип в композере -----------------
    await page.click('[data-testid="tree-toggle"][data-name="components"]');
    await page.click(`[data-testid="tree-row"][data-name="${FILE}"]`);
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid="context-chip"]').length === 1,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, `открыть проект и приложить файл не вышло: клик по «${FILE}» не дал чипа в композере`);
    }

    // 2. Спросить модель: ответ стримится, tool-вызов виден строкой «✓ …» ----------
    await page.fill('[data-testid="composer"]', QUESTION);
    await page.keyboard.press("Control+Enter");
    try {
      await page.waitForFunction(
        (needles) => {
          const seen = document.body.textContent;
          return needles.every((needle) => seen.includes(needle));
        },
        [QUESTION, TOOL, DONE],
        { timeout: 5000 },
      );
    } catch {
      const tail = await page.$eval(
        '[data-testid="feed"]',
        (el) => el.textContent.replace(/\s+/g, " ").slice(-160),
      );
      done(1, `ответ с tool-вызовом не собрался: ждали «${TOOL}» и «${DONE}» — в конце ленты «${tail}»`);
    }

    // 3. Переключить тему на светлую ------------------------------------------------
    await page.click(themeSwitch);
    try {
      await page.waitForFunction(
        (light) => document.documentElement.dataset.theme === light,
        LIGHT,
        { timeout: 5000 },
      );
    } catch {
      done(1, `тема после переключателя «${await themeOf(page)}», а не светлая`);
    }

    // 4. «Перезапуск приложения»: та же страница, тот же контекст хранилища ---------
    await page.reload({ waitUntil: "networkidle" });

    // а) Чат на месте: активный есть — и это наш, а не фиксёрный --------------------
    let chat = "";
    try {
      chat = await activeChat(page);
    } catch {
      done(1, "активного чата в сайдбаре нет после перезапуска");
    }
    if (!chat || chat === FIXTURE_CHAT) {
      done(1, `активный чат после перезапуска «${chat}» — это фиксёрный чат, а не наш`);
    }

    // б) Тема осталась светлой --------------------------------------------------------
    const theme = await themeOf(page);
    if (theme !== LIGHT) {
      done(1, `после перезапуска тема сброшена (data-theme=${theme})`);
    }

    // в) Папка проекта на месте в разделе «Проект»: панель скрыта по умолчанию —
    //    открывается из меню «⋯» («тихий хром», §6), папка читается в ней.
    await openContextPanel(page);
    const folder = await panelFolder(page);
    if (!folder || folder === "—") {
      done(1, `в разделе «Проект» после перезапуска нет папки: «${folder || "строки нет"}»`);
    }

    await page.close();
    done(
      0,
      `полный цикл прошёл: вопрос с файлом получил ответ с «${TOOL}», тема светлая, после перезапуска чат «${chat}», тема ${theme}, папка ${folder} на месте`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий полного цикла упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
