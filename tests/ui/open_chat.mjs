// Открытие старого чата кликом из сайдбара (слова владельца 2026-10-10:
// «чаты все неактивные, мб баг от прошлых использований», разбор —
// docs/specs/2026-10-10-4-сайдбар.md, §18): строка истории — кнопка, клик
// открывает переписку этого чата, титул в шапке — его, активная строка
// переключается, вопрос уходит в тот же чат, клик по активной строке ленту
// не сбрасывает.
//
//   node tests/ui/open_chat.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Сессию движка команда меняет в окне Tauri — страница фикстуры стережёт сам
// ход: лента чистится событием reset и наполняется разговором выбранного чата;
// сессии ядра в фиксстуре отвечает её память разговоров.
import { done, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const COMPOSER = '[data-testid="composer"]';
const TITLE = '[data-testid="chat-title"]';
const HEADER = '[data-testid="chat-header"]';
const HISTORY_ROW = '[data-testid="chat-row"]';
const ACTIVE_ROW = '[data-testid="chat-active"]';
const STATS = '[data-testid="stats-page"]';
const FIRST = "Проверь, как работает старый чат";
const OLD_TITLE = "Мост к OpenCode server";
const OLD_PREVIEW = "Типизированный клиент в src-tauri, React не зовёт HTTP";
const SECOND = "Вопрос уже в открытом чате";

const iface = await startInterface();

/** Ждать текст в шапке чата: появился — хорошо, нет — честный провал с тем,
 *  что в шапке оказалось вместо ожидаемого. */
const waitTitle = async (page, needle, failLine) => {
  try {
    await page.locator(TITLE).filter({ hasText: needle }).waitFor({ timeout: 15_000 });
  } catch {
    done(1, `${failLine}: в шапке «${await title(page)}», а не «${needle}»`);
  }
};

try {
  const { browser, page } = await openStatePage(iface, "");
  try {

    // 1. Спросить: вопрос становится титулом, в «Чатах» появилась активная строка.
    await page.fill(COMPOSER, FIRST);
    await page.keyboard.press("Control+Enter");
    await waitTitle(page, FIRST, "вопрос не стал титулом чата");

    // 2. Клик по строке истории: лента показывает разговор этого чата, шапка —
    //    его название, активная строка переключилась, прошлый чат остался.
    const oldRow = page.locator(HISTORY_ROW).filter({ hasText: OLD_TITLE }).first();
    try {
      await oldRow.waitFor({ state: "visible", timeout: 15_000 });
    } catch {
      done(1, "строки истории не стали кнопками: нет [data-testid=chat-row] с чатом из списка");
    }
    await oldRow.click();
    await waitTitle(page, OLD_TITLE, "клик по строке истории не открыл чат");
    await feedContains(page, OLD_PREVIEW, "история открытого чата (ответ-превью) не появилась в ленте");
    await feedContains(page, OLD_TITLE, "вопрос открытого чата не появился в ленте");
    if (await feedIncludes(page, FIRST)) {
      done(1, "старый вопрос остался в ленте после открытия другого чата — лента не чистилась reset");
    }
    const active = await textOf(page, ACTIVE_ROW);
    if (!active.includes(OLD_TITLE)) {
      done(1, `активная строка не переключилась: она «${active}», а не «${OLD_TITLE}»`);
    }
    const previous = await rows(page);
    if (!previous.some((line) => line.includes(FIRST))) {
      done(1, "прежний активный чат пропал из списка — строка первого вопроса не осталась в «Чатах»");
    }

    // 3. Вопрос уходит в открытый чат: ответ появляется в той же ленте, титул
    //    чата не переписывается.
    await page.fill(COMPOSER, SECOND);
    await page.keyboard.press("Control+Enter");
    await feedContains(page, SECOND, "вопрос после открытия не появился в ленте открытого чата");
    await feedContains(page, "Смотрю структуру папки. Мост на месте.", "ответ не пришёл в ленту открытого чата");
    if (!(await title(page)).includes(OLD_TITLE)) {
      done(1, `новый вопрос переписал титул открытого чата: в шапке «${await title(page)}»`);
    }

    // 4. Клик по активной строке возвращает на экран чата и ленту не сбрасывает:
    //    из раздела «Статистика», как ходит владелец. Reset сбросил бы титул —
    //    по нему и видно (содержимое ленты после перемонтирования страницы
    //    фикстура не возвращает — docs/BATCH.md, пункт 1, ограничение).
    await page.click('[data-testid="sidebar-stats"]');
    try {
      await page.waitForSelector(STATS, { timeout: 15_000 });
    } catch {
      done(1, "строка «Статистика» не открыла раздел: нет [data-testid=stats-page]");
    }
    await page.click(ACTIVE_ROW);
    try {
      await page.waitForSelector(HEADER, { timeout: 15_000 });
    } catch {
      done(1, "клик по активной строке не вернул экран чата — страница не сменилась");
    }
    if (!(await title(page)).includes(OLD_TITLE)) {
      done(1, `клик по активному чату сбросил ленту: в шапке «${await title(page)}», а не «${OLD_TITLE}»`);
    }

    // 5. Прежний чат открывается так же: клик по его строке — его разговор
    //    в ленте и его титул в шапке.
    await page.locator(HISTORY_ROW).filter({ hasText: FIRST }).first().click();
    await waitTitle(page, FIRST, "повторное открытие не сработало");
    await feedContains(page, FIRST, "история прежнего чата не появилась в ленте");

    await done(
      0,
      "старый чат открывается кликом из сайдбара: лента чистится и показывает его вопросы и ответы, в шапке — его название, активная строка переключилась, прежний чат остался в списке и открывается так же, новый вопрос уходит в открытый чат без смены титула, клик по активной строке возвращает на экран чата и ленту не сбрасывает",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий «Открытие старого чата» упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}

/** Титул чата из шапки. */
async function title(page) {
  return (await textOf(page, TITLE)) || "Новый чат";
}

/** Текст элемента, если он на странице. */
async function textOf(page, selector) {
  return (await page.$eval(selector, (el) => el.textContent.trim()).catch(() => "")) ?? "";
}

/** Лента одним текстом: строки подряд — по ним ищут реплики. */
async function feedText(page) {
  return (await page.$eval('[data-testid="feed"]', (el) => el.textContent).catch(() => "")) ?? "";
}

/** Реплика появилась в ленте: ждать, потом честно упасть с текстом. */
async function feedContains(page, needle, failLine) {
  try {
    await page.waitForFunction(
      (needle) => document.querySelector('[data-testid="feed"]')?.textContent?.includes(needle),
      needle,
      { timeout: 15_000 },
    );
  } catch {
    done(1, `${failLine}: в ленте нет «${needle}»`);
  }
}

async function feedIncludes(page, needle) {
  return (await feedText(page)).includes(needle);
}

/** Строки раздела «Чаты»: активная строка и кнопки истории. */
async function rows(page) {
  return page.$$eval(`${ACTIVE_ROW}, ${HISTORY_ROW}`, (els) => els.map((el) => el.textContent ?? ""));
}
