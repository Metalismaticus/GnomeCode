// Снимки окна настроек (docs/specs/2026-10-06-12-nastrojki.md, «Где снимать»):
// четыре вкладки страницы, раскрытое поле ключа, отказ ключа, недоступный
// движок, светлaя тема и минимум 1024×640; режим «по умолчанию» панели
// сравнения — кликом сценария. Отдельная команда (не в SHOTS settings_shot):
// у каждого ракурса своё состояние адреса, а не действия.
//
//   node tests/ui/settings_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2
// Playwright не водит (docs/TESTING.md, «Ловушки стека»); поле ключа в
// headless-снимке живёт в фикстуре.
import { done, openShotPage, startInterface, startShot, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
const PAGE = '[data-testid="settings-page"]';
const COMPARE = '[data-testid="compare-panel"]';
const MODEL_ROW = '[data-testid="settings-provider-row"][data-provider="anthropic"]';

/** Ракурсы: состояние адреса открывает страницу на своей вкладке сам —
 *  кликов владельца не нужно. Признак кадра — текст, который есть только в нём. */
const SHOTS = [
  {
    name: "settings-1440x900",
    query: "?состояние=настройки",
    seen: ["Настройки", "Внешний вид", "Тема", "Язык интерфейса", "Русский", "Переводы на другие языки появятся позже"],
  },
  {
    name: "settings-1440x900-light",
    query: "?состояние=настройки&тема=светлая",
    theme: "light",
    seen: ["Настройки", "Язык интерфейса", "Русский"],
  },
  {
    name: "settings-models-1440x900",
    query: "?состояние=настройки-модели",
    seen: ["Модель по умолчанию", "GLM-5.3 High", "Изменить →", "ZhipuAI", "ключ задан ✓", "Anthropic", "ключ не задан", "OpenAI", "Ключи хранит Windows (Диспетчер учётных данных) — в файлах проекта их нет"],
  },
  {
    name: "settings-key-1440x900",
    query: "?состояние=настройки-ключ",
    seen: ["Ключ API", "Отмена", "Сохранить"],
  },
  {
    name: "settings-key-error-1440x900",
    query: "?состояние=настройки-ключ-ошибка",
    seen: ["Не принято: провайдер отклонил ключ: 401 unauthorized"],
  },
  {
    name: "settings-rules-1440x900",
    query: "?состояние=настройки-плагины",
    seen: ["Базовые права для всех плагинов", "Действует, пока у плагина нет своего права (раздел «Плагины» → Configure)", "Read", "Write", "Network", "Terminal"],
  },
  {
    name: "settings-data-1440x900",
    query: "?состояние=настройки-данные",
    seen: ["Папка данных", "C:\\Users\\Metalismatic\\AppData\\Roaming\\com.gnomecode.app\\data", "Скопировать", "Папку задаёт запуск приложения — смену пути в окне не делаем"],
  },
  {
    name: "settings-engine-1440x900",
    query: "?состояние=настройки-движок",
    seen: ["Движок недоступен — список провайдеров не читается", "Повторить", "Модель по умолчанию", "GLM-5.3 High"],
  },
];

/** Текст в кадре: едят переносы — страница сверяется нормализованной строкой. */
const waitText = async (page, text) => {
  await page.waitForFunction(
    (wanted) => document.body.textContent.includes(wanted),
    text,
    { timeout: 15_000 },
  );
};

// Подъём до try, как у любого сценария-снимка: done() выходит из процесса,
// за остановку сервера следит его exit-хук в startInterface.
const iface = await startInterface();
try {
  const { url, browser } = await startShot(OUT_DIR, iface);
  try {
    for (const shot of SHOTS) {
      const { context, page } = await openShotPage(browser, url, shot.query, shot.theme ?? null);
      await page.waitForSelector(PAGE, { timeout: 15_000 });
      const body = await page.$eval(PAGE, (el) => el.textContent.replace(/\s+/g, " ").trim());
      for (const text of shot.seen) {
        if (!body.includes(text)) {
          done(1, `в кадре ${shot.name} нет «${text}»: есть «${body.slice(0, 200)}»`);
        }
      }
      const file = `${OUT_DIR}/${shot.name}.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${shot.query}`);
      await context.close();
    }

    // Поле ключа: пустое поле — «Сохранить» выключена с причиной в title.
    {
      const { context, page } = await openShotPage(browser, url, "?состояние=настройки-ключ", null);
      await page.waitForSelector(`${PAGE} ${MODEL_ROW}`, { timeout: 15_000 });
      await page.waitForSelector('[data-testid="settings-key-form"]', { timeout: 15_000 });
      const field = await page.$eval('[data-testid="settings-key-form"] input', (el) => ({
        value: el.value, placeholder: el.placeholder,
      }));
      if (field.value !== "" || field.placeholder !== "Вставьте ключ провайдера") {
        done(1, `в кадре settings-key поле ключа не пустое или без подсказки: значение «${field.value}», подсказка «${field.placeholder}» — ключ не должен появиться на экране`);
      }
      const save = await page.$eval('[data-testid="settings-key-save"]', (el) => ({
        disabled: el.disabled, title: el.title,
      }));
      if (!save.disabled || save.title !== "Вставьте ключ") {
        done(1, `пустое поле ключа: «Сохранить» не выключена с подсказкой «Вставьте ключ» (title «${save.title}», выключена — ${save.disabled})`);
      }
      const file = `${OUT_DIR}/settings-key-1440x900.png`;
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ?состояние=настройки-ключ`);
      await context.close();
    }

    // 1024×640 — минимум: вкладки без скролла, ничего не прячется.
    const narrow = await browser.newContext({ viewport: { width: 1024, height: 640 } });
    const page = await narrow.newPage();
    await page.goto(`${url}?состояние=настройки-модели`, { waitUntil: "networkidle" });
    await page.waitForSelector(PAGE, { timeout: 15_000 });
    await waitText(page, "ключ задан ✓");
    const frame = await page.$eval("html", (el) => `${el.clientWidth}x${el.clientHeight}`);
    if (frame !== "1024x640") {
      done(1, `кадр 1024×640 снят при размере страницы ${frame}`);
    }
    const pageWidth = await page.$eval(PAGE, (el) => Math.round(el.getBoundingClientRect().width));
    if (pageWidth > 1024) {
      done(1, `в кадре 1024×640 страница шире окна: ${pageWidth} — горизонтальный скролл`);
    }
    await page.screenshot({ path: `${OUT_DIR}/settings-models-1024x640.png` });
    console.log(`снимок ${OUT_DIR}/settings-models-1024x640.png: ?состояние=настройки-модели 1024×640`);
    await narrow.close();

    // Режим «по умолчанию» панели сравнения: клик «Изменить →» сценарием.
    const wide = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const pick = await wide.newPage();
    await pick.goto(`${url}?состояние=настройки-модели`, { waitUntil: "networkidle" });
    await pick.click('[data-testid="settings-open-compare"]');
    try {
      await pick.waitForSelector(COMPARE, { timeout: 15_000 });
    } catch {
      done(1, "клик «Изменить →» не открыл панель сравнения: нет [data-testid=compare-panel]");
    }
    await waitText(pick, "Выбор модели по умолчанию");
    const compareBody = await pick.$eval(COMPARE, (el) => el.textContent.replace(/\s+/g, " ").trim());
    for (const text of ["Выбор модели по умолчанию", "GLM-5.3 High", "Уже по умолчанию", "По умолчанию"]) {
      if (!compareBody.includes(text)) {
        done(1, `в кадре панели режима «по умолчанию» нет «${text}»: есть «${compareBody.slice(0, 200)}»`);
      }
    }
    const outside = await pick.$eval("html", (el) => {
      // Мера — правый край колонки сайдбара: строки шестерёнки в сайдбаре больше
      // нет (§18 спеки сайдбара), колонка всегда на месте.
      const sidebar = document.querySelector(".sidebar");
      const panel = document.querySelector('[data-testid="compare-panel"]');
      if (!sidebar || !panel) {
        return { sidebar: false, panel: false };
      }
      const left = sidebar.getBoundingClientRect().right;
      const panelLeft = panel.getBoundingClientRect().left;
      return { sidebar: panelLeft >= left - 1, panel: true };
    });
    if (!outside.sidebar) {
      done(1, "панель сравнения накрыла сайдбар — оверлей должен держаться внутри области страницы");
    }
    const gap = await pick.$eval("html", (el) => {
      const page = document.querySelector('[data-testid="settings-page"]');
      const panel = document.querySelector('[data-testid="compare-panel"]');
      if (!page || !panel) {
        return { panel: false, bottom: 0, token: 0 };
      }
      const token = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--space-5")) || 0;
      return {
        panel: true,
        bottom: Math.round(page.getBoundingClientRect().bottom - panel.getBoundingClientRect().bottom),
        token,
      };
    });
    if (!gap.panel) {
      done(1, "рамка отступа панели: нет settings-page или compare-panel в кадре");
    }
    if (gap.bottom !== gap.token) {
      done(1, `панель сравнения в режиме «по умолчанию» висит в ${gap.bottom} px от низа страницы, а не в var(--space-5) = ${gap.token} px (спека «Раскладка»: top 56 / right 24 / bottom 24 от края страницы)`);
    }
    await pick.screenshot({ path: `${OUT_DIR}/settings-compare-default-1440x900.png` });
    console.log(`снимок ${OUT_DIR}/settings-compare-default-1440x900.png: ?состояние=настройки-модели + «Изменить →»`);
    await wide.close();
  } finally {
    await browser.close();
  }
  done(0, "снимки окна настроек сняты в shots/: 10 кадров (четыре вкладки, ключ раскрыт и с отказом, недоступный движок, светлая тема, 1024×640, режим «по умолчанию»)");
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимков окна настроек упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
