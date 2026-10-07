// Автообновление плагинов с GitHub при запуске (docs/SPEC/plugins.md, сцена K):
// версия новее в индексе → обновилось само, прав не менялось — ни одного вопроса;
// права изменились → сводка новых прав до включения, и по решению владельца
// (2026-10-06, docs/BLOCKED.md) она открывается сама при старте окна — held-запись
// updates.json, а не клик по карточке. «Отмена» оставляет карточку «ждёт прав»
// с кнопкой «Обновить», «Разрешить» переносит обновление.
//
//   node tests/ui/plugin_updates.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: фикстура состояния `?состояние=плагины-обновления`
// зеркалит updates.json (src-tauri/src/plugins/updates.rs) — git 1.0.0→1.1.0 молча
// (права те же), docs 0.9.0→1.0.0 ждёт прав (новая категория) и его сводка открыта
// на экране до любого клика, browser 0.6.2→0.6.3 уже обновился.
import { done, startInterface, openStatePage, INSTALL } from "../lib/ui_lib.mjs";

const TAB = '[data-testid="plugin-tab-updates"]';
const CARD = '[data-testid="plugin-update-card"]';
const SUMMARY = '[data-testid="plugin-summary"]';

const card = (id) => `${CARD}[data-plugin="${id}"]`;
const part = (name) => (id) => `${card(id)} [data-testid="plugin-update-${name}"]`;
const versions = part("versions");
const version = part("version");
const status = part("status");
const allowButton = part("allow");

/** Текст элемента одной строкой. */
const text = async (page, selector) =>
  (await page.$eval(selector, (el) => el.textContent.replace(/\s+/g, " ").trim()));

const iface = await startInterface();
try {
  const { browser, page } = await openStatePage(iface, "плагины-обновления");
  try {

    // а) Вкладка Updates открыта своим состоянием, карточки обновлений на месте ----
    try {
      await page.waitForSelector(TAB, { timeout: 5000 });
    } catch {
      done(1, "состояние «плагины-обновления» не открыло раздел «Плагины»: нет вкладки Updates");
    }
    const selected = await page.$eval(TAB, (el) => el.getAttribute("aria-selected"));
    if (selected !== "true") {
      done(1, "вкладка Updates не выбрана в состоянии «плагины-обновления» — карточки не показаны");
    }
    try {
      await page.waitForSelector(card("git"), { timeout: 5000 });
    } catch {
      done(1, "на вкладке Updates нет карточек обновлений: нет [data-testid=plugin-update-card] — вкладка всё ещё заглушка");
    }
    for (const [id, from, to] of [["git", "1.0.0", "1.1.0"], ["docs", "0.9.0", "1.0.0"], ["browser", "0.6.2", "0.6.3"]]) {
      const line = await text(page, versions(id));
      if (!line.includes(from) || !line.includes(to)) {
        done(1, `в карточке «${id}» нет версий «${from} → ${to}»: «${line}» — изменения обновления не видны`);
      }
    }

    // б) Молча обновившийся: «обновлено», версия карточки — новая, кнопки сводки нет
    const gitStatus = await text(page, status("git"));
    if (!gitStatus.includes("обновлено")) {
      done(1, `обновление «git» без изменения прав не помечено «обновлено»: «${gitStatus}»`);
    }
    const gitVersion = await text(page, version("git"));
    if (!gitVersion.includes("1.1.0")) {
      done(1, `версия «git» в карточке не обновилась до 1.1.0: «${gitVersion}»`);
    }
    if (await page.$(`${allowButton("git")}`)) {
      done(1, "у молча обновившегося «git» есть кнопка сводки прав — вопросов при обновлении без новых прав не задают");
    }

    // в) Старт при удержанном обновлении: сводка новых прав открыта сама, до клика --
    try {
      await page.waitForSelector(SUMMARY, { timeout: 5000 });
    } catch {
      done(1, "сводка новых прав ждущего обновления не открылась сама при старте окна — без клика по карточке её нет");
    }
    const summary = await text(page, SUMMARY);
    for (const right of ["Docs", "Read", "файлы документации", "Write", "ask"]) {
      if (!summary.includes(right)) {
        done(1, `в авто-сводке нет «${right}»: «${summary}» — окно открыто не про ждущее прав обновление`);
      }
    }

    // г) «Отмена» авто-сводки: карточка «ждёт прав» с кнопкой, окно не возвращается
    await page.click('[data-testid="summary-cancel"]');
    try {
      await page.waitForSelector(allowButton("docs"), { timeout: 5000 });
    } catch {
      done(1, "после «Отмена» у карточки «docs» нет кнопки «Обновить» — ждущее прав обновление потеряно");
    }
    const heldStatus = await text(page, status("docs"));
    if (!heldStatus.includes("ждёт прав")) {
      done(1, `после «Отмена» карточка «docs» не «ждёт прав»: «${heldStatus}» — отмена не должна принимать обновление`);
    }
    if (await page.isVisible(SUMMARY)) {
      done(1, "после «Отмена» сводка осталась открытой — ответ не принят");
    }

    // д) Повторный клик «Обновить» открывает сводку снова ---------------------------
    await page.click(allowButton("docs"));
    try {
      await page.waitForSelector(SUMMARY, { timeout: 5000 });
    } catch {
      done(1, "кнопка «Обновить» не открыла сводку снова — после отмены обновление недостижимо");
    }

    // е) «Разрешить»: версия карточки обновляется, пометка «обновлено», окно ушло --
    await page.click('[data-testid="summary-allow"]');
    try {
      await page.waitForFunction(
        () =>
          document.querySelector('[data-testid="plugin-update-card"][data-plugin="docs"]')
            ?.textContent.includes("обновлено") ?? false,
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после «Разрешить» карточка «docs» не помечена «обновлено» — сводка прав не приняла обновление");
    }
    const docsVersion = await text(page, version("docs"));
    if (!docsVersion.includes("1.0.0")) {
      done(1, `после «Разрешить» версия карточки «docs» не стала 1.0.0: «${docsVersion}»`);
    }
    if (await page.isVisible(SUMMARY)) {
      done(1, "сводка прав после «Разрешить» осталась открытой — решение принято, окно должно уйти");
    }

    // ж) Остальные карточки сводка не тронула: обновление только у «docs» ----------
    for (const id of ["git", "browser"]) {
      const one = await text(page, status(id));
      if (!one.includes("обновлено")) {
        done(1, `после «Разрешить» у «${id}» пометка изменилась: «${one}» — сводка обновляет только свой плагин`);
      }
    }

    done(
      0,
      "старт при удержанном обновлении: сводка новых прав «docs» (Read, Write) открыта сама, без клика; «Отмена» оставила карточку «ждёт прав» с кнопкой «Обновить», повторный клик открыл сводку снова; «Разрешить» поставил версию 1.0.0 и пометку «обновлено»; молча обновившиеся «git» 1.1.0 и «browser» 0.6.3 — «обновлено» без кнопок сводки и окон",
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий автообновления упал: ${text.split("\n").filter(Boolean).slice(0, 4).join(" | ")}`);
} finally {
  iface.stop();
}
