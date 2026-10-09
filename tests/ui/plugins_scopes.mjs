// Скоупы подключения плагинов (docs/SPEC/plugins.md, сцена E): «Once / Chat /
// Project / Global» — полоса у подключённой строки, кнопки скоупа в сводке прав
// и снятие с чата без деинсталляции (панель «Plugins in this chat», сцена D).
// Сценарием игрока — кликами по настоящим кнопкам интерфейса, утверждения —
// по именам и группам на экране, а не вызовами функций.
//
//   node tests/ui/plugins_scopes.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixturePlugins.ts, состояние `?состояние=плагины`).
// «Новый чат» кнопкой не делается (сессия движка возобновляется), поэтому граница
// критерия — перезагрузка страницы: «Chat» кнопок не возвращает, «Project» и
// «Global» — возвращают (в окне это перезапуск с пустым реестром чата).
import { chromium } from "@playwright/test";

import { closeMore, connectPlugin, done, headerCommands, openChatPlugins, openMore, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
/** Плагин с двумя командами: кнопка «diff» — та, что проверяем на возврат. */
const PAIR = "git";
const PAIR_COMMAND = "git:diff";
/** Плагин с одной командой: подключается «Chat» и не переживает перезагрузку. */
const SOLO = "docs";
const SOLO_COMMAND = "docs:search";
/** Плагин из каталога: ставится кнопкой «Keep enabled for this project» сводки. */
const FROM_CATALOG = "github";
const CATALOG_COMMAND = "github:issues";
const CONNECT = "[data-testid=add-connect-plugin]";
const PICKER = '[data-testid="plugin-picker"]';
const ROW = '[data-testid="plugin-row"]';
const BUTTON = (command) => `[data-testid="plugin-button"][data-command="${command}"]`;

/** Имена строк списка плагинов: видно, что плагин остался установленным. */
const rows = (page) => page.$$eval(`${PICKER} ${ROW}`, (els) => els.map((el) => el.getAttribute("data-plugin")));

/** Открыть список плагинов и дождаться строк: полоса скоупов живёт в нём. */
const openPicker = async (page) => {
  await page.click('[data-testid="composer-add"]');
  await page.click(CONNECT);
  await page.waitForSelector(PICKER, { timeout: 5000 });
  await page.waitForSelector(`${PICKER} ${ROW}`, { timeout: 5000 });
};

/** Карточка раздела «Плагины» на вкладке Installed: установка на месте. */
const installedCard = (page, id) => page.waitForSelector(`[data-testid="plugin-card"][data-plugin="${id}"]`, { timeout: 5000 });

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: WIDE });
    await page.goto(`${url}?состояние=плагины`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });

    // а) Подключение git: пункт diff в меню «⋯» ------------------------------------
    await connectPlugin(page, PAIR);
    await openMore(page);
    try {
      await page.waitForSelector(BUTTON(PAIR_COMMAND), { timeout: 5000 });
    } catch {
      done(1, `после подключения «${PAIR}» в меню «⋯» нет пункта diff — пункты меню: ${JSON.stringify(await headerCommands(page))}`);
    }
    await closeMore(page);

    // б) Полоса скоупов у строки: «Chat» предвыбран, «Project» переживает reload ---
    await openPicker(page);
    const scopesBar = `${PICKER} ${ROW}[data-plugin="${PAIR}"] [data-testid="plugin-row-scopes"]`;
    try {
      await page.waitForSelector(scopesBar, { timeout: 5000 });
    } catch {
      done(1, `у подключённой строки «${PAIR}» нет полосы скоупов [data-testid=plugin-row-scopes] — выбрать Once/Chat/Project/Global нечем`);
    }
    const pressed = (kind) => page.$eval(`${scopesBar} [data-testid="scope-${kind}"]`, (el) => el.getAttribute("aria-pressed"));
    if ((await pressed("chat")) !== "true") {
      done(1, `«Chat» не предвыбран в полосе скоупов строки «${PAIR}» — умолчание подключения не показано`);
    }
    for (const kind of ["once", "project", "global"]) {
      const seen = await page.$(`${scopesBar} [data-testid="scope-${kind}"]`);
      if (!seen) {
        done(1, `в полосе скоупов строки «${PAIR}» нет кнопки «${kind}» — сцена E неполная`);
      }
    }
    await page.click(`${scopesBar} [data-testid="scope-project"]`);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await openMore(page);
    try {
      await page.waitForSelector(BUTTON(PAIR_COMMAND), { timeout: 90_000 });
    } catch {
      done(1, "после перезагрузки пункта «diff» нет — проектный скоуп не запомнился: пункты меню " + JSON.stringify(await headerCommands(page).catch(() => [])));
    }
    await closeMore(page);

    // в) «Chat» после перезагрузки пунктов не возвращает, плагин остаётся установленным
    await connectPlugin(page, SOLO);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
    if ((await headerCommands(page)).includes(SOLO_COMMAND)) {
      done(1, "после перезагрузки пункт docs на месте — скоуп «Chat» вернул команды нового чата, а должен только текущий");
    }
    if (!(await headerCommands(page)).includes(PAIR_COMMAND)) {
      done(1, "после перезагрузки пропал и пункт «diff» — проектный скоуп git потерялся вместе с чат-ским docs");
    }
    const section = await browser.newPage({ viewport: WIDE });
    await section.goto(`${url}?состояние=плагины-раздел`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await installedCard(section, SOLO);
    } catch {
      done(1, "карточка docs пропала из раздела «Плагины» — подключение чат-ским скоупом деинсталлировало плагин");
    }
    await section.close();

    // г) Панель «Plugins in this chat» из меню «⋯»: снять git с чата — пункты уходят,
    //    установка остаётся ---------------------------------------------------------
    await openChatPlugins(page);
    await page.click('[data-testid="plugin-chat-remove"][data-plugin="git"]');
    // Пункты команд живут в открытом меню «⋯» — снятие читается в нём же.
    await openMore(page);
    try {
      await page.waitForFunction(
        (needle) => !Array.from(document.querySelectorAll('[data-testid="plugin-button"]')).some((el) => el.getAttribute("data-command") === needle),
        PAIR_COMMAND,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после снятия с чата пункт «diff» остался — снятие пунктов не убрало");
    }
    await closeMore(page);
    const removal = await browser.newPage({ viewport: WIDE });
    await removal.goto(`${url}?состояние=плагины-раздел`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await installedCard(removal, PAIR);
    } catch {
      done(1, "карточки git нет во вкладке Installed после снятия с чата — снятие деинсталлировало плагин");
    }
    await removal.close();

    // д) Снятие держится в рамках чата: перезагрузка (новый чат) возвращает пункты --
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await openMore(page);
    try {
      await page.waitForSelector(BUTTON(PAIR_COMMAND), { timeout: 90_000 });
    } catch {
      done(1, "после перезагрузки пункта «diff» нет — проектный скоуп не пережил снятие с чата, а должен вернуться в новом чате");
    }
    await closeMore(page);

    // е) Сводка прав: «Keep enabled for this project» ставит и включает для проекта -
    await openPicker(page);
    await page.click('[data-testid="browse-plugins"]');
    try {
      await page.waitForSelector('[data-testid="catalog-picker"]', { timeout: 5000 });
    } catch {
      done(1, "«Browse plugins…» не открыл каталог: нет [data-testid=catalog-picker]");
    }
    await page.click('[data-testid="catalog-card"][data-plugin="github"] [data-testid="catalog-install"]');
    try {
      await page.waitForSelector('[data-testid="plugin-summary"]', { timeout: 5000 });
    } catch {
      done(1, "Install каталога не открыл сводку прав: нет [data-testid=plugin-summary]");
    }
    const answers = await page.$$eval('[data-testid="plugin-summary"] button', (els) => els.map((el) => el.textContent.trim()));
    for (const answer of ["Разрешить", "Keep enabled for this project", "Enable by default", "Отмена"]) {
      if (!answers.includes(answer)) {
        done(1, `в сводке прав нет ответа «${answer}»: кнопки сводки — ${answers.join(", ") || "ни одной"}`);
      }
    }
    await page.click('[data-testid="summary-enable-project"]');
    await openMore(page);
    try {
      await page.waitForSelector(BUTTON(CATALOG_COMMAND), { timeout: 5000 });
    } catch {
      done(1, `после «Keep enabled for this project» в меню «⋯» нет пункта issues — пункты меню: ${JSON.stringify(await headerCommands(page))}`);
    }
    await closeMore(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await openMore(page);
    try {
      await page.waitForSelector(BUTTON(CATALOG_COMMAND), { timeout: 90_000 });
    } catch {
      done(1, "после перезагрузки пункта issues нет — скоуп проекта из сводки прав не запомнился");
    }
    await closeMore(page);

    // ж) «Once»: следующий вопрос снимает плагин с чата -----------------------------
    await connectPlugin(page, SOLO);
    await openPicker(page);
    await page.click(`${PICKER} ${ROW}[data-plugin="${SOLO}"] [data-testid="scope-once"]`);
    if (!(await headerCommands(page)).includes(SOLO_COMMAND)) {
      done(1, "после выбора «Once» пункт docs пропал до вопроса — Once должен жить до конца текущего запроса");
    }
    await page.fill('[data-testid="composer"]', "покажи, что Once снимает плагин");
    await page.click('[data-testid="send"]');
    await openMore(page);
    try {
      await page.waitForFunction(
        (needle) => !Array.from(document.querySelectorAll('[data-testid="plugin-button"]')).some((el) => el.getAttribute("data-command") === needle),
        SOLO_COMMAND,
        { timeout: 15000 },
      );
    } catch {
      done(1, "после вопроса пункт docs остался — скоуп «Once» не снял плагин с чата");
    }
    await closeMore(page);
    if (!(await headerCommands(page)).includes(PAIR_COMMAND)) {
      done(1, "после вопроса пропал и пункт «diff» — Once снял не только свой плагин");
    }

    await page.close();
    done(
      0,
      "подключение даёт пункты в меню «⋯», у строки полоса скоупов с предвыбранным «Chat», «Project» переживает перезагрузку (новый чат), «Chat» — нет, снятие с чата убирает пункты без деинсталляции и держится до перезагрузки, сводка прав ставит плагин кнопкой «Keep enabled for this project» с запоминанием, «Once» снимает плагин после вопроса",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий скоупов упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
