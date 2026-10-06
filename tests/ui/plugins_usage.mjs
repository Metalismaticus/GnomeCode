// Активность плагинов и Usage/Audit (docs/BATCH.md, пункт 8; docs/SPEC/plugins.md,
// сцена J — «Клик раскрывает детали»).
//
//   node tests/ui/plugins_usage.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: фикстура зеркалит launch/утечку счётчика
// (src/fixtureApprovals.ts), счётчик — память страницы, перезагрузка обнуляет,
// поэтому сценарий в одной странице без reload.
import { done, connectPlugin, commandButton, openStatePage, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const CARD = '[data-testid="plugin-card"]';

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "плагины");
  try {

    // а) Вызов команды плагина: строка запуска в ленте ------------------------
    await connectPlugin(page, "git");
    await page.click(commandButton("git:diff"));
    try {
      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('[data-testid="feed"] .feed__row--tool'))
          .some((row) => row.textContent.includes("git · diff")),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "вызов diff не дал строки «git · diff» в ленте — клик по кнопке команды не запускает плагин");
    }

    // б) Строка вызова раскрывается деталями сцены J: плагин/чат/скилл/модель --
    try {
      await page.click('[data-testid="feed"] .feed__row--tool:has-text("git · diff")');
    } catch {
      done(1, "строка «git · diff» в ленте не кликается — деталям вызова неоткуда открыться");
    }
    await page.waitForSelector('[data-testid="feed-row-details"]').catch(() =>
      done(1, "plugin run row not expanded on click: no [data-testid=feed-row-details] in feed"),
    );
    const details = await page.$eval('[data-testid="feed-row-details"]', (el) => el.textContent.replace(/\s+/g, " "));
    for (const expect of ["Плагин: git", "Чат: Новый чат", "Скилл: —", "Модель: GLM-5.3 High"]) {
      if (!details.includes(expect)) {
        done(1, `в деталях вызова нет строки «${expect}» — есть «${details}»`);
      }
    }

    // в) Счётчик вызовов на карточке плагина ---------------------------------
    await page.click('[data-testid="sidebar-plugins"]');
    try {
      await page.waitForSelector(`${CARD}[data-plugin="git"]`, { timeout: 5000 });
    } catch {
      done(1, "после вызова в разделе «Плагины» нет карточки «git» — карточки ждать неоткуда");
    }
    await page.waitForSelector(`${CARD}[data-plugin="git"] [data-testid="plugin-card-usage"]`, { timeout: 5000 })
      .catch(() => done(1, "на карточке «git» нет счётчика вызовов: нет [data-testid=plugin-card-usage]"));
    const usage = await page.$eval(`${CARD}[data-plugin="git"] [data-testid="plugin-card-usage"]`, (el) => el.textContent.trim());
    if (usage !== "Вызовов: 1") {
      done(1, `счётчик карточки «git» не равен одному исполненному вызову: «${usage}»`);
    }

    done(
      0,
      "вызов плагина раскрыт деталями (Плагин/Чат/Скилл/Модель), на карточке плагина счётчик исполненных вызовов: «Вызовов: 1»",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий активности плагинов упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
