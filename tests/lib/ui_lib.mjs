// Общие помощники UI-сценариев Playwright: подъём страницы интерфейса на свободном
// порту, ожидание её ответа и выход с кодом. Одно место на всех сценариев —
// иначе каждый повторяет свой `freePort` и `waiting` (docs/TESTING.md, «Полигон»).
//
// Итог сценария — код возврата и последняя строка вывода (tests/lib/runner_lib.py).
import { mkdir } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { chromium } from "@playwright/test";

export const INSTALL = "npx playwright install chromium";

/** Итог сценария: напечатать строку и выйти — вызывающий не успевает дописать. */
export const done = (code, line) => {
  console.log(line);
  process.exit(code);
};

/** Порт, который сейчас свободен: сервер интерфейса не должен делить его с `tauri dev`. */
export const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer().on("error", reject).listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** Ждём, пока страница начнёт отвечать; `false` — не поднялась за отведённое время. */
export const waiting = async (url, seconds) => {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
};

/** Поднять страницу интерфейса на своём порту. `false` — vite не отвечает. */
export const startInterface = async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  // npx на Windows — это .cmd, и Node 22 не запускает его без оболочки; аргументы свои, не пользовательские.
  const server = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    stdio: "ignore",
    shell: true,
  });
  // `server` на Windows — это оболочка (cmd), её kill не трогает детей:
  // каждый сценарий оставлял живой vite (~350 МБ на пару процессов), RAM
  // кончался и opencode падал. Убиваем всё дерево целиком.
  const stop = () => {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      server.kill();
    }
  };
  process.on("exit", stop);
  if (!(await waiting(url, 60))) {
    stop();
    return { url, stop, ok: false, port };
  }
  return { url, stop, ok: true, port };
};

/** Проверка подъёма vite у уже поднятого интерфейса: не отвечает — сценарий выходит. */
const assertUp = (iface) => {
  if (!iface.ok) {
    done(1, `сервер интерфейса не поднялся на порту ${iface.port} — vite не отвечает`);
  }
};

/** Открыть страницу проекта в свежем браузере: подъём интерфейса уже проверен, и если
 *  vite не ответил — выход; иначе страница с фикстурой `?состояние=проект`.
 *  Браузер возвращается владельцу: сценарий сам держит свой catch/finally и его закрывает. */
export const openProjectPage = async (iface) => {
  assertUp(iface);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${iface.url}?состояние=проект`, { waitUntil: "networkidle" });
  return { browser, page };
};

/** Страница раздела по фикстуре `?состояние=<state>`: тот же подъём и проверка vite,
 *  но domcontentloaded с таймаутом 90 с — networkidle на медленном старте vite
 *  висит (уборка в «Найдено по ходу» docs/BATCH.md). */
export const openStatePage = async (iface, state) => {
  assertUp(iface);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${iface.url}?состояние=${state}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  return { browser, page };
};

/** Подготовка сценария-снимка: проверить vite у уже поднятого интерфейса, создать
 *  папку снимков и открыть браузер Playwright. Блок подъёма один на все
 *  сценарии-снимки — иначе каждый повторяет свой (порог дублей 8, code_check). */
export const startShot = async (outDir, iface) => {
  assertUp(iface);
  await mkdir(outDir, { recursive: true });
  return { url: iface.url, browser: await chromium.launch() };
};

/** Тема страницы: атрибут `html[data-theme]` — его правит и переключатель, и состояние. */
export const themeOf = (page) =>
  page.$eval("html", (el) => el.getAttribute("data-theme") ?? "тема не проставлена");

/** Страница-снимок в свежем контексте браузера: адрес состояния и ожидаемая тема
 *  (атрибут `html[data-theme]` правит и состояние, и переключатель); снимки
 *  ракурсов одного окна не приносят хранилище страницы друг другу. */
export const openShotPage = async (browser, url, query, theme) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${url}${query}`, { waitUntil: "networkidle" });
  if (theme) {
    await page.waitForFunction(
      (wanted) => document.documentElement.dataset.theme === wanted,
      theme,
      { timeout: 15000 },
    );
  }
  return { context, page };
};

/** Текст активного чата в сайдбаре: сценарии перезапуска сверяют его с прошлым циклом.
 *  Читается первая линия строки — вторая линия (время чата) не часть титула. */
export const activeChat = (page) =>
  page.$eval('[data-testid="chat-active"] .sidebar-item__title', (el) => el.textContent.trim());

/** Папка в разделе «Проект» правой панели: видна дереву и вопросу с файлом. */
export const panelFolder = (page) =>
  page.$eval(
    '[data-testid="context-panel"] .context__folder .context-row__value',
    (el) => el.textContent.trim(),
  );

/** Меню «⋯» шапки: команды плагинов, панель и настройки переехали сюда с шапки
 *  («тихий хром», §5). Открыто — не делает ничего (повторный клик закрыл бы меню),
 *  закрыто — открывает кликом по «⋯» и ждёт панель меню. */
export const openMore = async (page) => {
  const open = await page.$('[data-testid="header-menu"]');
  if (!open) {
    await page.click('[data-testid="header-more"]');
  }
  await page.waitForSelector('[data-testid="header-menu"]', { timeout: 5000 });
};

/** Закрыть меню «⋯» клавишей — тот же жест владельца, что и в продукте (Esc). */
export const closeMore = (page) => page.keyboard.press("Escape");

/** Панель «Контекст проекта» из меню «⋯»: пункт «Контекст проекта» открывает её
 *  оверлеем на любой ширине («тихий хром», §6). Меню закрывается само. */
export const openContextPanel = async (page) => {
  await openMore(page);
  await page.click('[data-testid="menu-context"]');
  await page.waitForSelector('[data-testid="context-panel"]', { timeout: 5000 });
};

/** Приложить к вопросу все файлы фикстурного дерева: папки раскрываются стрелками,
 *  файлы — кликами по строкам, как у владельца; на каждый файл ждёт свой чип.
 *  Набор — приложимые файлы дерева фикстуры (src/fixtureTree.ts); папки
 *  «features/project» в нём нет — фикстура отдаёт её пустой (путь узла расходится
 *  с ключом дерева), приложить из неё нечего. */
export const attachAllFixtureFiles = async (page) => {
  for (const dir of ["components", "features", "styles"]) {
    await page.click(`[data-testid="tree-toggle"][data-name="${dir}"]`);
  }
  const files = ["README.md", "package.json", "ContextPanel.tsx", "FileTree.tsx", "bridge.ts", "tokens.css"];
  for (const name of files) {
    await page.click(`[data-testid="tree-row"][data-name="${name}"]`);
  }
  try {
    await page.waitForFunction(
      (wanted) => document.querySelectorAll('[data-testid="context-chip"]').length === wanted,
      files.length,
      { timeout: 5000 },
    );
  } catch {
    done(1, "клики по файлам дерева не собрали чипы контекста: на строке чипов не по чипу на файл");
  }
  return files.length;
};

/** Подключить плагин к чату кликами: меню «+» → Connect plugin → строка списка.
 *  Подтверждение подключения — пункт команды в меню «⋯» (testid прежних кнопок
 *  шапки переехал на пункты меню, «тихий хром» §5); меню закрывается Esc —
 *  дальше сценарий видит экран владельца без открытого меню. */
export const connectPlugin = async (page, id) => {
  await page.click('[data-testid="composer-add"]');
  await page.click('[data-testid="add-connect-plugin"]');
  await page.waitForSelector('[data-testid="plugin-picker"]', { timeout: 5000 });
  await page.click(`[data-testid="plugin-picker"] [data-testid="plugin-row"][data-plugin="${id}"]`);
  await openMore(page);
  await page.waitForSelector(`[data-testid="plugin-button"][data-plugin="${id}"]`, { timeout: 5000 });
  await closeMore(page);
};

/** Команды подключённых плагинов: меню «⋯» открывается на время чтения и
 *  закрывается — пункты команд живут только в открытом меню. */
export const headerCommands = async (page) => {
  await openMore(page);
  const commands = await page.$$eval('[data-testid="plugin-button"]', (els) =>
    els.map((el) => el.getAttribute("data-command")),
  );
  await closeMore(page);
  return commands;
};

/** Кнопка команды в меню «⋯» по имени команды: прыжок, возврат, снятие — по ней.
 *  Кликать по селектору стоит после openMore — вне открытого меню пунктов нет. */
export const commandButton = (command) => `[data-testid="plugin-button"][data-command="${command}"]`;

/** Карточка раздела «Плагины» на вкладке Installed: установка на месте. */
export const installedCard = (page, id) =>
  page.waitForSelector(`[data-testid="plugin-card"][data-plugin="${id}"]`, { timeout: 5000 });

/** Панель «Plugins in this chat»: пункт «Плагины этого чата» меню «⋯». Доля отказа
 *  текстом: панель или нет [data-testid=chat-plugins-panel] — у обоих сценариев. */
export const openChatPlugins = async (page) => {
  await openMore(page);
  await page.click('[data-testid="menu-plugins"]');
  try {
    await page.waitForSelector('[data-testid="chat-plugins-panel"]', { timeout: 5000 });
  } catch {
    done(1, "пункт «Плагины этого чата» меню «⋯» не открыл панель: нет [data-testid=chat-plugins-panel]");
  }
};

/** Страница состояния в открытом браузере и её чат-шапка: подъём интерфейса
 *  уже проверен. Игрок — строка ожидания шапки; 90 с — согласовано время. */
export const openState = async (browser, url, state) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${url}?состояние=${state}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('[data-testid="chat-header"]', { timeout: 90_000 });
  return page;
};