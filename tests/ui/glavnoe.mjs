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

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const WIDE = { width: 1440, height: 900 };
const H1_PX = 22;
const NUMBER_PX = 16;
const SCENARIOS = [
  ["Открыть проект", "Выбрать папку с кодом"],
  ["Новый чат", "Начать с чистого листа"],
  ["Подключить плагин", "Каталог и права"],
  ["Сравнить модели", "Выбрать для этого чата"],
];
const COUNTERS = ["ЧАТЫ", "ПРОЕКТЫ", "ПЛАГИНЫ", "ВЫЗОВЫ"];
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

    // Ряд счётчиков: 4 карточки с честными нулями, число 16 px/600, табличное.
    const counters = await page.$$eval('[data-testid="welcome-counter"]', (cards) =>
      cards.map((card) => ({
        label: card.querySelector(".counter__label")?.textContent.trim() ?? "",
        value: card.querySelector(".counter__value")?.textContent.trim() ?? "",
        size: getComputedStyle(card.querySelector(".counter__value")).fontSize,
        weight: getComputedStyle(card.querySelector(".counter__value")).fontWeight,
        numeric: getComputedStyle(card.querySelector(".counter__value")).fontVariantNumeric,
      })),
    ).catch(() => []);
    if (counters.length !== COUNTERS.length) {
      done(1, `ряд счётчиков — ${counters.length} карточки, а не ${COUNTERS.length} (ЧАТЫ/ПРОЕКТЫ/ПЛАГИНЫ/ВЫЗОВЫ)`);
    }
    for (const [index, label] of COUNTERS.entries()) {
      const card = counters[index];
      if (card.label !== label) {
        done(1, `счётчик ${index + 1} — «${card.label}», а не «${label}»`);
      }
      if (card.value !== "0") {
        done(1, `счётчик «${label}» показывает «${card.value}», а не честный ноль на пустом чате`);
      }
      if (card.size !== `${NUMBER_PX}px` || card.weight !== "600") {
        done(1, `число счётчика «${label}» — ${card.size}/${card.weight}, а не ${NUMBER_PX} px/600 (крупные полужирные числа образца)`);
      }
      if (!card.numeric.includes("tabular-nums")) {
        done(1, `число счётчика «${label}» не табличное (tabular-nums)`);
      }
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
    // Порядок сборки: H1 → счётчики → 4 сценария → модели (замечание владельца 21:46).
    const order = await page.$eval('[data-testid="empty"]', (block) => ({
      title: block.querySelector('[data-testid="empty-title"]')?.getBoundingClientRect().top ?? null,
      counters: block.querySelector('[data-testid="welcome-counter"]')?.getBoundingClientRect().top ?? null,
      scenarios: block.querySelector('[data-testid="welcome-scenarios"]')?.getBoundingClientRect().top ?? null,
      models: block.querySelector('[data-testid="welcome-model"]')?.getBoundingClientRect().top ?? null,
    }));
    if (Object.values(order).some((top) => top === null)) {
      done(1, "приветственной сборки нет целиком: один из рядов потерялся — порядок не проверить");
    }
    const sequence = ["title", "counters", "scenarios", "models"];
    for (let i = 1; i < sequence.length; i += 1) {
      if (order[sequence[i]] <= order[sequence[i - 1]]) {
        done(
          1,
          `ряд «${sequence[i]}» стоит не ниже «${sequence[i - 1]}» — целое: H1 → счётчики → сценарии → модели, есть «${sequence.map((step) => `${step}=${Math.round(order[step])}`).join(" / ")}»`,
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

    // --- Правая панель живая: команды плагинов, тумблеры, «позже» нет ------------------
    const live = await browser.newPage({ viewport: WIDE });
    await live.goto(`${iface.url}?состояние=проект`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    try {
      await live.waitForSelector('[data-testid="context-panel"]', { timeout: 15000 });
    } catch {
      done(1, "правой панели нет на 1440×900");
    }
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
    await live.click('[data-testid="composer-add"]');
    await live.click('[data-testid="add-connect-plugin"]');
    await live.click('[data-testid="plugin-picker"] [data-testid="plugin-row"][data-plugin="git"]');
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
      `приветственная сборка: H1 ${H1_PX} px/700, счётчики ${COUNTERS.join("/")} с честными нулями и числами ${NUMBER_PX} px/600 табличные, без ряда провайдеров, порядок H1 → счётчики → сценарии → модели (ряд до ${MODEL_ROW_LIMIT}), 4 сценария с глифами; разбор: ступени с номерами сворачиваются, код-блок «Копировать→Скопировано» с языком и переносом; сайдбар: группы ${GROUPS.join("/")} и двухстрочные строки; панель: тумблер файлов переключает право чата (без папки — выбор папки проекта), интернет выключен с причиной, команды плагинов через одобрение, «позже» нет`,
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
