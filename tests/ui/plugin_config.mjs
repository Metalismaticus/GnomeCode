// Правила плагина: категории прав и Configure (docs/BATCH.md, пункт 3; docs/SPEC/plugins.md,
// сцена A «Configure» и «Утверждённый UX одобрения» — denied-категории не спрашиваются никогда).
//
//   node tests/ui/plugin_config.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: фикстура зеркалит plugin_run (src/fixtureApprovals.ts),
// правила — память страницы, без перезагрузок страницы: смена правила в Configure должна
// менять следующий вызов в этом же окне (критерий готовности).
import { closeMore, done, openMore, startInterface, INSTALL, openStatePage } from "../lib/ui_lib.mjs";

const CARD = '[data-testid="plugin-card"]';
const CHAT = '[data-testid="chat-active"]';
const ADD = '[data-testid="composer-add"]';
const CONNECT = '[data-testid="add-connect-plugin"]';
const PICKER = '[data-testid="plugin-picker"]';
const ROW = '[data-testid="plugin-row"]';
const PANEL = '[data-testid="plugin-config"]';
const APPROVAL = '[data-testid="plugin-approval"]';

/** Категории прав панели Configure — те же четыре, что у слоя прав (src-tauri/src/plugins/rules.rs). */
const CATEGORIES = ["read", "write", "network", "terminal"];

const card = (id) => `${CARD}[data-plugin="${id}"]`;

/** Строки вызова инструмента ленты: запуск, отказ и denied видны в них. */
const toolRows = (page) =>
  page.$$eval('[data-testid="feed"] .feed__row--tool', (els) => els.map((el) => el.textContent.trim()));

/** Правило категории по отметке нажатия на кнопке значения. */
const pressed = async (page, category, value) =>
  (await page.$eval(`[data-testid="config-rule-${category}-${value}"]`, (el) => el.getAttribute("aria-pressed"))) === "true";

/** Подключить плагин к чату кликами: «+» → Connect plugin → строка списка;
 *  подтверждение — пункт команды в меню «⋯», меню остаётся открытым для run. */
const connect = async (page, id) => {
  await page.click(ADD);
  await page.waitForSelector(CONNECT, { timeout: 5000 });
  await page.click(CONNECT);
  await page.click(`${PICKER} ${ROW}[data-plugin="${id}"]`);
  await openMore(page);
  await page.waitForSelector(`[data-testid="plugin-button"][data-plugin="${id}"]`, { timeout: 5000 });
};

/** Раздел «Плагины» и его карточка: возврат из чата и открытие Configure. */
const configure = async (page, id) => {
  await page.click('[data-testid="sidebar-plugins"]');
  await page.waitForSelector(card(id), { timeout: 5000 });
  await page.click(`${card(id)} [data-testid="plugin-configure"]`);
  await page.waitForSelector(PANEL, { timeout: 5000 });
};

/** Вернуться в чат: клик по активному чату сайдбара закрывает панель правил. */
const toChat = async (page) => {
  await page.click(CHAT);
  await page.waitForSelector('[data-testid="chat-header"]', { timeout: 5000 });
};

/** Клик по пункту команды в меню «⋯»: по подписи команды; меню открывается,
 *  клик по пункту закрывает его сам (спека «тихого хрома», §5). */
const run = async (page, label) => {
  await openMore(page);
  await page.click(`[data-testid="plugin-button"]:has-text("${label}")`);
};

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "плагины-раздел");
  try {

    // а) У карточки есть Configure, панель открывается строками категорий ----------
    try {
      await page.waitForSelector(card("git"), { timeout: 5000 });
    } catch {
      done(1, "во вкладке Installed нет карточки «git» — сценарию не на чем проверять правила");
    }
    try {
      await page.waitForSelector(`${card("git")} [data-testid="plugin-configure"]`, { timeout: 5000 });
    } catch {
      done(1, `у карточки «git» нет кнопки Configure: нет [data-testid=plugin-configure] — правила менять нечем`);
    }
    await page.click(`${card("git")} [data-testid="plugin-configure"]`);
    try {
      await page.waitForSelector(PANEL, { timeout: 5000 });
    } catch {
      done(1, "клик по Configure не открыл панель правил: нет [data-testid=plugin-config]");
    }
    for (const category of CATEGORIES) {
      try {
        await page.waitForSelector(`[data-testid="config-row-${category}"]`, { timeout: 5000 });
      } catch {
        done(1, `в панели Configure нет строки категории «${category}»: нет [data-testid=config-row-${category}]`);
      }
      for (const value of ["allow", "ask", "deny"]) {
        if (!(await page.$(`[data-testid="config-rule-${category}-${value}"]`))) {
          done(1, `у категории «${category}» нет кнопки «${value}»: нет [data-testid=config-rule-${category}-${value}]`);
        }
      }
    }
    if (!(await pressed(page, "write", "ask"))) {
      done(1, "категория Write без правила не показывает умолчание «ask» нажатой");
    }

    // б) deny для Write: следующий вызов commit — строка «⚠ … denied», без окна ----
    await page.click('[data-testid="config-rule-write-deny"]');
    if (!(await pressed(page, "write", "deny"))) {
      done(1, "после клика «deny» правило Write не показывается нажатой кнопкой deny");
    }
    await toChat(page);
    await connect(page, "git");
    await run(page, "commit");
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('[data-testid="feed"] .feed__row--tool'))
          .some((row) => row.textContent.includes("⚠ git · commit denied")),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      const said = await page.$eval('[data-testid="feed"]', (el) => el.textContent.replace(/\s+/g, " ").slice(-200));
      done(1, `после deny-правила вызов commit не дал строки «⚠ git · commit denied» в ленте — в конце ленты «${said}»`);
    }
    if ((await toolRows(page)).some((row) => row.startsWith("git ·"))) {
      done(1, "после deny-правила в ленте есть строка запуска «git ·» — движку ушёл запрещённый вызов");
    }
    if (await page.isVisible(APPROVAL)) {
      done(1, "после deny-правила открылось окно одобрения — denied-категории не спрашиваются никогда");
    }

    // в) allow для Write: тот же вызов исполняется молча ---------------------------
    await configure(page, "git");
    await page.click('[data-testid="config-rule-write-allow"]');
    await toChat(page);
    await run(page, "commit");
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('[data-testid="feed"] .feed__row--tool'))
          .some((row) => row.textContent.startsWith("git ·")),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после allow-правила команда commit не исполнилась: строки запуска «git ·» в ленте нет");
    }
    if (await page.isVisible(APPROVAL)) {
      done(1, "после allow-правила открылось окно одобрения — allow исполняется молча");
    }

    // г) ask для Write: тот же вызов снова спрашивает окном ------------------------
    await configure(page, "git");
    await page.click('[data-testid="config-rule-write-ask"]');
    await toChat(page);
    await run(page, "commit");
    try {
      await page.waitForSelector(APPROVAL, { timeout: 5000 });
    } catch {
      done(1, "после ask-правила окно одобрения не открылось — ask обязан спрашивать");
    }
    await page.click('text="Отказать"');
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="plugin-approval"]'),
      undefined,
      { timeout: 5000 },
    );

    // д) Категория без правила (diff → Network): умолчание ask — окно одобрения ----
    await run(page, "diff");
    try {
      await page.waitForSelector(APPROVAL, { timeout: 5000 });
    } catch {
      done(1, "вызов команды без правила не спросил окном одобрения — умолчание категории не ask");
    }

    done(
      0,
      "у карточки есть Configure с четырьмя строками категорий (Read/Write/Network/Terminal) и значениями allow/ask/deny; смена правила меняет следующий вызов без перезапуска: deny — строка «⚠ git · commit denied» без запуска и без окна, allow — исполняется молча, ask — окно одобрения; команда без правила спрашивает (умолчание ask)",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий правил плагина упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
