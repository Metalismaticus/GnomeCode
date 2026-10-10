// Главное окно по образцам (docs/specs/2026-10-06-11-glavnoe.md, «По чему судить
// снимок»): приветственная сборка рядами, группы чатов по датам, код-блок с
// «Копировать», ступени разбора с номерами, живая правая панель без «позже».
// Числа стерегут числа (H1 22 px, честные нули, 4 сценария), снимок судит владелец.
//
//   node tests/ui/glavnoe.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// интерфейс получает фикстуру (src/fixture.ts, параметры адреса — src/viewparams.ts).
import { chromium } from "@playwright/test";

import { done, openContextPanel, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
const H1_PX = 22;
const NUMBER_PX = 16;
const SCENARIOS = [
  ["Открыть проект", "Выбрать папку с кодом"],
  ["Новый чат", "Начать с чистого листа"],
  ["Подключить плагин", "Каталог и права"],
  ["Сравнить модели", "Выбрать для этого чата"],
];
const COUNTERS = ["ЧАТЫ", "ПРОЕКТЫ", "ПЛАГИНЫ", "ВЫЗОВЫ", "ТОКЕНЫ", "ДЕНЬГИ"];
/** Честные нули — только у первых четырёх; у расхода значения фикстуры «за сегодня»
 *  (src/fixtureStats.ts, §8 спеки приветствия): приходят с моста асинхронно — сценарий
 *  ждёт число, а не карточку. */
const SPEND = { ТОКЕНЫ: "650 000", ДЕНЬГИ: "$0.18" };
const SPEND_NOTE = "Токены и деньги — за сегодня";
/** Крупный ввод нового чата — тот же композер в середине сборки (спека приветствия §4). */
const HERO_MIN_PX = 96;
/** Ряд моделей — текущая плюс известные, не весь каталог: приветствие не должно
 *  выкатывать сотни карточек за сгиб (замечание владельца 2026-10-06, живая копия). */
const MODEL_ROW_LIMIT = 8;
const GROUPS = ["СЕГОДНЯ", "ВЧЕРА", "НА ЭТОЙ НЕДЕЛЕ", "РАНЕЕ"];
const NET_TITLE = "Своего сетевого состояния у чата нет — появится с сетевыми плагинами";

/** Вычисленный стиль одного свойства элемента: null — элемента нет. */
const styleOf = (page, selector, property) =>
  page.$eval(
    selector,
    (el, prop) => (el ? getComputedStyle(el)[prop] : null),
    property,
  ).catch(() => null);

const iface = await startInterface();
try {
  if (!iface.ok) {
    done(1, `сервер интерфейса не поднялся на порту ${iface.port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    // --- Приветственная сборка: H1, честные нули, ряды по порядку (спека §3/§5) --------
    const page = await browser.newPage({ viewport: WIDE });
    await page.goto(`${iface.url}?состояние=пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await page.waitForSelector('[data-testid="empty"]', { timeout: 15000 });
    } catch {
      done(1, "при ?состояние=пусто в ленте нет приветственной сборки: нет [data-testid=empty]");
    }
    // Числа расхода приходят с моста позже сборки — ждём значение, не только каркас.
    // Разряды ru-RU — неразрывный пробел (U+00A0): сверяем нормализованным текстом,
    // как stats_page (иначе значение на экране есть, а строка сравнения не совпадает).
    await page.waitForFunction(
      (needle) =>
        [...document.querySelectorAll('[data-testid="welcome-counter"]')]
          .some((card) => card.textContent.replace(/\s+/g, " ").includes(needle)),
      SPEND.ТОКЕНЫ,
      { timeout: 15000 },
    ).catch(() => {
      done(1, `счётчик «ТОКЕНЫ» не дождался числа «${SPEND.ТОКЕНЫ}» — расход «за сегодня» не приходит с моста`);
    });
    const h1 = await styleOf(page, '[data-testid="empty-title"]', "fontSize");
    if (h1 !== `${H1_PX}px`) {
      done(1, `заголовок приветствия ${h1}, а не ${H1_PX} px (крупный заголовок образца)`);
    }
    const weight = await styleOf(page, '[data-testid="empty-title"]', "fontWeight");
    if (weight !== "700") {
      done(1, `заголовок приветствия весом ${weight}, а не 700`);
    }
    const subtitle = await page.textContent('[data-testid="empty"]').catch(() => "");
    if (!subtitle.includes("Опишите задачу, приложите файл или выберите сценарий")) {
      done(1, `под заголовком нет подзаголовка приветствия — есть «${subtitle.slice(0, 80)}»`);
    }

    // Ряд счётчиков: шесть карточек; честные нули — у первых четырёх, расход — из фикстуры.
    const counters = await page.$$eval('[data-testid="welcome-counter"]', (cards) =>
      cards.map((card) => ({
        label: card.querySelector(".counter__label")?.textContent.trim() ?? "",
        value: card.querySelector(".counter__value")?.textContent.replace(/\s+/g, " ").trim() ?? "",
        size: getComputedStyle(card.querySelector(".counter__value")).fontSize,
        weight: getComputedStyle(card.querySelector(".counter__value")).fontWeight,
        numeric: getComputedStyle(card.querySelector(".counter__value")).fontVariantNumeric,
      })),
    ).catch(() => []);
    if (counters.length !== COUNTERS.length) {
      done(1, `ряд счётчиков — ${counters.length} карточки, а не ${COUNTERS.length} (${COUNTERS.join("/")})`);
    }
    for (const [index, label] of COUNTERS.entries()) {
      const card = counters[index];
      if (card.label !== label) {
        done(1, `счётчик ${index + 1} — «${card.label}», а не «${label}»`);
      }
      const wanted = SPEND[label] ?? "0";
      if (card.value !== wanted) {
        done(1, `счётчик «${label}» показывает «${card.value}», а не «${wanted}» (честный ноль или число фикстуры)`);
      }
      if (card.size !== `${NUMBER_PX}px` || card.weight !== "600") {
        done(1, `число счётчика «${label}» — ${card.size}/${card.weight}, а не ${NUMBER_PX} px/600 (крупные полужирные числа образца)`);
      }
      if (!card.numeric.includes("tabular-nums")) {
        done(1, `число счётчика «${label}» не табличное (tabular-nums)`);
      }
    }
    // Подпись периода под рядом: называет «за сегодня» для обеих карточек расхода.
    const note = await page.textContent('[data-testid="welcome-spend-note"]').catch(() => "");
    if (!note.includes(SPEND_NOTE)) {
      done(1, `под счётчиками нет подписи «${SPEND_NOTE}»: есть «${note.trim()}»`);
    }

    // Герой-ввод: тот же композер слотом сборки, крупное поле (спека приветствия §4).
    const hero = await page.$eval('[data-testid="welcome-composer"]', (block) => ({
      composer: Boolean(block.querySelector('[data-testid="composer"]')),
      add: Boolean(block.querySelector('[data-testid="composer-add"]')),
      model: Boolean(block.querySelector('[data-testid="composer-model"]')),
      box: block.querySelector(".composer__box")?.getBoundingClientRect().height ?? 0,
      bottom: (() => {
        const composer = document.querySelector(".composer");
        return composer ? getComputedStyle(composer).position : null;
      })(),
    })).catch(() => null);
    if (!hero || !hero.composer) {
      done(1, "крупного ввода нет: [data-testid=welcome-composer] с композером между счётчиками и сценариями");
    }
    if (!hero.add || !hero.model) {
      done(1, "в герое нет «+» или пилюли модели — селекторы композера должны жить в герое");
    }
    if (hero.box < HERO_MIN_PX) {
      done(1, `поле героя ${Math.round(hero.box)} px, а не ≥ ${HERO_MIN_PX} — «крупный ввод» одной строкой не читается`);
    }
    if (hero.bottom !== "static") {
      done(1, `герой позиционирован сам (${hero.bottom}) — всплывающие якорятся к области чата`);
    }

    // Ряд моделей — из каталога, который продукт знает: текущая первой, вторая линия.
    const models = await page.$$eval('[data-testid="welcome-model"]', (cards) =>
      cards.map((card) => card.textContent.replace(/\s+/g, " ").trim()),
    ).catch(() => []);
    if (!models.length) {
      done(1, "ряда моделей нет — модель текущего чата известна, ряд должен стоять");
    }
    if (!models.some((text) => text.includes("GLM-5.3 High"))) {
      done(1, `в ряду моделей нет модели текущего чата «GLM-5.3 High» — есть «${models.join(" | ").slice(0, 100)}»`);
    }
    if (models.length > MODEL_ROW_LIMIT) {
      done(1, `ряд моделей выкатил ${models.length} карточек, а не до ${MODEL_ROW_LIMIT} — приветствие не должно показывать весь каталог`);
    }
    // Ряда провайдеров в приветствии больше нет: десятки карточек съели сборку до
    // сгиба (замечание владельца 2026-10-06, живая копия 21:46) — список провайдеров
    // живёт в «Настройки → Модели» и в панели сравнения.
    const providerCards = await page.$$eval('[data-testid="welcome-provider"]', (cards) => cards.length)
      .catch(() => 0);
    if (providerCards) {
      done(1, `в приветствии остался ряд провайдеров (${providerCards} карточки) — перегружает сборку, ряд переехал в настройки`);
    }
    // Порядок сборки: H1 → счётчики → герой → 4 сценария → модели (замечание владельца 21:46).
    const order = await page.$eval('[data-testid="empty"]', (block) => ({
      title: block.querySelector('[data-testid="empty-title"]')?.getBoundingClientRect().top ?? null,
      counters: block.querySelector('[data-testid="welcome-counter"]')?.getBoundingClientRect().top ?? null,
      composer: block.querySelector('[data-testid="welcome-composer"]')?.getBoundingClientRect().top ?? null,
      scenarios: block.querySelector('[data-testid="welcome-scenarios"]')?.getBoundingClientRect().top ?? null,
      models: block.querySelector('[data-testid="welcome-model"]')?.getBoundingClientRect().top ?? null,
    }));
    if (Object.values(order).some((top) => top === null)) {
      done(1, "приветственной сборки нет целиком: один из рядов потерялся — порядок не проверить");
    }
    const sequence = ["title", "counters", "composer", "scenarios", "models"];
    for (let i = 1; i < sequence.length; i += 1) {
      if (order[sequence[i]] <= order[sequence[i - 1]]) {
        done(
          1,
          `ряд «${sequence[i]}» стоит не ниже «${sequence[i - 1]}» — целое: H1 → счётчики → герой → сценарии → модели, есть «${sequence.map((step) => `${step}=${Math.round(order[step])}`).join(" / ")}»`,
        );
      }
    }

    // Ряд сценариев: ровно 4, вторая линия, глиф-иконка.
    const scenarios = await page.$$eval('[data-testid="welcome-scenario"]', (cards) =>
      cards.map((card) => ({
        text: card.textContent.replace(/\s+/g, " ").trim(),
        glyph: Boolean(card.querySelector("svg")),
      })),
    ).catch(() => []);
    if (scenarios.length !== SCENARIOS.length) {
      done(1, `ряд сценариев — ${scenarios.length} карточки, а не ровно 4`);
    }
    for (const [index, [title, sub]] of SCENARIOS.entries()) {
      const card = scenarios[index];
      if (!card.text.includes(title) || !card.text.includes(sub)) {
        done(1, `карточка сценария ${index + 1} — «${card.text}», а не «${title} — ${sub}»`);
      }
      if (!card.glyph) {
        done(1, `у карточки сценария «${title}» нет глифа-иконки (inline-SVG)`);
      }
    }
    await page.close();

    // --- Разбор: ступени с номерами и сворачиванием, код-блок с «Копировать» ----------
    const razbor = await browser.newPage({ viewport: WIDE });
    await razbor.goto(`${iface.url}?состояние=разбор`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await razbor.waitForSelector('[data-testid="step"]', { timeout: 15000 });
    } catch {
      done(1, "в разборе нет ступеней: нет [data-testid=step] — заголовки ответа не стали секциями");
    }
    const steps = await razbor.$$eval('[data-testid="step"]', (sections) =>
      sections.map((section) => ({
        number: section.querySelector('[data-testid="step-number"]')?.textContent.trim() ?? "",
        head: section.querySelector('[data-testid="step-head"]')?.textContent.trim() ?? "",
        expanded: section.querySelector('[data-testid="step-head"]')?.getAttribute("aria-expanded") ?? "",
      })),
    );
    if (steps.length < 2) {
      done(1, `в разборе ${steps.length} ступени, а не меньше двух — у ответа образца их несколько`);
    }
    if (steps[0].number !== "1" || steps[1].number !== "2") {
      done(1, `ступени не пронумерованы по порядку: «${steps.map((s) => s.number).join(", ")}»`);
    }
    if (steps.some((step) => step.expanded !== "true")) {
      done(1, `ступени развёрнуты не по умолчанию: aria-expanded «${steps.map((s) => s.expanded).join(", ")}»`);
    }
    // Клик по заголовку ступени сворачивает её; номер и заголовок остаются видимыми.
    await razbor.click('[data-testid="step"][data-number="1"] [data-testid="step-head"]');
    const collapsed = await razbor.$eval('[data-testid="step"][data-number="1"]', (section) => ({
      expanded: section.querySelector('[data-testid="step-head"]')?.getAttribute("aria-expanded"),
      head: section.querySelector('[data-testid="step-head"]')?.textContent.trim() ?? "",
      body: section.querySelector(".step__body")?.textContent.trim() ?? "",
      visible: Boolean(section.querySelector('[data-testid="step-head"]')?.offsetParent),
    }));
    if (collapsed.expanded !== "false") {
      done(1, `клик по ступени не свернул её: aria-expanded «${collapsed.expanded}»`);
    }
    if (!collapsed.visible || !collapsed.head) {
      done(1, `свёрнутая ступень потеряла заголовок «${collapsed.head}» — он должен остаться видимым с номером`);
    }
    if (collapsed.body) {
      done(1, "свёрнутая ступень показывает своё содержимое — тело должно скрыться");
    }
    await razbor.click('[data-testid="step"][data-number="1"] [data-testid="step-head"]');

    // Код-блок: шапка с языком и «Копировать» без наведения; клик — «Скопировано».
    try {
      await razbor.waitForSelector('[data-testid="codeblock"]', { timeout: 5000 });
    } catch {
      done(1, "в разборе нет код-блока: fenced-код ответа не стал плашкой [data-testid=codeblock]");
    }
    const lang = await razbor.textContent('[data-testid="code-lang"]').catch(() => "");
    if (!lang.trim()) {
      done(1, "в шапке код-блока нет имени языка");
    }
    const copy = await razbor.textContent('[data-testid="code-copy"]').catch(() => "");
    if (!copy.trim().includes("Копировать")) {
      done(1, `кнопка код-блока — «${copy.trim()}», а не «Копировать» (видна без наведения)`);
    }
    await razbor.click('[data-testid="code-copy"]');
    const copied = await razbor.textContent('[data-testid="code-copy"]').catch(() => "");
    if (!copied.trim().includes("Скопировано")) {
      done(1, `после клика кнопка — «${copied.trim()}», а не «Скопировано»`);
    }
    const wrapped = await razbor.$eval('[data-testid="codeblock"]', (block) => {
      const area = block.querySelector(".codeblock__code");
      return area ? area.scrollWidth - area.clientWidth : null;
    });
    if (wrapped === null) {
      done(1, "у код-блока нет области кода — подсветка и перенос не проверить");
    }
    if (wrapped > 1) {
      done(1, `строка кода вылезла за плашку на ${wrapped} px — длинная строка должна переноситься`);
    }
    const sources = await razbor.$eval('[data-testid="sources-used"]', (el) => Boolean(el)).catch(() => false);
    if (!sources) {
      done(1, "в разборе нет блока «Sources used» — существующий блок потерялся");
    }
    await razbor.close();

    // --- Сайдбар: группы дат, двухстрочные строки, активный чат -----------------------
    const many = await browser.newPage({ viewport: WIDE });
    await many.goto(`${iface.url}?состояние=много`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await many.waitForSelector('[data-testid="chat-active"]', { timeout: 15000 });
    } catch {
      done(1, "в сайдбаре нет активного чата — группы дат не проверить");
    }
    const labels = await many.$$eval(".sidebar__section-title, .sidebar__group-title", (titles) =>
      titles.map((title) => title.textContent.trim()),
    );
    const missingGroups = GROUPS.filter((group) => !labels.includes(group));
    if (missingGroups.length) {
      done(1, `в сайдбаре нет групп дат: ${missingGroups.map((g) => `«${g}»`).join(", ")} — есть ${labels.join(", ")}`);
    }
    const twoLine = await many.$eval('[data-testid="chat-active"]', (row) => ({
      title: row.querySelector(".sidebar-item__title")?.textContent.trim() ?? "",
      sub: row.querySelector(".sidebar-item__sub")?.textContent.trim() ?? "",
    }));
    if (!twoLine.title || !twoLine.sub) {
      done(1, `строка чата однострочная: титул «${twoLine.title}», вторая линия «${twoLine.sub}» — у образца две линии`);
    }
    await many.close();

    // Проект: вторая линия — путь папки, усечённый с «…».
    const project = await browser.newPage({ viewport: WIDE });
    await project.goto(`${iface.url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    const projectRow = await project.$eval('[data-testid="sidebar-project"]', (row) => ({
      title: row.querySelector(".sidebar-item__title")?.textContent.trim() ?? "",
      sub: row.querySelector(".sidebar-item__sub")?.textContent.trim() ?? "",
      full: row.title,
    })).catch(() => null);
    if (!projectRow || !projectRow.sub) {
      done(1, `строка проекта без второй линии-пути: ${projectRow ? `«${projectRow.title}»` : "строки нет"}`);
    }
    await project.close();

    // --- Сайдбар живой: поиск, анатомия строки, аватар с точкой (спека сайдбара §4–§6) --
    const side = await browser.newPage({ viewport: WIDE });
    await side.goto(iface.url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await side.waitForSelector('[data-testid="chat-active"]', { timeout: 15000 });
    } catch {
      done(1, "в дефолтном сайдбаре нет активного чата — живой список нечем проверить");
    }
    // Поиск стоит под логотипом и над кнопками (спека §3): порядок в DOM.
    const searchPlace = await side.$eval('[data-testid="sidebar"]', (nav) => {
      const logo = nav.querySelector(".sidebar__logo");
      const search = nav.querySelector('[data-testid="sidebar-search"]');
      const primary = nav.querySelector('[data-testid="btn-primary"]');
      const after = (a, b) => Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return after(logo, search) && after(search, primary);
    });
    if (!searchPlace) {
      done(1, "поля поиска нет под логотипом и над кнопками сайдбара — первый контрол колонки не на месте");
    }
    // Строка чата двумя линиями: время справа первой, превью второй (спека §4).
    const rowBox = await side.$eval('[data-testid="chat-active"]', (row) => {
      const box = (sel) => {
        const el = row.querySelector(sel);
        return el ? el.getBoundingClientRect() : null;
      };
      return {
        title: row.querySelector(".sidebar-item__title")?.textContent.trim() ?? "",
        end: row.querySelector(".sidebar-item__end")?.textContent.trim() ?? "",
        sub: row.querySelector(".sidebar-item__sub")?.textContent.trim() ?? "",
        titleBox: box(".sidebar-item__title"),
        endBox: box(".sidebar-item__end"),
        subBox: box(".sidebar-item__sub"),
      };
    });
    if (rowBox.title !== "Разбор главного окна") {
      done(1, `активная строка — «${rowBox.title}», а не «Разбор главного окна»`);
    }
    if (!rowBox.end) {
      done(1, "у строки чата нет времени на первой линии — время не переехало вправо");
    }
    if (!rowBox.sub) {
      done(1, "у строки чата нет превью на второй линии — сайдбар не говорит, о чём чат");
    }
    if (rowBox.titleBox && rowBox.endBox) {
      if (Math.abs(rowBox.endBox.top - rowBox.titleBox.top) > 4) {
        done(1, "время стоит не на первой линии строки — верх времени и названия расходятся больше 4 px");
      }
      if (rowBox.endBox.right <= rowBox.titleBox.right) {
        done(1, "время стоит не справа от названия");
      }
    }
    if (rowBox.subBox && rowBox.endBox && rowBox.subBox.top <= rowBox.endBox.top) {
      done(1, "превью стоит не второй линией — верх превью не ниже времени");
    }
    // Чат без сообщений — одна линия (спека §4): второй линии нет вовсе.
    const oneLine = await side.$$eval(".sidebar-item", (rows) => {
      const row = rows.find((r) => r.querySelector(".sidebar-item__title")?.textContent.trim() === "Новый чат без вопросов");
      return row === undefined ? null : Boolean(row.querySelector(".sidebar-item__sub"));
    });
    if (oneLine === null) {
      done(1, "чата без сообщений «Новый чат без вопросов» нет в дефолтном списке — крайний случай не показан");
    }
    if (oneLine) {
      done(1, "чат без сообщений рисует пустую вторую линию — строка должна быть одной линией");
    }
    // Точка аватара проекта — статусный токен: зелёная у живого движка (спека §6).
    const tokenColor = (page, token) =>
      page.evaluate((name) => {
        const probe = document.createElement("span");
        probe.style.color = `var(${name})`;
        document.body.appendChild(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        return value;
      }, token);
    const dotOf = (page) =>
      page.$eval('[data-testid="sidebar-project-dot"]', (el) => getComputedStyle(el).backgroundColor).catch(() => null);
    const dotUp = await dotOf(side);
    const success = await tokenColor(side, "--success");
    if (!dotUp || dotUp !== success) {
      done(1, `точка аватара проекта ${dotUp ?? "не нарисована"}, а не цвет --success (${success}) — состояния движка сайдбар не показывает`);
    }
    // Движок не отвечает — точка красная, сайдбар и поиск работают (спека §6/§8).
    const errorPage = await browser.newPage({ viewport: WIDE });
    await errorPage.goto(`${iface.url}?состояние=ошибка`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await errorPage.waitForSelector('[data-testid="sidebar-project-dot"]', { timeout: 15000 });
    const dotDown = await dotOf(errorPage);
    const danger = await tokenColor(errorPage, "--danger");
    if (!dotDown || dotDown !== danger) {
      done(1, `точка аватара при ошибке движка ${dotDown ?? "не нарисована"}, а не цвет --danger (${danger})`);
    }
    if (!(await errorPage.$('[data-testid="sidebar-search"]'))) {
      done(1, "при ошибке движка у сайдбара нет поиска — остальной сайдбар должен работать");
    }
    await errorPage.close();
    // Поиск фильтрует только чаты, группы пересобираются (спека §5). Состав строк
    // запоминаем до поиска: возврат после очистки сверяем с ним, а не с временем суток.
    const before = await side.$$eval('[data-testid="sidebar"] .sidebar__lists .sidebar-item__title', (els) =>
      els.map((el) => el.textContent.trim()),
    );
    await side.fill('[data-testid="sidebar-search"]', "модел");
    await side.waitForFunction(
      () => {
        const titles = [...document.querySelectorAll('[data-testid="sidebar"] .sidebar-item__title')].map((el) =>
          el.textContent.trim(),
        );
        return titles.includes("Настройки модели по умолчанию") && titles.includes("Статистика расхода");
      },
      undefined,
      { timeout: 5000 },
    ).catch(() => {
      done(1, "поиск «модел» не нашёл «Настройки модели по умолчанию» и «Статистика расхода» — фильтр по названию и превью не работает");
    });
    // Каждая видимая группа при поиске непуста: группа без совпадений прячется.
    const found = await side.$$eval('[data-testid="sidebar"] .sidebar__lists > div', (blocks) =>
      blocks
        .filter((block) => block.querySelector(".sidebar__section-title"))
        .map((block) => ({
          title: block.querySelector(".sidebar__section-title")?.textContent.trim() ?? "",
          rows: block.querySelectorAll(".sidebar-item").length,
        })),
    );
    if (!found.length) {
      done(1, "при поиске не осталось ни одной группы — результат потерял дата-контекст");
    }
    for (const group of found) {
      if (!group.rows) {
        done(1, `при поиске видна пустая группа «${group.title}» — группа без совпадений должна прятаться`);
      }
    }
    const titles = await side.$$eval('[data-testid="sidebar"] .sidebar__lists .sidebar-item__title', (els) =>
      els.map((el) => el.textContent.trim()),
    );
    const matched = titles.filter((t) => t === "Настройки модели по умолчанию" || t === "Статистика расхода").length;
    if (matched !== 2) {
      done(1, `поиск «модел» показал ${matched} из двух совпавших строк: ${titles.join(" | ")}`);
    }
    const navWhole = await side.$$eval('[data-testid="sidebar"] .sidebar-item__title', (els) =>
      els.map((el) => el.textContent.trim()),
    );
    if (!navWhole.includes("Плагины")) {
      done(1, "поиск по чатам спрятал навигацию сайдбара — ищет только список «Чаты»");
    }
    if (titles.includes("Разбор главного окна")) {
      done(1, "поиск «модел» оставил несовпавшую строку активного чата — фильтр не работает");
    }
    // Пустой результат объяснён словами, поле и ✕ на месте (спека §5).
    await side.fill('[data-testid="sidebar-search"]', "ффф");
    try {
      await side.waitForSelector('[data-testid="sidebar-search-none"]', { timeout: 5000 });
    } catch {
      done(1, "пустой результат поиска не объяснён строкой «Ничего не нашлось» ([data-testid=sidebar-search-none] нет)");
    }
    const noneText = await side.$eval('[data-testid="sidebar-search-none"]', (el) => el.textContent.trim());
    if (noneText !== "Ничего не нашлось") {
      done(1, `пустой результат объяснён «${noneText}», а не «Ничего не нашлось»`);
    }
    if (!(await side.$('[data-testid="sidebar-search-clear"]'))) {
      done(1, "при пустом результате у поиска пропал ✕ — поле и очистка должны остаться на местах");
    }
    // ✕ возвращает весь список; Esc чистит текст, повторный снимает фокус.
    await side.click('[data-testid="sidebar-search-clear"]');
    await side.waitForFunction(() => !document.querySelector('[data-testid="sidebar-search-clear"]'), undefined, { timeout: 5000 });
    const restored = await side.$$eval('[data-testid="sidebar"] .sidebar__lists .sidebar-item__title', (els) =>
      els.map((el) => el.textContent.trim()),
    );
    if (restored.join("\n") !== before.join("\n")) {
      done(1, `после очистки поиска список не вернулся: было ${before.length} строк, стало ${restored.length}`);
    }
    await side.fill('[data-testid="sidebar-search"]', "модел");
    await side.keyboard.press("Escape");
    const afterEsc = await side.$eval('[data-testid="sidebar-search"]', (el) => el.value);
    if (afterEsc !== "") {
      done(1, `Esc не очистил поиск — в поле «${afterEsc}»`);
    }
    await side.keyboard.press("Escape");
    const focused = await side.evaluate(() => document.activeElement?.getAttribute?.("data-testid") ?? "");
    if (focused === "sidebar-search") {
      done(1, "повторный Esc не снял фокус с поиска");
    }
    await side.close();

    // --- Правая панель живая: команды плагинов, тумблеры, «позже» нет ------------------
    const live = await browser.newPage({ viewport: WIDE });
    await live.goto(`${iface.url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await live.waitForSelector('[data-testid="chat-header"]', { timeout: 15000 });
    } catch {
      done(1, "шапки чата нет на 1440×900 — меню «⋯» нечем открыть");
    }
    // Панель скрыта по умолчанию («тихий хром», §6) — живость проверяется открытой.
    await openContextPanel(live);
    const panelText = await live.$eval('[data-testid="context-panel"]', (el) => el.textContent.replace(/\s+/g, " "));
    if (panelText.includes("позже")) {
      done(1, `в правой панели остались строки-заглушки «позже» — панель показывает реальное`);
    }
    if (!panelText.includes("Плагины не подключены") || !(await live.$('[data-testid="context-connect"]'))) {
      done(1, "без подключённых плагинов панель не сказала «Плагины не подключены» с кнопкой «Подключить»");
    }
    // Тумблеры безопасности: файлы следуют за папкой (вкл), интернет выключен с причиной.
    const fsToggle = await live.$eval('[data-testid="context-toggle-fs"]', (el) => ({
      checked: el.getAttribute("aria-checked"),
      disabled: el.hasAttribute("disabled"),
    })).catch(() => null);
    if (!fsToggle || fsToggle.checked !== "true") {
      done(1, `тумблер «Доступ к файловой системе» — ${fsToggle ? `aria-checked=${fsToggle.checked}` : "строки нет"}, а папка проекта выбрана`);
    }
    const fsValue = await live.$eval(
      '[data-testid="context-row-fs"] .context-row__value',
      (el) => ({ text: el.textContent.trim(), cls: el.className }),
    ).catch(() => null);
    if (!fsValue || fsValue.text !== "Только папка проекта" || !fsValue.cls.includes("success")) {
      done(1, `включённый доступ к файлам показывает «${fsValue ? fsValue.text : "строки нет"}» без статуса успеха — нужно «Только папка проекта»`);
    }
    const netToggle = await live.$eval('[data-testid="context-toggle-net"]', (el) => ({
      checked: el.getAttribute("aria-checked"),
      disabled: el.hasAttribute("disabled"),
      title: el.getAttribute("title") ?? el.closest(".context-row")?.getAttribute("title") ?? "",
    })).catch(() => null);
    if (!netToggle || netToggle.checked !== "false") {
      done(1, `тумблер «Интернет» — ${netToggle ? `aria-checked=${netToggle.checked}` : "строки нет"}, а своего сетевого состояния у чата нет`);
    }
    if (!netToggle.disabled) {
      done(1, "тумблер «Интернет» активен без сетевого состояния — должен быть выключен с причиной");
    }
    if (netToggle.title !== NET_TITLE) {
      done(1, `причина выключенного интернета — «${netToggle.title}», а не «${NET_TITLE}»`);
    }

    // Тумблер «Доступ к файловой системе» нажимается (замечание владельца 21:46:
    // «безопасность чата - не нажимаются переключатели»). С выбираемой папкой клик
    // переключает право чата: выключил — вопрос уходит без файлов («Выключен»),
    // включил — «Только папка проекта» возвращается.
    const fsState = () =>
      live.$eval('[data-testid="context-toggle-fs"]', (el) => ({
        checked: el.getAttribute("aria-checked"),
        disabled: el.hasAttribute("disabled"),
      }));
    const fsFirst = await fsState();
    if (!fsFirst || fsFirst.disabled) {
      done(1, `тумблер «Доступ к файловой системе» — ${fsFirst ? "выключен атрибутом disabled" : "строки нет"} — владелец не может им ничего включить`);
    }
    if (fsFirst.checked !== "true") {
      done(1, `до клика тумблер файлов — aria-checked=${fsFirst.checked}, а папка проекта выбрана`);
    }
    await live.click('[data-testid="context-toggle-fs"]');
    try {
      await live.waitForFunction(
        () => document.querySelector('[data-testid="context-toggle-fs"]')?.getAttribute("aria-checked") === "false",
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "клик по тумблеру «Доступ к файловой системе» его не выключил — переключатели не нажимаются (замечание владельца)");
    }
    const fsOff = await live.$eval('[data-testid="context-row-fs"] .context-row__value', (el) => ({
      text: el.textContent.trim(),
      cls: el.className,
    }));
    if (fsOff.text !== "Выключен" || !fsOff.cls.includes("off")) {
      done(1, `после выключения права файлы показывают «${fsOff.text}» без статуса «off» — значение должно смениться вместе с правом`);
    }
    await live.click('[data-testid="context-toggle-fs"]');
    try {
      await live.waitForFunction(
        () => document.querySelector('[data-testid="context-toggle-fs"]')?.getAttribute("aria-checked") === "true",
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "повторный клик по тумблеру файлов не вернул доступ — право не переключается одной кнопкой");
    }
    // Без папки клик по тумблеру — тот же жест, что «+ Новый проект»: системный выбор
    // папки (у фикстуры он отвечает своим проектом) — тумблер включается честным действием.
    const fromEmpty = await browser.newPage({ viewport: WIDE });
    await fromEmpty.goto(`${iface.url}?состояние=пусто`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await fromEmpty.waitForSelector('[data-testid="chat-header"]', { timeout: 90000 });
    await openContextPanel(fromEmpty);
    await fromEmpty.waitForSelector('[data-testid="context-panel"]', { timeout: 90000 });
    await fromEmpty.click('[data-testid="context-toggle-fs"]');
    try {
      await fromEmpty.waitForFunction(
        () => document.querySelector('[data-testid="context-toggle-fs"]')?.getAttribute("aria-checked") === "true",
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "клик по выключенному тумблеру файлов без папки не привёл к выбору проекта — действие не честное");
    }
    const picked = await fromEmpty.$eval('[data-testid="context-panel"]', (el) =>
      el.textContent.includes("GnomeCode"),
    );
    if (!picked) {
      done(1, "после клика по тумблеру без папки панель не показала выбранный проект — диалог выбора не отработал");
    }
    await fromEmpty.close();

    // Команды подключённого плагина в панели и ход одобрения: клик по кнопке панели.
    // Клик по «+» закрывает панель (клик снаружи, «тихий хром» §6) — после подключения
    // панель открывается из меню «⋯» снова, команды читаются в ней.
    await live.click('[data-testid="composer-add"]');
    await live.click('[data-testid="add-connect-plugin"]');
    await live.click('[data-testid="plugin-picker"] [data-testid="plugin-row"][data-plugin="git"]');
    await openContextPanel(live);
    try {
      await live.waitForSelector('[data-testid="context-command"][data-command="git:diff"]', { timeout: 5000 });
    } catch {
      done(1, "после подключения git в правой панели нет его команд — панель не живая");
    }
    await live.click('[data-testid="context-command"][data-command="git:diff"]');
    try {
      await live.waitForSelector('[data-testid="approval-allow"]', { timeout: 5000 });
    } catch {
      done(1, "клик по команде в правой панели не спросил окном одобрения — ход одобрения потерян");
    }
    await live.click('[data-testid="approval-allow"]');
    try {
      await live.waitForFunction(
        () => document.querySelector('[data-testid="feed"]')?.textContent.includes("git"),
        undefined,
        { timeout: 5000 },
      );
    } catch {
      done(1, "после «Разрешить» вызов из правой панели не исполнился — строки команды в ленте нет");
    }
    await live.close();

    done(
      0,
      `приветственная сборка: H1 ${H1_PX} px/700, счётчиков шесть (${COUNTERS.join("/")}) с честными нулями у первых четырёх, «ТОКЕНЫ» «${SPEND.ТОКЕНЫ}» и «ДЕНЬГИ» «${SPEND.ДЕНЬГИ}» из фикстуры, подпись «${SPEND_NOTE}», герой-ввод — композер полем ≥ ${HERO_MIN_PX} px между счётчиками и сценариями, порядок H1 → счётчики → герой → сценарии → модели (ряд до ${MODEL_ROW_LIMIT}), 4 сценария с глифами; разбор: ступени с номерами сворачиваются, код-блок «Копировать→Скопировано» с языком и переносом; сайдбар: группы ${GROUPS.join("/")} и двухстрочные строки; панель: тумблер файлов переключает право чата (без папки — выбор папки проекта), интернет выключен с причиной, команды плагинов через одобрение, «позже» нет; сайдбар живой: поиск под логотипом фильтрует только чаты и пересобирает группы, ✕ и Esc очищают, пустой результат — «Ничего не нашлось», время справа первой линии и превью второй, чат без сообщений одной линией, точка проекта --success и --danger при ошибке движка`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий главного окна упал: ${text.split("\n")[0]}`);
} finally {
  iface.stop();
}
