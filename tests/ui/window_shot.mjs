// Снимок главного окна продукта одной командой: Playwright в headless, окна на экране нет.
// Проверка полигона сама поднимает сервер интерфейса на свободном порту (порт 5173 может
// занять `npm run tauri dev`), снимает канонические ракурсы и гасит сервер.
//
//   node tests/ui/window_shot.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Ограничение: снимается страница интерфейса, а не окно Tauri — WebView2 Playwright не водит.
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

import { attachAllFixtureFiles, done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const OUT_DIR = "shots";
// Титул чата прошлого запуска (§8 «Самое длинное название чата»: вопрос 100+
// знаков): окно хранит первый вопрос обрезанным до 60 знаков с «…» (chatTitleOf,
// src/appstate.ts) — короткое «Новый чат» на 1024×640 усекать нечего (§14.8).
const LAST_LAUNCH_TITLE = "Разбери папку src-tauri и предложи, как разделить мост и сло…";
// Ракурсы из спецификации экрана, «Где снимать»: два канонических плюс состояния и тема,
// которые иначе снять нечем — все они одной командой и одним файлом проверки.
const SHOTS = [
  { name: "main-window-1440x900", size: [1440, 900], query: "", wait: "header", texts: ["Новый чат"] },
  { name: "main-window-1440x900-light", size: [1440, 900], query: "?тема=светлая", wait: "theme", texts: ["Новый чат"] },
  { name: "main-window-1440x900-empty", size: [1440, 900], query: "?состояние=пусто", wait: "empty", texts: ["Добро пожаловать в GnomeCode", "Открыть проект"] },
  // Статус «Не отвечает» живёт в правой панели — она скрыта по умолчанию
  // («тихий хром», §6), кадр ошибки открывает её адресом, как прежде.
  { name: "main-window-1440x900-error", size: [1440, 900], query: "?состояние=ошибка&правая=открыта", text: "Сервер OpenCode недоступен", texts: ["Не отвечает"] },
  // Кадры живого сайдбара (docs/specs/2026-10-10-4-сайдбар.md, §13): поиск
  // снимается адресом `?поиск=`, узкое окно — на состоянии «много».
  { name: "sidebar-search-light", size: [1440, 900], query: "?тема=светлая&поиск=модел", wait: "header", texts: ["Настройки модели по умолчанию", "Статистика расхода"] },
  { name: "sidebar-search-none-light", size: [1440, 900], query: "?тема=светлая&поиск=ффф", wait: "header", texts: ["Ничего не нашлось"] },
  { name: "sidebar-many-1024x640", size: [1024, 640], query: "?состояние=много", wait: "header", texts: ["Разбор главного окна", "Ответ модели получен"] },
  { name: "main-window-1440x900-long", size: [1440, 900], query: "?состояние=много", wait: "rows:100", texts: ["Открыть проект из Documents"] },
  // «Минимум» по §13 спеки: 1024×640 на состоянии «маркдаун» (полный markdown —
  // кадр пункта ленты, docs/specs/2026-10-10-3-лента.md, §12). §14.8 судит кадр
  // «название усечено с «…»» — титул прошлого запуска сидируется зеркалом
  // состояния страницы (src/fixtureState.ts) до загрузки, усечение меряется.
  { name: "main-window-1024x640", size: [1024, 640], query: "?состояние=маркдаун", wait: "step", lastLaunchTitle: LAST_LAUNCH_TITLE, cutTitle: true, texts: [LAST_LAUNCH_TITLE, "Копировать"] },
  // Кадры пункта ленты (docs/specs/2026-10-10-3-лента.md, §12): полный markdown
  // в обеих темах и живой прогресс бегущей строкой.
  { name: "chat-markdown-1440x900", size: [1440, 900], query: "?состояние=маркдаун", wait: "step", texts: ["Копировать", "Sources used", "Детали прокрутки"] },
  { name: "chat-markdown-1440x900-light", size: [1440, 900], query: "?состояние=маркдаун&тема=светлая", wait: "step-light", texts: ["Копировать", "Sources used"] },
  { name: "chat-progress-1440x900", size: [1440, 900], query: "?состояние=прогресс", wait: "feed-run", texts: ["Ищу"] },
  // Кадры «тихого хрома» (docs/specs/2026-10-09-2-тихий-хром.md, §13): панель скрыта
  // по умолчанию на любой ширине; меню «⋯» и панель снимаются адресом.
  { name: "chat-more-1440x900", size: [1440, 900], query: "?состояние=разбор&меню=открыто", wait: "menu", texts: ["Контекст проекта", "Плагины этого чата", "Настройки"] },
  { name: "main-window-1440x900-panel", size: [1440, 900], query: "?состояние=разбор&правая=открыта", wait: "panel", texts: ["Контекст проекта"] },
  { name: "main-window-1024x640-panel", size: [1024, 640], query: "?состояние=разбор&правая=открыта", wait: "panel", texts: ["Контекст проекта"] },
  // Чипы приложенных файлов одной линией (§7): панель проекта открывается адресом,
  // файлы прикладываются кликами по дереву, панель закрывается — композер виден
  // целиком. На 1440 и 1024 чипы в колонку помещаются; переполнение и запрет
  // переноса числами стережёт window_look (пробная ширина 800).
  { name: "main-window-1440x900-chips", size: [1440, 900], query: "?состояние=проект&правая=открыта", wait: "panel", chips: true, texts: ["README.md", "tokens.css"] },
  { name: "main-window-1024x640-chips", size: [1024, 640], query: "?состояние=проект&правая=открыта", wait: "panel", chips: true, texts: ["README.md", "tokens.css"] },
  // Кадры пункта 11 (docs/specs/2026-10-06-11-glavnoe.md, «Где снимать»): приветствие
  // и разбор в обеих темах плюс минимум. Числа расхода приходят асинхронно — кадры
  // ждут значения, а не только каркас сборки (спека приветствия §11).
  { name: "glavnoe-1440x900-pusto", size: [1440, 900], query: "?состояние=пусто", wait: "empty", text: "650 000", texts: ["Добро пожаловать в GnomeCode", "ЧАТЫ", "Открыть проект", "650 000", "$0.18", "Токены и деньги — за сегодня"] },
  { name: "glavnoe-1440x900-pusto-light", size: [1440, 900], query: "?состояние=пусто&тема=светлая", wait: "empty-light", text: "650 000", texts: ["Добро пожаловать в GnomeCode", "650 000", "$0.18"] },
  // Кадры приветственной сборки (docs/specs/2026-10-10-5-приветственная.md, §11):
  // прочерк расхода и меню «+» героя снимаются адресом, без кликов.
  { name: "glavnoe-1440x900-pusto-nostats", size: [1440, 900], query: "?состояние=пусто&статистика=нет", wait: "empty", texts: ["Добро пожаловать в GnomeCode", "ТОКЕНЫ", "ДЕНЬГИ", "—"] },
  { name: "glavnoe-1440x900-pusto-plus", size: [1440, 900], query: "?состояние=пусто&плюс=открыто", wait: "add-menu", heroMenu: true, texts: ["Добро пожаловать в GnomeCode", "Connect plugin", "650 000"] },
  { name: "glavnoe-1440x900-razbor", size: [1440, 900], query: "?состояние=разбор", wait: "step", texts: ["Копировать", "Sources used"] },
  { name: "glavnoe-1440x900-razbor-light", size: [1440, 900], query: "?состояние=разбор&тема=светлая", wait: "step-light", texts: ["Копировать", "Sources used"] },
  { name: "glavnoe-1024x640-pusto", size: [1024, 640], query: "?состояние=пусто", wait: "empty", text: "650 000", texts: ["Добро пожаловать в GnomeCode", "650 000", "$0.18"] },
];

const WAITED = { header: 90_000, theme: 15000, empty: 15000, panel: 15000 };

/** Кадр снимается прокрашенной страницей: правила компонента применяются к
 *  элементу позже, чем появляется шапка, — часть окна снималась неокрашенной
 *  (пилюля темы «почти чёрная» и слепой «+» на 1024×640, «хрупкость снимков»
 *  в docs/BATCH.md; живой цвет при этом стабилен). Кнопка «+» есть во всех
 *  ракурсах этого сценария; 32 px ей даёт .btn--square из Button.css —
 *  применённость правила и есть признак прокраски. */
const painted = (page) =>
  page.waitForFunction(
    () => document.querySelector('[data-testid="composer-add"]')?.getBoundingClientRect().width === 32,
    undefined,
    { timeout: WAITED.empty },
  );

/** Чего ждём на странице перед снимком: иначе светлая тема снимется тёмной,
 *  а пустое состояние — лентой. Ошибка здесь называет ракурс и признак.
 *  «header» — дефолтные ракурсы без своего признака: после domcontentloaded
 *  шапка чата — первый якорь смонтированного интерфейса (ловушка TESTING). */
const settled = async (page, shot) => {
  if (shot.wait === "header") {
    await page.waitForSelector('[data-testid="chat-header"]', { timeout: WAITED.header });
    return;
  }
  if (shot.wait === "theme") {
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light", undefined, {
      timeout: WAITED.theme,
    });
    return;
  }
  if (shot.wait === "empty") {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="empty"]')), undefined, {
      timeout: WAITED.empty,
    });
    return;
  }
  if (shot.wait === "add-menu") {
    // Меню «+» героя (`?плюс=открыто`): кадр снимается, когда меню на экране.
    await page.waitForSelector('[data-testid="add-menu"]', { timeout: WAITED.empty });
    return;
  }
  if (shot.wait === "empty-light" || shot.wait === "step-light") {
    // Светлая тема и признак состояния вместе: кадр снимается, когда оба на месте.
    await page.waitForFunction(
      (mark) =>
        document.documentElement.dataset.theme === "light" &&
        (mark === "empty"
          ? Boolean(document.querySelector('[data-testid="empty"]'))
          : Boolean(document.querySelector('[data-testid="step"]'))),
      shot.wait === "empty-light" ? "empty" : "step",
      { timeout: WAITED.empty },
    );
    return;
  }
  if (shot.wait === "step") {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="step"]')), undefined, {
      timeout: WAITED.empty,
    });
    return;
  }
  if (shot.wait === "feed-run") {
    // Бегущая строка живого прогресса (спека ленты §12): «Ищу…» с многоточием.
    await page.waitForSelector('[data-testid="feed-run"]', { timeout: WAITED.empty });
    return;
  }
  if (shot.wait === "panel") {
    await page.waitForFunction(() => Boolean(document.querySelector('[data-testid="context-panel"]')), undefined, {
      timeout: WAITED.panel,
    });
    return;
  }
  if (shot.wait === "menu") {
    await page.waitForSelector('[data-testid="header-menu"]', { timeout: WAITED.panel });
    return;
  }
  if (shot.wait?.startsWith("rows:")) {
    const wanted = Number(shot.wait.slice("rows:".length));
    await page.waitForFunction(
      (n) => document.querySelectorAll('[data-testid="feed"] > .feed__row').length >= n,
      wanted,
      { timeout: 15000 },
    );
    return;
  }
  if (shot.text) {
    // Разряды ru-RU — неразрывный пробел (U+00A0): ждём нормализованным текстом,
    // как stats_page (иначе значение на экране есть, а признак не совпадает).
    await page.waitForFunction(
      (needle) => {
        const text = document.querySelector('[data-testid="feed"]')?.innerText ?? "";
        return text.replace(/\s+/g, " ").includes(needle);
      },
      shot.text,
      { timeout: 15000 },
    );
  }
};

/** Меню «+» на кадре `плюс=открыто` (правка владельца 2026-10-10, спека
 *  приветствия §16): открывается над нижним полем от самого композера — якорь
 *  композер, не оверлей области чата. Числами, не глазами: зазоры из AddMenu.css —
 *  24 px от левого края композера, низ меню на 8 px ниже верха поля; шапка и
 *  рамки чата — границы «целиком на экране». */
const heroMenuBounds = async (page) =>
  page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    };
    return {
      menu: box('[data-testid="add-menu"]'),
      chat: box(".chat"),
      header: box('[data-testid="chat-header"]'),
      composer: box('[data-testid="welcome-composer"] .composer'),
    };
  });

/** Зазоры меню от композера (AddMenu.css): слева --space-5, низ ниже верха поля
 *  на --space-2. Допуск 2 px — дробные ширины рамок. */
const MENU_INSET_PX = 24;
const MENU_GAP_PX = 8;
const MENU_TOLERANCE_PX = 2;

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const [width, height] = shot.size;
      // Свой контекст на ракурс: снимки одного окна не приносят хранилище страницы
      // друг другу; титул прошлого запуска сидируется до загрузки страницы.
      const context = await browser.newContext({ viewport: { width, height } });
      if (shot.lastLaunchTitle) {
        await context.addInitScript(
          (title) => localStorage.setItem("gnomecode-fixture-state", JSON.stringify({ chatTitle: title })),
          shot.lastLaunchTitle,
        );
      }
      const page = await context.newPage();
      await page.goto(`${url}${shot.query}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      try {
        await settled(page, shot);
        await painted(page);
      } catch {
        const seen = await page.innerText('[data-testid="feed"]').catch(() => "");
        await context.close();
        done(
          1,
          `ракурс ${shot.name} снят, но страница не отдала признак (${shot.wait || shot.text || "строка ленты"}): ${seen.replace(/\s+/g, " ").slice(0, 120)}`,
        );
      }
      if (shot.chips) {
        await attachAllFixtureFiles(page);
        // Панель закрывается тем же жестом, что у владельца: кадр показывает
        // композер с чипами целиком, без оверлея справа.
        await page.keyboard.press("Escape");
        await page.waitForFunction(() => document.querySelector(".context") === null, undefined, {
          timeout: WAITED.panel,
        });
      }
      const body = (await page.innerText("body")).replace(/\s+/g, " ");
      const missing = shot.texts.filter((text) => !body.includes(text));
      if (missing.length) {
        await context.close();
        done(1, `нет текста на экране в ракурсе ${shot.name}: ${missing.map((t) => `«${t}»`).join(", ")}`);
      }
      if (shot.heroMenu) {
        const bounds = await heroMenuBounds(page);
        if (!bounds.menu || !bounds.chat || !bounds.header || !bounds.composer) {
          await context.close();
          done(1, "кадр «плюс=открыто»: меню «+», шапка, нижнее поле или область чата не на экране");
        }
        if (bounds.menu.top < bounds.header.bottom) {
          await context.close();
          done(1, `меню «+» заехало под шапку (верх ${Math.round(bounds.menu.top)} при низе шапки ${Math.round(bounds.header.bottom)}) — на экране оно не целиком`);
        }
        if (
          bounds.menu.left < bounds.chat.left - 1 ||
          bounds.menu.right > bounds.chat.right + 1 ||
          bounds.menu.bottom > bounds.chat.bottom + 1
        ) {
          await context.close();
          done(1, `меню «+» выходит за область чата (${Math.round(bounds.menu.left)}…${Math.round(bounds.menu.right)}, низ ${Math.round(bounds.menu.bottom)}) — на экране не целиком`);
        }
        if (Math.abs(bounds.menu.left - (bounds.composer.left + MENU_INSET_PX)) > MENU_TOLERANCE_PX) {
          await context.close();
          done(1, `меню «+» стоит на ${Math.round(bounds.menu.left - bounds.composer.left)} px от нижнего поля, а не ${MENU_INSET_PX} — якорь не композер`);
        }
        if (Math.abs(bounds.menu.bottom - (bounds.composer.top + MENU_GAP_PX)) > MENU_TOLERANCE_PX) {
          await context.close();
          done(1, `меню «+» открывается не над нижним полем (низ ${Math.round(bounds.menu.bottom)} против верха поля ${Math.round(bounds.composer.top)}) — якорь не композер`);
        }
      }
      if (shot.cutTitle) {
        // §14.8: «название усечено с «…»» — строка шире своего места и режется
        // многоточием; короткое название усечением не докажет кадр.
        const cut = await page.$eval(
          '[data-testid="chat-title"]',
          (el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis",
        );
        if (!cut) {
          await context.close();
          done(1, `название чата в ракурсе ${shot.name} не усечено — «…» не показан`);
        }
      }
      const file = `${OUT_DIR}/${shot.name}.png`;
      // Первый снимок заставляет Chromium докрасить страницу (прокраска доходит
      // до элементов неравномерно: пилюля темы «почти чёрная», слепой «+» —
      // «хрупкость снимков» в docs/BATCH.md; живой цвет при этом стабилен),
      // второй фиксирует докрашенный кадр.
      await page.screenshot();
      await page.screenshot({ path: file });
      console.log(`снимок ${file}: ${width}×${height}${shot.query}`);
      await context.close();
    }
  } finally {
    await browser.close();
  }
  done(0, `снимки окна сняты в ${OUT_DIR}/: ${SHOTS.length} ракурсов — ${SHOTS.map((s) => s.name).join(", ")}`);
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий снимка упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}