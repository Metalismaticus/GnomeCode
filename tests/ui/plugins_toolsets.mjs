// Tool Sets (docs/BATCH.md, пункт 7; phase2.md, раздел 11): пункт «Tool Set» в
// разделе Capabilities меню «+» открывает окно сетов; «Save as Tool Set»
// сохраняет подключённые сейчас плагины; перезагрузка страницы (прокси нового
// чата) сет не теряет; клик по строке сета подключает все его плагины, выбор
// «Project» делает сет дефолтом проекта — кнопки возвращаются в каждом новом
// чате; снятие плагина с чата установки не трогает; крестик строки удаляет сет
// после подтверждения, подключённые плагины и скоупы не трогает.
//
//   node tests/ui/plugins_toolsets.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixtureToolsets.ts, состояние `?состояние=плагины`).
import { chromium } from "@playwright/test";

import { commandButton, connectPlugin, done, headerCommands, installedCard, openChatPlugins, openState, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
/** Сет из двух плагинов: одна кнопка в шапке — и ни одна из них не потерялась. */
const SET_NAME = "Chat Basics";
const PAIR_COMMAND = "git:diff";
const SOLO_COMMAND = "docs:search";
const ADD = '[data-testid="composer-add"]';
const PICKER = '[data-testid="toolset-picker"]';
const NAME = '[data-testid="toolset-name"]';
const SAVE = '[data-testid="toolset-save"]';
const ROW = (name) => `${PICKER} [data-testid="toolset-row"][data-toolset="${name}"]`;

/** Открыть окно Tool Sets: «+» → пункт «Tool Set» раздела Capabilities. */
const openToolsets = async (page) => {
  await page.click(ADD);
  const item = page.locator('[data-testid="add-tool-set"]');
  await item.waitFor({ timeout: 5000 });
  await item.click();
  await page.waitForSelector(PICKER, { timeout: 5000 });
};

/** Esc закрывает открытое окно: следующий шаг не должен попадать в клик по нему. */
const closeToolsets = async (page) => {
  await page.keyboard.press("Escape");
  await page.waitForSelector(PICKER, { state: "detached", timeout: 5000 });
};

/** Снятие плагина с чата: его кнопка ушла из шапки. */
const removedFromChat = async (page, command) => {
  try {
    await page.waitForFunction(
      (needle) => !Array.from(document.querySelectorAll('[data-testid="plugin-button"]')).some((el) => el.getAttribute("data-command") === needle),
      command,
      { timeout: 5000 },
    );
  } catch {
    done(1, `после снятия с чата кнопка «${command}» осталась — снятие кнопок не убрало`);
  }
};

/** Строки сета нет в окне: удаление сработало (или отменилось корректно). */
const rowGone = async (page, name) => {
  try {
    await page.waitForFunction(
      (wanted) => !document.querySelector(`[data-testid="toolset-row"][data-toolset="${wanted}"]`),
      name,
      { timeout: 5000 },
    );
  } catch {
    done(1, `строка сета «${name}» осталась в окне — удаление Tool Set не сработало`);
  }
};

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await openState(browser, url, "плагины");

    // а) В меню «+» раздела Capabilities есть пункт «Tool Set» ---------------------
    await page.click(ADD);
    try {
      await page.waitForSelector('[data-testid="add-tool-set"]', { timeout: 5000 });
    } catch {
      done(1, `В Capabilities меню «+» нет пункта Tool Set: нет [data-testid=add-tool-set]`);
    }
    await page.keyboard.press("Escape");

    // б) Сохранить сет из подключённого: подключим git и docs, «Save as Tool Set» --
    await connectPlugin(page, "git");
    await connectPlugin(page, "docs");
    await openToolsets(page);
    // Пустое имя — сет не записать: причина дословно в самом окне.
    await page.click(SAVE);
    try {
      await page.waitForFunction(
        (needle) => document.querySelector('[data-testid="toolset-picker"]')?.innerText.includes(needle),
        "Имя сета пустое: введите название",
        { timeout: 5000 },
      );
    } catch {
      done(1, "«Save as Tool Set» с пустым именем не сказал «Имя сета пустое: введите название»");
    }
    await page.fill(NAME, SET_NAME);
    await page.click(SAVE);
    const saved = await page.$(ROW(SET_NAME));
    if (!saved) {
      done(1, `в ${PICKER} нет строки [data-testid=toolset-row][data-toolset="${SET_NAME}"] — «Save as Tool Set» сет не записал`);
    }
    const listed = await saved.textContent();
    for (const id of ["git", "docs"]) {
      if (!listed.includes(id)) {
        done(1, `строка сета «${SET_NAME}» не показывает плагин «${id}»: ${listed.trim()}`);
      }
    }
    await closeToolsets(page);

    // в) Сет переживает перезагрузку страницы ---------------------------------------
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
    await openToolsets(page);
    try {
      await page.waitForSelector(ROW(SET_NAME), { timeout: 5000 });
    } catch {
      done(1, `сета «${SET_NAME}» не пережил перезагрузку: строки нет в ${PICKER}`);
    }
    await closeToolsets(page);

    // г) Клик по строке сета подключает группу: кнопки обоих плагинов в шапке -------
    try {
      await page.waitForSelector(commandButton(PAIR_COMMAND), { timeout: 3000 });
      done(1, "после перезагрузки кнопки git на месте — сохранение сета не из чат-ского подключения сломало порядок проверки");
    } catch {
      // Новый чат без кнопок — видно, что подключает именно клик по сету.
    }
    await openToolsets(page);
    await page.click(ROW(SET_NAME));
    // Кнопки приходят с ответом подключения: в окне plugin_toolset_connect делает
    // ходы к движку по HTTP — читать шапку можно, когда кнопка доехала.
    try {
      await page.waitForSelector(commandButton(PAIR_COMMAND), { timeout: 5000 });
    } catch {
      done(1, `клик по сету не дал кнопку «${PAIR_COMMAND}» в шапке за 5 с — список из ответа подключения не применён`);
    }
    const shown = await headerCommands(page);
    if (!shown.includes(PAIR_COMMAND) || !shown.includes(SOLO_COMMAND)) {
      done(1, `клик по сету не дал кнопок в шапке: ${JSON.stringify(shown)} — ожиданы ${PAIR_COMMAND} и ${SOLO_COMMAND}`);
    }
    await closeToolsets(page);

    // д) «Project» у строки сета — дефолт проекта: перезагрузка возвращает кнопки ---
    await openToolsets(page);
    const row = await page.$(ROW(SET_NAME));
    const bar = await row.$('[data-testid="toolset-row-scopes"]');
    if (!bar) {
      done(1, `у строки сета «${SET_NAME}» нет мини-полосы Chat/Project [data-testid=toolset-row-scopes]`);
    }
    await page.click(`${ROW(SET_NAME)} [data-testid="toolset-scope-project"]`);
    // Перезагрузка проверяет записанный дефолт, а не догоняет подключение:
    // ждать записи скоупа в хранилище страницы (зеркало файла скоупов,
    // fixturePlugins SCOPE_KEY «gnomecode-plugin-scopes») — кнопки шапки
    // могли уже стоять с прежнего подключения.
    try {
      await page.waitForFunction(
        () => (localStorage.getItem("gnomecode-plugin-scopes") ?? "").includes("git"),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, `«Project» на сете не записал скоуп git за 5 с — перезагрузке проверять нечего`);
    }
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
    const afterReload = await headerCommands(page);
    if (!afterReload.includes(PAIR_COMMAND) || !afterReload.includes(SOLO_COMMAND)) {
      done(1, `Project на сете не дал новый чат кнопок: ${JSON.stringify(afterReload)}`);
    }
    await closeToolsets(page);

    // е) Панель «Plugins in this chat»: снять git — установка остаётся --------------
    await openChatPlugins(page);
    await page.click('[data-testid="plugin-chat-remove"][data-plugin="git"]');
    await removedFromChat(page, PAIR_COMMAND);
    if (!(await headerCommands(page)).includes(SOLO_COMMAND)) {
      done(1, "снятие с чата убрало и не тронутую кнопку docs — снялся не только «git»");
    }
    const section = await browser.newPage({ viewport: WIDE });
    await section.goto(`${url}?состояние=плагины-раздел`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await installedCard(section, "git");
    } catch {
      done(1, "карточки git нет во вкладке Installed после снятия с чата — снятие деинсталлировало плагин");
    }
    await section.close();

    // ж) Перезагрузка: проектный дефолт возвращает git в каждом новом чате ----------
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await page.waitForSelector(commandButton(PAIR_COMMAND), { timeout: 90_000 });
    } catch {
      done(1, "после перезагрузки кнопки «diff» нет — дефолт проекта из Tool Set не вернул плагин в новый чат");
    }

    // з) Крестик строки сета: подтверждение «Удалить»/«Отмена» по образцу
    //    Uninstall; удалённый сет уходит насовсем, подключённые плагины
    //    и их скоупы (в том числе дефолт проекта) не трогаются -----------------
    await openToolsets(page);
    const cross = `${ROW(SET_NAME)} [data-testid="toolset-row-remove"]`;
    try {
      await page.waitForSelector(cross, { timeout: 5000 });
    } catch {
      done(1, `у строки сета «${SET_NAME}» нет крестика удаления [data-testid=toolset-row-remove] — окно сетов удалить не даёт`);
    }
    await page.click(cross);
    try {
      await page.waitForSelector('[data-testid="toolset-remove-confirm"]', { timeout: 5000 });
    } catch {
      done(1, "крестик строки сета не открыл подтверждение удаления [data-testid=toolset-remove-confirm]");
    }
    await page.click('[data-testid="toolset-remove-no"]');
    await page.waitForSelector('[data-testid="toolset-remove-confirm"]', { state: "detached", timeout: 5000 });
    if (!(await page.$(ROW(SET_NAME)))) {
      done(1, "«Отмена» убрала сет — подтверждение само решило без ответа владельца");
    }
    await page.click(cross);
    await page.click('[data-testid="toolset-remove-yes"]');
    await rowGone(page, SET_NAME);
    await closeToolsets(page);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
    try {
      await page.waitForSelector(commandButton(PAIR_COMMAND), { timeout: 90_000 });
    } catch {
      done(1, "после удаления сета кнопки «diff» нет — удаление сета стёрло скоупы подключённых плагинов");
    }
    await openToolsets(page);
    await rowGone(page, SET_NAME);
    // Чат без подключённых плагинов — сет не из чего создать: причина дословно.
    await page.click(SAVE);
    try {
      await page.waitForFunction(
        (needle) => document.querySelector('[data-testid="toolset-picker"]')?.innerText.includes(needle),
        "Нечего сохранять: подключите плагин к чату и повторите",
        { timeout: 5000 },
      );
    } catch {
      done(1, "«Save as Tool Set» в чате без подключённых не сказал «Нечего сохранять: подключите плагин к чату и повторите»");
    }

    await page.close();
    done(
      0,
      "меню «+» открывает Tool Set, «Save as Tool Set» сохраняет подключённое и переживает перезагрузку, клик по строке подключает группу, «Project» делает сет дефолтом проекта, снятие плагина с чата не деинсталлирует, дефолт возвращает плагин в каждом новом чате, крестик удаляет сет после подтверждения «Удалить»/«Отмена», подключённые плагины и скоупы не трогает",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий Tool Sets упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}
