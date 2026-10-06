// Sources used (docs/BATCH.md, пункт 9; docs/SPEC/phase2.md, раздел 9.1 «Источники»):
// вопрос с приложенным файлом → под ответом блок «Sources used» с его источниками,
// клик по файлу открывает его в дереве правой панели, клик по плагину ведёт
// в раздел «Плагины». Всё кликами по интерфейсу, утверждения — по элементам экрана.
//
//   node tests/ui/sources_used.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: ленту вне окна даёт фикстура (src/fixture.ts) —
// те же строки, что собирает мост из событий движка.
import { done, connectPlugin, commandButton, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const FILE = "bridge.ts";
const DIR = "components";
const QUESTION = "Что делает этот мост?";

/** Класс подсветки строки дерева, открытой из блока источников. */
const FLASH = "tree__row--flash";

/** Текст блока источников одной строкой — так сверяются имена источников. */
const block = (page) =>
  page.$eval('[data-testid="sources-used"]', (el) => el.textContent.replace(/\s+/g, " "));

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "проект");
  try {

    // а) Вопрос с файлом: чип → отправка → под ответом блок «Sources used» ----------
    await page.click(`[data-testid="tree-toggle"][data-name="${DIR}"]`);
    await page.waitForFunction(
      (name) => Boolean(document.querySelector(`[data-testid="tree-row"][data-name="${name}"]`)),
      FILE,
      { timeout: 5000 },
    );
    await page.click(`[data-testid="tree-row"][data-name="${FILE}"]`);
    await page.fill('[data-testid="composer"]', QUESTION);
    await page.keyboard.press("Control+Enter");
    try {
      await page.waitForSelector('[data-testid="sources-used"]', { timeout: 5000 });
    } catch {
      done(1, "под ответом нет блока «Sources used»: нет [data-testid=sources-used]");
    }
    const listed = await block(page);
    if (!listed.includes(FILE)) {
      done(1, `в блоке источников нет файла «${FILE}» — есть «${listed}»`);
    }

    // б) Клик по источнику-файлу: файл показан в дереве и подсвечен ------------------
    await page.click('[data-testid="source-file"]');
    try {
      await page.waitForFunction(
        (name) => document.querySelector(`[data-testid="tree-row"][data-name="${name}"]`)?.classList
          .contains("tree__row--flash"),
        FILE,
        { timeout: 5000 },
      );
    } catch {
      const opened = await page.$eval('[data-testid="context-panel"]', (el) => Boolean(el)).catch(() => false);
      done(1, `клик по источнику-файлу не подсветил строку дерева «${FILE}» (панель открыта: ${opened})`);
    }

    // в) Плагин как источник: команда исполнена → блок называет и плагин -------------
    await connectPlugin(page, "git");
    await page.click(commandButton("git:diff"));
    try {
      await page.waitForSelector('[data-testid="approval-allow"]', { timeout: 5000 });
    } catch {
      done(1, "первый вызов команды не спросил окном одобрения — слоя прав у вызова нет");
    }
    await page.click('[data-testid="approval-allow"]');
    try {
      await page.waitForSelector('[data-testid="source-plugin"]', { timeout: 5000 });
    } catch {
      done(1, "после исполненной команды в блоке источников нет плагина: нет [data-testid=source-plugin]");
    }
    const withPlugin = await block(page);
    if (!withPlugin.includes("git")) {
      done(1, `в блоке источников нет плагина «git» — есть «${withPlugin}»`);
    }

    // г) Клик по источнику-плагину: переход в раздел «Плагины» -----------------------
    await page.click('[data-testid="source-plugin"]');
    try {
      await page.waitForSelector('[data-testid="plugins-page"]', { timeout: 5000 });
    } catch {
      done(1, "клик по источнику-плагину не открыл раздел «Плагины»: нет [data-testid=plugins-page]");
    }

    await page.close();
    done(
      0,
      `под ответом блок «Sources used» с файлом «${FILE}», клик подсвечивает его в дереве, исполненная команда плагина названа источником, клик по плагину открывает раздел «Плагины»`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий источников упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
