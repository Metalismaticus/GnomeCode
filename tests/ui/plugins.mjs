// Плагины из чата: «+» → Connect plugin → пункт команды в меню «⋯». Сценарием игрока —
// кликами по настоящим кнопкам интерфейса и вводом с клавиатуры, утверждения —
// по именам и группам на экране, а не вызовами функций.
//
//   node tests/ui/plugins.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixturePlugins.ts, состояние `?состояние=плагины`).
import { chromium } from "@playwright/test";

import { connectPlugin, closeMore, done, openMore, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
/** Плагин с одной командой: одна команда — одна кнопка (docs/ROADMAP.md, «Крайние случаи»). */
const SOLO = "docs";
const SOLO_COMMAND = "search";
/** Плагин с двумя командами: кнопка на каждую команду. */
const PAIR = "git";
/** Плагин, который не запустился: в строке — причина словами, а не пустота. */
const BROKEN = "browser";
const CONNECT = "[data-testid=add-connect-plugin]";
const PICKER = '[data-testid="plugin-picker"]';
const ROW = '[data-testid="plugin-row"]';

/** Имена строк списка плагинов: тем видно, что осталось после поиска. */
const rows = (page) => page.$$eval(`${PICKER} ${ROW}`, (els) => els.map((el) => el.getAttribute("data-plugin")));

/** Разделы списка плагинов: тем видно, что осталось после поиска. */
const pluginGroups = (page) =>
  page.$$eval(
    `${PICKER} [data-testid="plugin-group"]`,
    (els) =>
      els.map((el) => ({
        title: el.getAttribute("data-group"),
        plugins: Array.from(el.querySelectorAll('[data-testid="plugin-row"]')).map((row) => row.getAttribute("data-plugin")),
      })),
  );
/** Разделы одной строкой для строки провала: где чей плагин сейчас. */
const described = (list) =>
  list.map((group) => `${group.title}: ${group.plugins.join(", ")}`).join("; ") || "ни одного раздела";

/** Подписи пунктов команд в меню «⋯» по плагину: один пункт на команду
 *  (меню читается открытым — после openMore). */
const buttons = (page) =>
  page.$$eval('[data-testid="plugin-button"]', (els) =>
    els.map((el) => ({ plugin: el.getAttribute("data-plugin"), label: el.textContent.trim() })),
  );

/** Разделы меню «+» подряд: без них меню не то, о котором говорит пункт. */
const sections = (page) => page.$$eval('[data-testid="add-menu"] [data-section]', (els) => els.map((el) => el.textContent.trim()));

/** Строки вызова инструмента ленты: одобрение и отказ видны в них. */
const toolRows = (page) =>
  page.$$eval('[data-testid="feed"] .feed__row--tool', (els) => els.map((el) => el.textContent.trim()));

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: WIDE });
    await page.goto(`${url}?состояние=плагины`, { waitUntil: "networkidle" });

    // а) «+» открывает меню с разделами и пунктом Connect plugin ---------------------
    await page.click('[data-testid="composer-add"]');
    try {
      await page.waitForSelector(CONNECT, { timeout: 5000 });
    } catch {
      done(1, `клик по «+» в композере не открыл меню: на экране нет пункта ${CONNECT} — подключить плагин нечем`);
    }
    const menuSections = await sections(page);
    for (const name of ["Files", "Context", "Capabilities"]) {
      if (!menuSections.includes(name)) {
        done(1, `в меню «+» нет раздела «${name}»: есть ${menuSections.join(", ") || "ни одного"}`);
      }
    }

    // б) Connect plugin открывает список с поиском ------------------------------------
    await page.click(CONNECT);
    try {
      await page.waitForSelector(PICKER, { timeout: 5000 });
    } catch {
      done(1, `пункт Connect plugin не открыл список плагинов: на экране нет ${PICKER}`);
    }
    if (!(await page.isVisible('[data-testid="plugin-search"]'))) {
      done(1, "в списке плагинов нет поиска [data-testid=plugin-search] — искать плагин нечем");
    }
    const all = await rows(page);
    if (!all.includes(SOLO)) {
      done(1, `в списке нет плагина «${SOLO}»: есть ${all.join(", ") || "ни одного"}`);
    }

    // в) Поиск по имени оставляет один плагин ----------------------------------------
    await page.fill('[data-testid="plugin-search"]', SOLO);
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[data-testid="plugin-picker"] [data-testid="plugin-row"]').length === 1,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, `поиск «${SOLO}» не оставил один плагин: в списке ${(await rows(page)).length}`);
    }
    const [left] = await rows(page);
    if (left !== SOLO) {
      done(1, `поиск «${SOLO}» оставил в списке «${left}» — ищет не по тому полю`);
    }

    // г) Клик по строке: пункты команд появляются в меню «⋯», список закрывается -------
    await page.click(`${PICKER} ${ROW}[data-plugin="${SOLO}"]`);
    await openMore(page);
    try {
      await page.waitForSelector(`[data-testid="plugin-button"][data-plugin="${SOLO}"]`, { timeout: 5000 });
    } catch {
      done(1, `в меню «⋯» нет пункта плагина после подключения «${SOLO}» — пункты в меню: ${JSON.stringify(await buttons(page))}`);
    }
    if (await page.isVisible(PICKER)) {
      done(1, "список плагинов не закрылся после подключения — он должен закрыться");
    }
    const solo = await buttons(page);
    if (solo.length !== 1) {
      done(1, `у плагина «${SOLO}» одна команда, а пунктов в меню ${solo.length} — одна команда — один пункт`);
    }
    // Подпись пункта — «{плагин}: {команда}» (спека «тихого хрома», §5).
    if (!solo[0].label.endsWith(`: ${SOLO_COMMAND}`)) {
      done(1, `пункт плагина «${SOLO}» подписан «${solo[0].label}», а команда «${SOLO_COMMAND}»`);
    }
    await closeMore(page);

    // д) Пункт остаётся после перерисовки — «всё без перезапуска» ---------------------
    // Переключатель темы — в шапке чата (кластер один, «тихий хром» §4).
    await page.click('[data-testid="chat-header"] [data-testid="theme-switch"]');
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", undefined, { timeout: 5000 });
    await openMore(page);
    if ((await buttons(page)).length !== solo.length) {
      done(1, "после перерисовки окна пункты команд в меню «⋯» пропали — подключение держится только до перерисовки");
    }
    await closeMore(page);

    // е) Подключённый плагин попадает в «Недавние», избранное — вперёд ---------------
    await page.click('[data-testid="composer-add"]');
    await page.click(CONNECT);
    await page.waitForSelector(PICKER, { timeout: 5000 });
    const groups = await pluginGroups(page);
    const recent = groups.find((group) => group.title === "Недавние");
    if (!recent || !recent.plugins.includes(SOLO)) {
      done(1, `подключённый плагин «${SOLO}» не попал в раздел «Недавние»: есть ${groups.map((group) => `${group.title}: ${group.plugins.join(", ")}`).join("; ") || "ни одного раздела"}`);
    }
    await page.click(`${PICKER} ${ROW}[data-plugin="${SOLO}"] [data-testid="plugin-favorite"]`);
    await page.click('[data-testid="composer-add"]');
    await page.click(CONNECT);
    await page.waitForSelector(PICKER, { timeout: 5000 });
    const first = await page.$eval(`${PICKER} [data-testid="plugin-group"]`, (el) => el.getAttribute("data-group"));
    if (first !== "Избранные") {
      done(1, `первым разделом после отметки «в избранное» стал «${first}», а не «Избранные»`);
    }

    // ё) Пин переживает перезапуск: перезагрузка той же страницы — как у полного цикла,
    //    тоже окно приложения: тот же контекст хранилища, действий свежего не было
    await page.reload({ waitUntil: "networkidle" });
    await page.click('[data-testid="composer-add"]');
    await page.click(CONNECT);
    try {
      await page.waitForSelector(PICKER, { timeout: 5000 });
    } catch {
      done(1, `после перезапуска Connect plugin не открыл список плагинов: нет ${PICKER}`);
    }
    const kept = await pluginGroups(page);
    if (!kept.find((group) => group.title === "Избранные")?.plugins.includes(SOLO)) {
      done(1, `после перезапуска пин «${SOLO}» улетел из «Избранных»: разделы — ${described(kept)}`);
    }
    // Владелец передумал и снял пин — снятие тоже помнится при следующем открытии
    await page.click(`${PICKER} ${ROW}[data-plugin="${SOLO}"] [data-testid="plugin-favorite"]`);
    await page.click('[data-testid="composer-add"]');
    await page.click(CONNECT);
    try {
      await page.waitForSelector(PICKER, { timeout: 5000 });
    } catch {
      done(1, "второе открытие списка плагинов не открыло тот же список");
    }
    await page.reload({ waitUntil: "networkidle" });
    await page.click('[data-testid="composer-add"]');
    await page.click(CONNECT);
    try {
      await page.waitForSelector(PICKER, { timeout: 5000 });
    } catch {
      done(1, `после снятия пина Connect plugin не открыл список плагинов: нет ${PICKER}`);
    }
    const unpinned = await pluginGroups(page);
    if (unpinned.find((group) => group.title === "Избранные")?.plugins.includes(SOLO)) {
      done(1, `после снятия пина «${SOLO}» всё ещё в «Избранных» — снятие пина не запомнилось: разделы — ${described(unpinned)}`);
    }
    if (!unpinned.find((group) => group.title === "Недавние")?.plugins.includes(SOLO)) {
      done(1, `после перезапуска подключённый «${SOLO}» улетел из «Недавних»: разделы — ${described(unpinned)}`);
    }

    // ж) Плагин не запущен — в строке причина словами --------------------------------
    await page.fill('[data-testid="plugin-search"]', BROKEN);
    const reason = await page.$eval(`${PICKER} ${ROW}[data-plugin="${BROKEN}"]`, (el) => el.textContent.replace(/\s+/g, " ").trim());
    if (!reason.includes("модуль браузера не установлен")) {
      done(1, `в строке плагина «${BROKEN}» нет причины, почему он не запустился: «${reason}»`);
    }

    // з) Плагин с двумя командами — по пункту на команду ------------------------------
    await page.fill('[data-testid="plugin-search"]', PAIR);
    await page.click(`${PICKER} ${ROW}[data-plugin="${PAIR}"]`);
    await openMore(page);
    try {
      await page.waitForFunction(
        (id) => document.querySelectorAll(`[data-testid="plugin-button"][data-plugin="${id}"]`).length === 2,
        PAIR,
        { timeout: 5000 },
      );
    } catch {
      const got = await buttons(page);
      done(1, `у плагина «${PAIR}» две команды, а пунктов в меню ${got.filter((one) => one.plugin === PAIR).length} — по пункту на команду`);
    }

    await page.close();

    // и) Пустой список — понятными словами, а не пустотой ---------------------------
    const empty = await browser.newPage({ viewport: WIDE });
    await empty.goto(`${url}?состояние=плагины-пусто`, { waitUntil: "networkidle" });
    await empty.click('[data-testid="composer-add"]');
    await empty.click(CONNECT);
    try {
      await empty.waitForSelector(PICKER, { timeout: 5000 });
    } catch {
      done(1, "при пустом списке плагинов Connect plugin не открыл окно списка — владельцу не сказано, что подключать нечего");
    }
    const emptyText = await empty.$eval(PICKER, (el) => el.textContent.replace(/\s+/g, " ").trim());
    if (!emptyText.includes("Плагинов пока нет")) {
      done(1, `пустой список плагинов не объяснён словами: в окне «${emptyText.slice(0, 120)}»`);
    }
    await empty.close();

    // к) Клик по пункту меню — команда уходит в ленту строкой вызова инструмента -------
    const page2 = await browser.newPage({ viewport: WIDE });
    await page2.goto(`${url}?состояние=плагины`, { waitUntil: "networkidle" });
    await connectPlugin(page2, SOLO);
    await openMore(page2);
    await page2.click(`[data-testid="plugin-button"][data-plugin="${SOLO}"]`);
    try {
      await page2.waitForFunction(
        (name) => {
          const tools = document.querySelectorAll('[data-testid="feed"] .feed__row--tool');
          return Array.from(tools).some((row) => row.textContent.includes(name));
        },
        SOLO_COMMAND,
        { timeout: 5000 },
      );
    } catch {
      const said = await page2.$eval('[data-testid="feed"]', (el) => el.textContent.replace(/\s+/g, " ").slice(-160));
      done(
        1,
        `клик по кнопке «${SOLO_COMMAND}» с выданным правилом слоя прав не дал строки вызова инструмента в ленте — в конце ленты «${said}»`,
      );
    }
    await page2.close();

    // л) Слой прав спрашивает: окно одобрения с тремя ответами ---------------------
    const asked = await browser.newPage({ viewport: WIDE });
    await asked.goto(`${url}?состояние=одобрение`, { waitUntil: "networkidle" });
    await connectPlugin(asked, SOLO);
    await openMore(asked);
    await asked.click(`[data-testid="plugin-button"][data-plugin="${SOLO}"]`);
    try {
      await asked.waitForSelector('[data-testid="plugin-approval"]', { timeout: 5000 });
    } catch {
      done(1, "клик по кнопке без выданного правила не открыл окно одобрения — вызов прошёл без спроса или окно потерялось");
    }
    const answers = await asked.$$eval('[data-testid="plugin-approval"] button', (els) => els.map((el) => el.textContent.trim()));
    for (const answer of ["Разрешить", "Разрешить для этого чата", "Отказать"]) {
      if (!answers.includes(answer)) {
        done(1, `в окне одобрения нет ответа «${answer}»: кнопки окна — ${answers.join(", ") || "ни одной"}`);
      }
    }

    // м) Отказ — строка «⚠ … requires approval» в ленте, вызов не идёт -------------
    await asked.click('text="Отказать"');
    try {
      await asked.waitForFunction(
        () => {
          const tools = document.querySelectorAll('[data-testid="feed"] .feed__row--tool');
          return Array.from(tools).some((row) => row.textContent.includes("requires approval"));
        },
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, `после «Отказать» в ленте нет строки отказа «⚠ ${SOLO} · ${SOLO_COMMAND} requires approval»: есть ${JSON.stringify(await toolRows(asked))}`);
    }
    if ((await toolRows(asked)).filter((row) => row.startsWith("⧗") && row.includes(SOLO)).length) {
      done(1, "после «Отказать» в ленте есть строка запуска команды — движку ушёл отвергнутый вызов");
    }
    try {
      await asked.waitForSelector('[data-testid="plugin-approval"]', { timeout: 5000 });
      done(1, "окно одобрения после «Отказать» осталось открытым — решение принято, окно должно уйти");
    } catch {
      // Окно ушло — так и должно быть.
    }

    // н) Отказ не запоминает правило: следующий клик спрашивает снова -------------
    await openMore(asked);
    await asked.click(`[data-testid="plugin-button"][data-plugin="${SOLO}"]`);
    try {
      await asked.waitForSelector('[data-testid="plugin-approval"]', { timeout: 5000 });
    } catch {
      done(1, "после отказа окно одобрения не пришло на новый клик — отказ запомнился как правило, а «Отказать» правило не выдаёт");
    }

    // о) «Разрешить для этого чата» — тот же вызов исполняется ---------------------
    await asked.click('text="Разрешить для этого чата"');
    try {
      await asked.waitForFunction(
        (needle) => {
          const tools = document.querySelectorAll('[data-testid="feed"] .feed__row--tool');
          return Array.from(tools).some((row) => row.textContent.includes(needle));
        },
        `⧗ ${SOLO} ·`,
        { timeout: 5000 },
      );
    } catch {
      done(1, `после «Разрешить для этого чата» команда не исполнилась: строк запуска нет — есть ${JSON.stringify(await toolRows(asked))}`);
    }

    // п) Правило чата помнится: тот же вызов больше не спрашивает ------------------
    await openMore(asked);
    await asked.click(`[data-testid="plugin-button"][data-plugin="${SOLO}"]`);
    try {
      await asked.waitForSelector('[data-testid="plugin-approval"]', { timeout: 5000 });
      done(1, "одобренное «для этого чата» правило спрашивают снова — решение на чат не запомнилось");
    } catch {
      // Окна нет — правило выдано и действует.
    }
    try {
      await asked.waitForFunction(
        (needle) => {
          const tools = document.querySelectorAll('[data-testid="feed"] .feed__row--tool');
          return Array.from(tools).filter((row) => row.textContent.includes(needle)).length > 1;
        },
        `⧗ ${SOLO} ·`,
        { timeout: 5000 },
      );
    } catch {
      done(1, "повторный клик после одобрения «для этого чата» не дал новой строки запуска — окна не было, и команда не ушла");
    }
    await asked.close();

    done(
      0,
      `меню «+» с разделами Files/Context/Capabilities, Connect plugin открывает список с поиском, плагин подключается пунктом в меню «⋯» и держится после перерисовки, одна команда — один пункт, недавние и избранное по разделам, пин и снятие пина переживут перезапуск, пустой список объяснён словами, клик по пункту даёт строку вызова инструмента в ленте, окно одобрения спрашивает [Разрешить/Разрешить для этого чата/Отказать], отказ — строка requires approval без вызова, «для этого чата» исполняет и больше не спрашивает`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий плагинов упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}