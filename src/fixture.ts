// Фикстура для страницы вне окна Tauri: лента и содержимое панелей, которые продукт
// ещё не знает (пункт «Проект и файлы»). Формат движка интерфейсу не известен и знать
// его не должен — он живёт только в Rust (ADR-0001).
//
// Что показывать — по адресу страницы (`src/viewparams.ts`): `?состояние=`, `?обрыв=`.
// В окне Tauri адреса нет, поэтому там пустые панели и тёмная тема.
//
// Сценарий проверки и снимок окна видят те же данные, что продукт, но не трогают
// данные владельца.

import type { FeedEvent, RowKind } from "./bridge";
import type { SidebarChat, SidebarProject } from "./components/Sidebar";
import type { ContextSection } from "./components/ContextPanel";
import { ROOT, project } from "./fixtureTree";
import { params } from "./viewparams";

const ANSWER = "Смотрю структуру папки. Мост на месте.";

/** Абзац без единого пробела: переносится по словам, а при неразрывном слове —
 *  `overflow-wrap: anywhere` (docs/specs/2026-10-05-4-glavnoe-okno.md, «Настоящие данные»). */
const LONG_TEXT = `Длинное${"о".repeat(400)}`;

const UNAVAILABLE = "Сервер OpenCode недоступен, перезапускаю…";
const RECOVERED = "Сервер OpenCode снова отвечает";
const RECONNECT = "Поток прерван, переподключаюсь…";
const DONE = "Ответ модели получен";

const LONG_PROJECT = "Открыть проект из Documents без переименования 2026";
const LONG_PATH = "C:\\Users\\Metalismatic\\Documents\\GnomeCode.wt\\shots\\2026-10-04-p2-r1";
const ACTIVE_CHAT = "Разбор главного окна";

/** Ответ разбора (спека §3, «чат с ответом»): вступление → ступень «1 …» →
 *  ступень «2 …» → ступень с код-блоком внутри. Содержимое — наше, не чужое:
 *  заголовки без номеров — номер ступени считает разбор. */
const RAZBOR_QUESTION = "Посмотри структуру проекта и предложи улучшения";
const RAZBOR = `Смотрю структуру папки. Мост на месте, сборка зелёная.

## Проблемы
Перечисляю найденное:
- строка ответа собирается по кучкам и при обрыве скачет
- источник инструмента называется только именем файла

## Предлагаемые улучшения
Начну с простого: источники уже собираются из строк ленты, дальше — знания проекта.

## Пример кода
\`\`\`ts
const message = "Длинная строка кода переносится внутри плашки, а не вылезает за край ленты: ${"х".repeat(160)}";
\`\`\``;

/** Полный markdown (спека ленты §12): два хода — ступени, подзаголовок,
 *  нумерованный и вложенный списки, таблица шире колонки, цитата, инлайн-код,
 *  ссылка, код-блок; завершённые шаги дают «Sources used». */
const MARKDOWN_QUESTION = "Собери отчёт по панелям окна и покажи таблицей";
const MARKDOWN = `Собрал отчёт по панелям: всё, что видно на срезе проекта \`src\`.

## Состав окна
Считаю по файлам, которые открыл:
1. Шапка чата — \`ChatHeader\`, кластер кнопок окна
2. Лента разговора:
   - колонка чтения 760 px
   - воздух между ходами
   - ступени разбора ответа
3. Композер с чипами файлов

## Сравнение панелей
Собрал размеры в таблицу:

| Панель | Где живёт | Ширина | Режим | Прокрутка | Заметка |
|---|---|---|---|---|---|
| Сайдбар | src/components/Sidebar.tsx | 240 px | колонка | своя | группы дат чатов |
| Лента | src/components/Feed.tsx | 760 px | колонка чтения | вертикальная | разговор без коробок |
| Правая панель | src/components/ContextPanel.tsx | 280 px | оверлей | своя | вкладки «Файлы» и «Символы» |
| Композер | src/components/Composer.tsx | 760 px | колонка чтения | нет | чипы файлов одной линией |
| Меню «⋯» | src/components/ChatHeader.tsx | 320 px | оверлей | нет | команды плагинов чата |
| Сравнение | src/components/ComparePanel.tsx | 560 px | оверлей | своя | каталог моделей с ценами |

> Плотность — про панели: они делятся рамками. Лента наоборот читается воздухом, разговор — текст на чистом листе.

### Детали прокрутки
Таблица шире колонки — ползунок живёт внутри таблицы, сама лента остаётся вертикальной.

\`\`\`ts
const feed = document.querySelector<HTMLElement>(".feed");
// Лента прокручивается только по вертикали, даже когда таблица шире колонки:
const locked = feed ? getComputedStyle(feed).overflowX === "hidden" : false;
\`\`\`

Подробные правила — [интерфейс проекта](https://example.com/gnomecode/design).`;

const MARKDOWN_SECOND = "Покажи уровни заголовков глубже и вложенный список";
const MARKDOWN_SECOND_ANSWER = `Готово: уровни ниже, каждый глубже предыдущего.

#### Уровень четыре
Глубокий заголовок читается меткой: приглушённый, мельче подзаголовка.

##### Уровень пять
Ещё глубже — тот же приём, сдвиг чуть больше.

Списки вкладываются:

- первый уровень
  - второй уровень
    - третий уровень — по 16 px на каждый
- снова первый

\`инлайн-код\`, **жирный** и *курсив* живут в одной строке, а --- делит блоки.

---

Файл токенов открыл, чтобы уровни сверить с системой размеров.`;

const HOUR = 60 * 60 * 1000;

/** Время чата по номеру: первые — сегодня, дальше вчера, неделя и старше —
 *  группы дат сайдбара видны на кадре «много» (спека «Состав основы»). */
const hoursAgo = (index: number): number => {
  if (index < 4) {
    return 1 + index * 2;
  }
  if (index < 8) {
    return 26 + (index - 4) * 6;
  }
  if (index < 28) {
    return 72 + (index - 8) * 4.5;
  }
  return 240 + (index - 28) * 96;
};

/** Строка списка чатов: превью — начало последнего сообщения (спека сайдбара §4);
 *  чат без сообщений превью не несёт — строка одной линией. */
const chatRow = (title: string, preview: string | undefined, hours: number, active = false): SidebarChat => ({
  title,
  ...(preview ? { preview } : {}),
  time: Date.now() - hours * HOUR,
  ...(active ? { active: true } : {}),
});

/** Дефолтный список чатов (спека сайдбара §8): 16 чатов, все четыре группы —
 *  4 сегодня (активный, один без сообщений, один с титулом 60+ знаков), 3 вчера,
 *  5 на этой неделе, 4 ранее; превью — реальные начала сообщений. Поиск «модел»
 *  находит две строки в двух группах, «ффф» — ничего. */
const defaultChats = (): SidebarChat[] => [
  chatRow("Разбор главного окна", "Смотрю структуру папки. Мост на месте, сборка зелёная.", 2, true),
  chatRow(
    "Открыть проект из Documents без переименования 2026 и не сломать путь",
    "Путь и имя папки показывает правая панель, титул — шапка чата",
    3,
  ),
  chatRow("Новый чат без вопросов", undefined, 4),
  chatRow("Настройки модели по умолчанию", "Своя у чата, иначе — выбор страницы «Настройки»", 6),
  chatRow("Собери отчёт по панелям окна", "Собрал отчёт по панелям: всё, что видно на срезе проекта src", 26),
  chatRow("Ползунки прокрутки в цвет", "Дорожка и ползунок на токенах тем, стрелки спрятаны", 30),
  chatRow("Кнопки окна в один кластер", "Тема, свернуть, развернуть и закрыть — правый край шапки", 34),
  chatRow("Мост к OpenCode server", "Типизированный клиент в src-tauri, React не зовёт HTTP", 73),
  chatRow("Плагины в два клика", "Каталог читает index.json, установка спрашивает права", 80),
  chatRow("Права и скоупы вызовов", "Once, Chat, Project и Global — полоса на строке плагина", 85),
  chatRow("Статистика расхода", "Число вызовов и деньги по моделям за неделю", 90),
  chatRow("Здоровье кода и база", "tools/code_check.py считает строки новых файлов", 96),
  chatRow("Каркас окна на Tauri 2", "React 18 и strict-типы, сборка tsc и vite", 240),
  chatRow("Окно без рамки", "Своё окно перетаскивается за шапку чата", 336),
  chatRow("Первый вопрос движку", "opencode serve поднялся, сессия пережила рестарт", 432),
  chatRow("Стенд снимков интерфейса", "Кадры снимает Playwright на странице фикстуры", 528),
];

/** Реалистичные часы реплики (спека ленты §8): минут назад от сейчас. */
const minutesAgo = (minutes: number): number => Date.now() - minutes * 60_000;

/** Строка ленты: тот же вид, что отдаёт `FeedEvent::Row` в Rust; время реплики —
 *  поле события моста (спека ленты §4), у вызовов и служебных строк его нет. */
const row = (id: string, kind: RowKind, text: string, time?: number): FeedEvent => ({
  type: "row",
  id,
  kind,
  text,
  ...(time ? { time } : {}),
});

/** Что владелец видит в строке вопроса: сам вопрос и имена приложенных файлов —
 *  тот же вид, что собирает мост для окна (`project::request`). */
const shown = (text: string, files: string[]): string =>
  files.length ? `${text.trim()}\n\nФайлы: ${files.map(nameOf).join(", ")}` : text;

/** Имя файла из полного пути: чипу и строке вопроса нужно имя, движку — содержимое. */
const nameOf = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/** Путь файла от папки проекта: поле `files` строки вопроса несёт его, как и
 *  `project::request` в окне (src-tauri/src/project/prompt.rs) — по нему блок
 *  источников открывает файл. */
const fromRoot = (path: string): string => {
  const base = ROOT.replace(/\\/g, "/").toLowerCase();
  const whole = path.replace(/\\/g, "/");
  return whole.toLowerCase().startsWith(`${base}/`) ? whole.slice(base.length + 1) : whole;
};

type Listener = (event: FeedEvent) => void;

class Fixture {
  private listeners = new Set<Listener>();
  /** Идентификатор строки вопроса, как в живом мосте (src-tauri/src/opencode/mod.rs):
   *  обрыв потока не начинает нумерацию заново — иначе следующий вопрос занял бы id
   *  прошлой строки и лента заменила бы её вместо новой. */
  private sent = 0;

  /** Много данных: сто строк ленты и сто чатов — длинный чат не должен тормозить.
   *  Реплики несут время (спека ленты §8): вопросы уходят по паре часов —
   *  на кадре видны и «14:32», и «9 окт, …». */
  private static many(): FeedEvent[] {
    const events: FeedEvent[] = [];
    for (let i = 1; i < 100; i += 1) {
      const at = Date.now() - i * 3 * HOUR;
      events.push(row(`user-${i}`, "user", `Вопрос ${i}: проверь пункт ${i}`, at));
      events.push(row(`answer-${i}`, "assistant", "Ответ модели получен", at));
    }
    events.push(row("long", "assistant", LONG_TEXT, Date.now() - HOUR));
    events.push(row("last", "notice", DONE));
    return events;
  }

  /** Что лента отдаёт при подписке — по состоянию экрана. */
  private opening(): FeedEvent[] {
    if (params.feed === "empty") {
      return [];
    }
    if (params.feed === "error") {
      return [row("engine_down", "notice", UNAVAILABLE)];
    }
    if (params.feed === "разбор") {
      // Разбор своего вопроса: строка вопроса → ответ ступенями с код-блоком →
      // исполненный вызов инструмента — источник блока «Sources used».
      const asked = minutesAgo(5);
      return [
        row("razbor_user", "user", RAZBOR_QUESTION, asked),
        row("razbor_answer", "assistant", RAZBOR, minutesAgo(4)),
        { type: "row", id: "razbor_tool", kind: "tool", text: "✓ read · src/bridge.ts", file: "src/bridge.ts" },
        row("razbor_done", "notice", DONE),
      ];
    }
    if (params.feed === "маркдаун") {
      // Полный markdown (спека ленты §12): два хода с завершёнными шагами —
      // под ними блоки «Sources used»; подписи с временем стоят над репликами.
      const firstAsked = minutesAgo(6);
      const secondAsked = minutesAgo(3);
      return [
        row("mark_user", "user", MARKDOWN_QUESTION, firstAsked),
        { type: "row", id: "mark_tool", kind: "tool", text: "✓ read · src/App.tsx", file: "src/App.tsx" },
        row("mark_answer", "assistant", MARKDOWN, minutesAgo(5)),
        row("mark_user2", "user", MARKDOWN_SECOND, secondAsked),
        { type: "row", id: "mark_tool2", kind: "tool", text: "✓ read · src/styles/tokens.css", file: "src/styles/tokens.css" },
        row("mark_answer2", "assistant", MARKDOWN_SECOND_ANSWER, minutesAgo(2)),
      ];
    }
    if (params.feed === "прогресс") {
      // Живой прогресс (спека ленты §12): вопрос → завершённый шаг с чевроном →
      // бегущий вызов без входа — «Ищу…»; ответ ещё не начался.
      return [
        row("progress_user", "user", "Найди в проекте все места с пометкой TODO", minutesAgo(2)),
        { type: "row", id: "progress_done", kind: "tool", text: "✓ read · src/App.tsx", file: "src/App.tsx" },
        row("progress_run", "tool", "⧗ glob"),
      ];
    }
    if (params.feed === "many" || params.feed.startsWith("сравнение")) {
      // Панель сравнения снимается над лентой с сообщениями — кадр целиком.
      return Fixture.many();
    }
    // Лента не пустает при открытии: строка вызова инструмента видна сразу.
    return [row("call_1", "tool", "⧗ read")];
  }

  play(listener: Listener): () => void {
    this.listeners.add(listener);
    for (const event of this.opening()) {
      this.emit(event);
    }
    return () => this.listeners.delete(listener);
  }

  /** Вопрос владельца: своя строка, ответ модели дописывается по кучкам —
   *  позже первого показа, чтобы пустая строка ответа успела показать «Думаю…»,
   *  как в живом окне (спека ленты §6, сценарий стрима).
   *  Прикреплённые файлы видны в строке вопроса именами — как их показывает
   *  `project::prompt` в ленте окна (src-tauri/src/project/prompt.rs) — и идут
   *  полем `files`: по ним блок «Sources used» собирает источники. */
  push(text: string, files: string[]): void {
    this.sent += 1;
    const answerId = `msg_fixture_${this.sent}`;
    const asked = Date.now();
    this.emit({ type: "row", id: `user-${this.sent}`, kind: "user", text: shown(text, files), files: files.map(fromRoot), time: asked });
    this.emit(row(answerId, "assistant", "", asked));
    window.setTimeout(() => {
      for (const part of ANSWER.split(/(?<= )/)) {
        this.emit({ type: "append", id: answerId, delta: part });
      }
      if (params.feed === "error") {
        this.emit(row("engine_back", "notice", RECOVERED));
      }
      if (params.breaks) {
        this.emit(row("stream", "notice", RECONNECT));
      }
      // Вызов инструмента с файлом: тот же вид и то же поле `file`, что отдаёт
      // Feed::tool в окне (src-tauri/src/opencode/client.rs) — источник ответа.
      this.emit({ type: "row", id: "call_1", kind: "tool", text: "✓ read · src/bridge.ts", file: "src/bridge.ts" });
      this.emit(row("engine", "notice", DONE));
    }, 250);
  }

  /** Строка в ленту фикстуры. Слой прав вне окна Tauri вместо Rust-моста (opencode/client.rs)
   *  отдаёт строки здесь: «⧗ плагин · команда» при запуске и отказ «⚠ … requires approval». */
  emit(event: FeedEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Новый чат: лента чистится тем же событием, что шлёт живой мост
   *  (FeedEvent::reset) — следующий вопрос открывает чистую ленту. */
  reset(): void {
    this.emit({ type: "reset" });
  }
}

export type PanelData = {
  projects: SidebarProject[];
  chats: SidebarChat[];
  sections: ContextSection[];
  engineDown: boolean;
  /** Папка проекта, выбранная до открытия окна: пустая — выбирать ещё нечем. */
  project: string;
};

/** Содержимое панелей по состоянию экрана: пусто, ошибка, много данных.
 *  Настоящие строки — те, что в окне бывают на самом деле (спецификация экрана).
 *  «Инструменты» и «Безопасность этого чата» панель собирает сама — из живых
 *  подключений и состояния проекта, фикстуре их выдумывать нечего. */
export function panels(state: typeof params.feed): PanelData {
  if (state === "empty") {
    return { projects: [], chats: [], sections: baseSections(), engineDown: false, project: "" };
  }
  if (state === "many") {
    return {
      projects: [{ title: LONG_PROJECT, path: LONG_PATH }],
      chats: [
        // Превью этих чатов — последняя строка ленты (спека сайдбара §8): у всех
        // ста она «Ответ модели получен», она же превью.
        ...Array.from({ length: 99 }, (_, i) =>
          chatRow(`Вопрос ${i + 1}`, DONE, hoursAgo(i)),
        ),
        chatRow(ACTIVE_CHAT, DONE, 2, true),
      ],
      sections: [
        {
          title: "Проект",
          rows: [
            { label: "Папка", value: LONG_PATH, tone: "mono" },
            { label: "Файлов", value: "1 284 файла", tone: "mono" },
          ],
        },
      ],
      engineDown: false,
      project: "",
    };
  }
  return {
    projects: [{ title: "GnomeCode" }],
    chats: defaultChats(),
    sections: baseSections(),
    engineDown: state === "error",
    project: project() ?? "",
  };
}

function baseSections(): ContextSection[] {
  return [{ title: "Проект", rows: [{ label: "Папка не выбрана", value: "—" }] }];
}

export const fixture = new Fixture();