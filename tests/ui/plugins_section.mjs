// Раздел «Плагины»: карточки и действия (docs/BATCH.md, пункт 2; docs/SPEC/plugins.md,
// сцена A — открывается из главной левой навигации, четыре вкладки: Installed /
// Available / Updates / Disabled).
//
//   python -X utf8 tools/run_checks.py plugins_section
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: вне окна интерфейс получает фикстуру
// (src/fixturePlugins.ts, состояние `?состояние=плагины-раздел`).
import { chromium } from "@playwright/test";

import { closeMore, done, openMore, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
const SIDEBAR = '[data-testid="sidebar-plugins"]';
const PAGE = '[data-testid="plugins-page"]';
const TAB = (name) => `[data-testid="plugin-tab-${name}"]`;
const CARD = '[data-testid="plugin-card"]';
const UNINSTALL = '[data-testid="plugin-uninstall"]';
const CHAT = '[data-testid="chat-active"]';
const ADD = '[data-testid="composer-add"]';
const CONNECT = '[data-testid="add-connect-plugin"]';
const PICKER = '[data-testid="plugin-picker"]';
const CONFIRM = '[data-testid="plugin-uninstall-confirm"]';

const card = (id) => `${CARD}[data-plugin="${id}"]`;

/** Карточки подряд: их видно по именам, а не по счётчику. */
const cards = (page) => page.$$eval(CARD, (els) => els.map((el) => el.getAttribute("data-plugin")));

/** Тест gcd: текст элемента одной строкой. */
const text = async (page, selector) =>
  (await page.$eval(selector, (el) => el.textContent.replace(/\s+/g, " ").trim()));

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: WIDE });
    await page.goto(`${url}?состояние=плагины-раздел`, { waitUntil: "domcontentloaded", timeout: 90_000 });

    // а) Сайдбар ведёт в раздел: строка «Плагины» и сама страница ---------------
    try {
      await page.waitForSelector(SIDEBAR, { timeout: 5000 });
    } catch {
      done(1, `на экране нет [data-testid="sidebar-plugins"] — сайдбар не ведёт в раздел «Плагины»`);
    }
    try {
      await page.waitForSelector(PAGE, { timeout: 5000 });
    } catch {
      done(1, `строка «Плагины» есть, но страницы раздела нет: на экране нет [data-testid="plugins-page"]`);
    }

    // б) Installed открыт сразу: карточки с полями сцены A -----------------------
    try {
      await page.waitForSelector(TAB("installed"), { timeout: 5000 });
    } catch {
      done(1, `на странице раздела нет вкладки Installed: на экране нет ${TAB("installed")}`);
    }
    const seen = await cards(page);
    for (const id of ["git", "docs", "browser"]) {
      if (!seen.includes(id)) {
        done(1, `во вкладке Installed нет карточки «${id}»: есть ${seen.join(", ") || "ни одной"}`);
      }
    }
    const gitCard = (await text(page, card("git"))).toLowerCase();
    for (const part of ["git", "metalismaticus", "1.0.0", "изменения", "network", "diff", "commit", "активен"]) {
      if (!gitCard.includes(part)) {
        done(1, `в карточке «git» нет «${part}»: «${gitCard}» — карточка без полей сцены A`);
      }
    }
    const brokenCard = (await text(page, card("browser"))).toLowerCase();
    for (const part of ["не запустился", "модуль браузера не установлен"]) {
      if (!brokenCard.includes(part)) {
        done(1, `в карточке «browser» нет статуса/причины «${part}»: «${brokenCard}»`);
      }
    }
    if ((await page.$$( `${card("browser")} ${UNINSTALL}`)).length !== 0) {
      done(1, "у карточки «browser» есть Uninstall — плагин движка вне реестра удалять этой кнопкой нельзя");
    }

    // в) Disabled пуст до первого Disable ---------------------------------------
    await page.click(TAB("disabled"));
    try {
      await page.waitForSelector('[data-testid="plugins-disabled-empty"]', { timeout: 5000 });
    } catch {
      done(1, `вкладка Disabled до первого Disable не говорит о пустоте: нет [data-testid="plugins-disabled-empty"]`);
    }
    if ((await cards(page)).length !== 0) {
      done(1, `вкладка Disabled не пуста до первого Disable: карточки — ${(await cards(page)).join(", ")}`);
    }

    // г) Updates — честная пустота без обновлений: карточек нет и законно ----------
    await page.click(TAB("updates"));
    try {
      await page.waitForSelector('[data-testid="plugin-updates-empty"]', { timeout: 5000 });
    } catch {
      done(1, `на вкладке Updates нет честной пустоты: нет [data-testid="plugin-updates-empty"]`);
    }
    if ((await page.$$eval('[data-testid="plugin-update-card"]', (els) => els.length)) !== 0) {
      done(1, "вкладка Updates не пуста без обновлений — карточки показаны без основания");
    }

    // д) Available — переход в каталог, его видно и можно закрыть ----------------
    await page.click(TAB("available"));
    try {
      await page.waitForSelector('[data-testid="catalog-picker"]', { timeout: 5000 });
    } catch {
      done(1, "вкладка Available не открыла каталог: на экране нет [data-testid=catalog-picker]");
    }
    if (!(await page.$$eval('[data-testid="catalog-picker"] [data-testid="catalog-card"]', (els) => els.length))) {
      done(1, "каталог из вкладки Available открылся пустым (карточек нет)");
    }
    await page.click('[data-testid="catalog-close"]');
    try {
      await page.waitForSelector(card("git"), { timeout: 5000 });
    } catch {
      done(1, "после закрытия каталога не вернулась вкладка Installed с карточками");
    }

    // е) Uninstall с подтверждением: «Отмена» ничего не удаляет ------------------
    await page.click(`${card("docs")} ${UNINSTALL}`);
    try {
      await page.waitForSelector(CONFIRM, { timeout: 5000 });
    } catch {
      done(1, "клик по Uninstall не открыл окно подтверждения: нет [data-testid=plugin-uninstall-confirm]");
    }
    const answers = await page.$$eval(`${CONFIRM} button`, (els) => els.map((el) => el.textContent.trim()));
    for (const answer of ["Удалить", "Отмена"]) {
      if (!answers.includes(answer)) {
        done(1, `в окне подтверждения нет ответа «${answer}»: кнопки — ${answers.join(", ") || "ни одной"}`);
      }
    }
    await page.click('[data-testid="uninstall-no"]');
    try {
      await page.waitForSelector(CONFIRM, { timeout: 5000 });
      done(1, "окно подтверждения после «Отмена» осталось открытым — решение принято, окно должно уйти");
    } catch {
      // Окно ушло — так и должно быть.
    }
    if (!(await cards(page)).includes("docs")) {
      done(1, "после «Отмена» карточка «docs» пропала — удаление прошло без подтверждения");
    }

    // ж) «Удалить»: карточка уходит из Installed ----------------------------------
    await page.click(`${card("docs")} ${UNINSTALL}`);
    await page.waitForSelector(CONFIRM, { timeout: 5000 });
    await page.click('[data-testid="uninstall-yes"]');
    try {
      await page.waitForFunction(
        (needle) => document.querySelector('[data-testid="plugin-card"]') && true,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      // После удаления карточки всё ещё есть — проверяем списком ниже.
    }
    if ((await cards(page)).includes("docs")) {
      done(1, "после «Удалить» карточка «docs» осталась в Installed — удаление не сработало");
    }

    // з) Disable убирает кнопки из чатов; Enable возвращает -----------------------
    await page.goto(`${url}?состояние=плагины`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.click(ADD);
    await page.waitForSelector(CONNECT, { timeout: 5000 });
    await page.click(CONNECT);
    await page.waitForSelector(PICKER, { timeout: 5000 });
    await page.click(`${PICKER} [data-testid="plugin-row"][data-plugin="git"]`);
    await openMore(page);
    try {
      await page.waitForSelector('[data-testid="plugin-button"][data-plugin="git"]', { timeout: 5000 });
    } catch {
      done(1, "после подключения пункт команды «diff» плагина «git» не появился в меню «⋯»");
    }
    await closeMore(page);
    // Раздел открыт из этого же окна: пункты в меню «⋯» перечитаются при возврате.
    await page.click(SIDEBAR);
    try {
      await page.waitForSelector(card("git"), { timeout: 5000 });
    } catch {
      done(1, "после возврата в раздел карточка «git» не видна во вкладке Installed");
    }
    await page.click(`${card("git")} [data-testid="plugin-disable"]`);
    try {
      await page.waitForFunction(
        () => !document.querySelector('[data-testid="plugin-card"][data-plugin="git"]'),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после Disable карточка «git» осталась во вкладке Installed");
    }
    await page.click(TAB("disabled"));
    try {
      await page.waitForSelector(card("git"), { timeout: 5000 });
    } catch {
      done(1, "после Disable карточка «git» не появилась во вкладке Disabled");
    }
    await page.click(CHAT);
    try {
      await page.waitForSelector('[data-testid="chat-header"]', { timeout: 5000 });
    } catch {
      done(1, "возврат в чат из раздела не удался: шапки нет на экране");
    }
    // Пункты команд живут в открытом меню «⋯» — отсутствие читается в нём же.
    await openMore(page);
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="plugin-button"]').length === 0,
      undefined,
      { timeout: 5000 },
    ).catch(() => done(1, "после Disable пункты команды «diff» плагина «git» остались в меню «⋯»"));
    await closeMore(page);
    // Enable из вкладки Disabled и возврат в чат: пункт возвращается.
    await page.click(SIDEBAR);
    await page.click(TAB("disabled"));
    try {
      await page.waitForSelector(`${card("git")} [data-testid="plugin-enable"]`, { timeout: 5000 });
    } catch {
      done(1, "у карточки «git» во вкладке Disabled нет действия Enable: нет [data-testid=plugin-enable]");
    }
    await page.click(`${card("git")} [data-testid="plugin-enable"]`);
    await page.click(CHAT);
    await openMore(page);
    try {
      await page.waitForSelector('[data-testid="plugin-button"][data-plugin="git"]', { timeout: 5000 });
    } catch {
      done(1, "после Enable пункт команды «diff» не вернулся в меню «⋯»");
    }
    await closeMore(page);

    done(
      0,
      "сайдбар ведёт в раздел «Плагины» со вкладками Installed/Available/Updates/Disabled: карточки показывают имя, автора, версию, описание, права, команды и статус, у карточек из реестра есть Enable/Disable/Uninstall (у плагина движка Uninstall нет), Updates честно пуста без обновлений (пустота законна), Disabled пуст до первого Disable, Available открывает каталог, «Отмена» подтверждения ничего не удаляет, «Удалить» убирает карточку из Installed, Disable убирает пункты команд из меню «⋯», Enable возвращает",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий раздела «Плагины» упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  stop();
}
