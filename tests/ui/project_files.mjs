// Проект и файлы — сценарием игрока: выбрана папка, дерево показывает структуру, клик по
// файлу кладёт его в контекст следующего запроса. Всё вводом и кликами по элементам
// интерфейса, утверждения — по именам и группам на экране, а не вызовами функций.
//
//   node tests/ui/project_files.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixture.ts, состояние `?состояние=проект`).
import { done, openProjectPage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const FILE = "bridge.ts";
const DIR = "components";
const QUESTION = "Что здесь происходит?";

/** Имена строк дерева: тем видно, что раскрылась именно та папка. */
const rows = (page) =>
  page.$$eval('[data-testid="tree"] [data-testid="tree-row"]', (els) =>
    els.map((el) => ({ name: el.getAttribute("data-name"), kind: el.getAttribute("data-kind") })),
  );

/** Имена чипов над полем ввода — контекст следующего запроса. */
const chips = (page) => page.$$eval('[data-testid="context-chip"]', (els) => els.map((el) => el.textContent.trim()));

/** Активная вкладка правой панели: дерево живёт только под «Файлы». */
const activeTab = (page) =>
  page.$eval('[data-testid="context-tabs"]', (el) => {
    const on = el.querySelector('[aria-selected="true"]');
    return on ? on.textContent.trim() : "нет активной вкладки";
  });

const iface = await startInterface();
try {
  const { browser, page } = await openProjectPage(iface);
  try {
    // а) В правой панели есть дерево выбранной папки --------------------------------
    if ((await rows(page)).length === 0) {
      done(1, "дерева файлов в правой панели нет: нет [data-testid=tree]");
    }

    // б) Папка раскрывается по стрелке, а её потомков до клика нет в DOM --------------
    const before = await rows(page);
    if (before.some((row) => row.name === FILE)) {
      done(1, `в дереве есть ${FILE} до раскрытия папки — дерево не ленивое`);
    }
    await page.click(`[data-testid="tree-toggle"][data-name="${DIR}"]`);
    try {
      await page.waitForFunction(
        (name) => Boolean(document.querySelector(`[data-testid="tree-row"][data-name="${name}"]`)),
        FILE,
        { timeout: 5000 },
      );
    } catch {
      done(1, `клик по стрелке папки «${DIR}» не показал её потомков — в дереве нет строки «${FILE}»`);
    }
    const after = await rows(page);
    const dirRow = after.find((row) => row.name === DIR);
    if (!dirRow || dirRow.kind !== "dir") {
      done(1, `в дереве нет папки «${DIR}» — раскрывать нечего`);
    }

    // в) Клик по файлу: чип с тем же именем и строка помечена выбранной --------------
    await page.click(`[data-testid="tree-row"][data-name="${FILE}"]`);
    try {
      await page.waitForFunction(
        (name) => document.querySelectorAll('[data-testid="context-chip"]').length === 1,
        FILE,
        { timeout: 5000 },
      );
    } catch {
      done(1, `клик по файлу «${FILE}» не добавил его в контекст: чипов ${(await chips(page)).length}, а не 1`);
    }
    const [chip] = await chips(page);
    if (!chip.includes(FILE)) {
      done(1, `в чипе контекста «${chip}», а имя файла в дереве «${FILE}» — это не тот файл`);
    }
    const selected = await page.$eval(
      `[data-testid="tree-row"][data-name="${FILE}"]`,
      (el) => el.getAttribute("aria-selected"),
    );
    if (selected !== "true") {
      done(1, `строка дерева «${FILE}» не помечена выбранной (aria-selected=${selected})`);
    }

    // г) Крестик чипа убирает файл из контекста --------------------------------------
    await page.click('[data-testid="chip-close"]');
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid="context-chip"]').length === 0,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, `крестик не убрал чип: их ${(await chips(page)).length}, а не 0`);
    }

    // д) Вкладки есть, но дерево остаётся «Файлы» ------------------------------------
    const tabs = await page.$$eval('[data-testid="context-tabs"] [role="tab"]', (els) =>
      els.map((el) => el.textContent.trim()),
    );
    for (const name of ["Символы", "Git"]) {
      if (!tabs.includes(name)) {
        done(1, `в правой панели нет вкладки «${name}»: есть ${tabs.join(", ") || "ни одной"}`);
      }
    }
    await page.click('[data-testid="context-tabs"] [role="tab"]:has-text("Символы")');
    try {
      await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')
        ?.textContent.trim() === "Символы", undefined, { timeout: 5000 });
    } catch {
      done(1, "клик по вкладке «Символы» не переключил её — вкладка не нажимается");
    }
    if ((await rows(page)).length === 0) {
      done(1, "после переключения вкладки дерево пропало — «Символы» ещё заглушка, «Файлы» должны остаться");
    }
    await page.click('[data-testid="context-tabs"] [role="tab"]:has-text("Файлы")');
    if ((await activeTab(page)) !== "Файлы") {
      done(1, `после возврата к «Файлы» активна вкладка «${await activeTab(page)}»`);
    }

    // е) Файл в контексте уходит с вопросом: в ленте видно имя файла ------------------
    await page.click(`[data-testid="tree-row"][data-name="${FILE}"]`);
    await page.fill('[data-testid="composer"]', QUESTION);
    await page.keyboard.press("Control+Enter");
    try {
      await page.waitForFunction(
        (name) => {
          const user = document.querySelector('[data-testid="feed"] .feed__row--user');
          return Boolean(user) && user.textContent.includes(name);
        },
        FILE,
        { timeout: 5000 },
      );
    } catch {
      const said = await page.$eval('[data-testid="feed"]', (el) => el.textContent.replace(/\s+/g, " ").slice(-160));
      done(1, `вопрос ушёл без файла: строка вопроса в ленте не называет «${FILE}» — в конце ленты «${said}»`);
    }

    await page.close();
    done(
      0,
      `дерево раскрывается по стрелке, клик по файлу даёт чип «${FILE}» и отмеченную строку, крестик убирает файл, вкладки «Символы»/«Git» есть и не ломают «Файлы», вопрос с файлом уходит в ленту с его именем`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий дерева файлов упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
