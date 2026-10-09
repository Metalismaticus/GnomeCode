// «Новый чат» (замечание владельца 2026-10-06: «новый чат не могу создать»):
// кнопка сайдбара и карточка приветствия чистят ленту, титул чата сбрасывается —
// следующий вопрос снова становится титулом. Баг владельца 09.10 («новый чат
// не открывается вообще, приходится по вкладкам ходить»): клик из раздела
// «Статистика» возвращает на экран чата.
//
//   node tests/ui/new_chat.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Живую сессию движка команда меняет в окне Tauri — страница фикстуры стережёт
// сам ход: лента чистится событием reset, интерфейс приходит в начальный вид.
import { done, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const COMPOSER = '[data-testid="composer"]';
const TITLE = '[data-testid="chat-title"]';
const HEADER = '[data-testid="chat-header"]';
const NEW_CHAT = '[data-testid="btn-new-chat"]';
const CARD = '[data-testid="welcome-scenario"][title="Новый чат"]';
const STATS = '[data-testid="stats-page"]';
const FIRST = "Проверь, как работает новый чат";
const SECOND = "Второй вопрос в чистой ленте";

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "");
  try {

    // 1. Задать вопрос: лента наполняется, вопрос становится титулом чата ---------
    await page.fill(COMPOSER, FIRST);
    await page.keyboard.press("Control+Enter");
    try {
      await page.waitForFunction(
        (needle) => document.querySelector('[data-testid="chat-title"]')?.textContent?.includes(needle),
        FIRST,
        { timeout: 15_000 },
      );
    } catch {
      done(1, `вопрос не стал титулом чата: в шапке «${await title(page)}», а не «${FIRST}»`);
    }
    const rowsBefore = await rows(page);
    if (rowsBefore < 1) {
      done(1, "после вопроса лента пуста — спросить не получилось, чистить нечего");
    }

    // 2. Кнопка сайдбара «Новый чат»: лента чистится, титул сбрасывается ----------
    await page.click(NEW_CHAT);
    await waitEmpty(page, "клик по кнопке «Новый чат» в сайдбаре");
    if ((await title(page)) !== "Новый чат") {
      done(1, `после «Нового чата» в шапке «${await title(page)}», а не «Новый чат» — титул прошлого чата остался`);
    }

    // 3. Карточка приветствия «Новый чат» ведёт себя так же: лента уже чиста,
    //    повторный ход ничего не ломает и титул не портит ------------------------
    await page.click(CARD);
    await waitEmpty(page, "клик по карточке приветствия «Новый чат»");
    if ((await title(page)) !== "Новый чат") {
      done(1, `после карточки приветствия в шапке «${await title(page)}», а не «Новый чат»`);
    }

    // 4. Следующий вопрос живёт в чистой ленте и снова становится титулом ---------
    await page.fill(COMPOSER, SECOND);
    await page.keyboard.press("Control+Enter");
    try {
      await page.waitForFunction(
        (needle) => document.querySelector('[data-testid="chat-title"]')?.textContent?.includes(needle),
        SECOND,
        { timeout: 15_000 },
      );
    } catch {
      done(1, `вопрос после «Нового чата» не стал титулом: в шапке «${await title(page)}», а не «${SECOND}»`);
    }
    const old = await page.$$eval('[data-testid="feed"] .feed__row', (els) => els.map((el) => el.textContent ?? "").join("\n"))
      .catch(() => "");
    if (old.includes(FIRST)) {
      done(1, "строка первого вопроса осталась в ленте после «Нового чата» — лента не чистится");
    }

    // 5. «Новый чат» из раздела «Статистика» (баг владельца 09.10: «новый чат
    //    не открывается вообще, приходится по вкладкам ходить»): строка сайдбара
    //    открывает раздел, клик возвращает на экран чата с пустой лентой.
    //    В раздел заходим строкой сайдбара из состояния «пусто» — маршрут из
    //    карточки. Фикстурный мост, в отличие от живого, не хранит ленту между
    //    подписками (буфер повтора — только в Rust), поэтому пустоту после
    //    перемонтирования даёт состояние «пусто»: его лента пуста, как у
    //    владельца в окне после reset из буфера повтора.
    const stats = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await stats.goto(`${iface.url}?состояние=пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await stats.waitForSelector('[data-testid="empty"]', { timeout: 15_000 });
    } catch {
      done(1, "состояние «пусто» не открыло чистый чат: приветственной сборки нет");
    }
    await stats.click('[data-testid="sidebar-stats"]');
    try {
      await stats.waitForSelector(STATS, { timeout: 15_000 });
    } catch {
      done(1, "строка «Статистика» не открыла раздел: нет [data-testid=stats-page]");
    }
    await stats.click(NEW_CHAT);
    try {
      await stats.waitForSelector(HEADER, { timeout: 15_000 });
    } catch {
      done(1, "«Новый чат» из раздела «Статистика» не открыл экран чата — страница не сменилась");
    }
    await waitEmpty(stats, "клик «Нового чата» из раздела «Статистика»");
    if ((await title(stats)) !== "Новый чат") {
      done(1, `после «Нового чата» из «Статистики» в шапке «${await title(stats)}», а не «Новый чат»`);
    }

    await done(
      0,
      "новый чат создаётся: кнопка сайдбара и карточка приветствия чистят ленту (прошлый вопрос пропадает), титул сбрасывается на «Новый чат», следующий вопрос снова становится титулом; из раздела «Статистика» «Новый чат» открывает экран чата с пустой лентой",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий «Новый чат» упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}

/** Титул чата из шапки. */
async function title(page) {
  return (await page.$eval(TITLE, (el) => el.textContent.trim())) ?? "";
}

/** Строки ленты: прямые дети с классом строки, приветствие и блоки источников не в счёт. */
async function rows(page) {
  return page.$$eval('[data-testid="feed"] > .feed__row', (els) => els.length).catch(() => 0);
}

/** Лента чиста: приветственная сборка на месте, строк ленты нет. */
async function waitEmpty(page, what) {
  try {
    await page.waitForSelector('[data-testid="empty"]', { timeout: 15_000 });
  } catch {
    done(1, `${what} не очистил ленту: приветственная сборка не вернулась`);
  }
  const left = await rows(page);
  if (left > 0) {
    done(1, `${what} оставил ${left} строк в ленте — лента не чистая`);
  }
}
