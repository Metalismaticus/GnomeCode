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

/** Строка ленты: тот же вид, что отдаёт `FeedEvent::Row` в Rust. */
const row = (id: string, kind: RowKind, text: string): FeedEvent => ({ type: "row", id, kind, text });

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

  /** Много данных: сто строк ленты и сто чатов — длинный чат не должен тормозить. */
  private static many(): FeedEvent[] {
    const events: FeedEvent[] = [];
    for (let i = 1; i < 100; i += 1) {
      events.push(row(`user-${i}`, "user", `Вопрос ${i}: проверь пункт ${i}`));
      events.push(row(`answer-${i}`, "assistant", "Ответ модели получен"));
    }
    events.push(row("long", "assistant", LONG_TEXT));
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

  /** Вопрос владельца: своя строка, ответ модели дописывается по кучкам.
   *  Прикреплённые файлы видны в строке вопроса именами — как их показывает
   *  `project::prompt` в ленте окна (src-tauri/src/project/prompt.rs) — и идут
   *  полем `files`: по ним блок «Sources used» собирает источники. */
  push(text: string, files: string[]): void {
    this.sent += 1;
    const answerId = `msg_fixture_${this.sent}`;
    this.emit({ type: "row", id: `user-${this.sent}`, kind: "user", text: shown(text, files), files: files.map(fromRoot) });
    this.emit(row(answerId, "assistant", ""));
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
  }

  /** Строка в ленту фикстуры. Слой прав вне окна Tauri вместо Rust-моста (opencode/client.rs)
   *  отдаёт строки здесь: «⧗ плагин · команда» при запуске и отказ «⚠ … requires approval». */
  emit(event: FeedEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export type PanelData = {
  projects: string[];
  chats: { title: string; active?: boolean }[];
  sections: ContextSection[];
  engineDown: boolean;
  /** Папка проекта, выбранная до открытия окна: пустая — выбирать ещё нечем. */
  project: string;
};

/** Содержимое панелей по состоянию экрана: пусто, ошибка, много данных.
 *  Настоящие строки — те, что в окне бывают на самом деле (спецификация экрана). */
export function panels(state: typeof params.feed): PanelData {
  if (state === "empty") {
    return { projects: [], chats: [], sections: baseSections(), engineDown: false, project: "" };
  }
  if (state === "many") {
    return {
      projects: [LONG_PROJECT],
      chats: [...Array.from({ length: 99 }, (_, i) => ({ title: `Вопрос ${i + 1}` })), { title: ACTIVE_CHAT, active: true }],
      sections: [
        {
          title: "Проект",
          rows: [
            { label: "Папка", value: LONG_PATH, tone: "mono" },
            { label: "Файлов", value: "1 284 файла", tone: "mono" },
          ],
        },
        ...baseSections().slice(1),
      ],
      engineDown: false,
      project: "",
    };
  }
  return {
    projects: ["GnomeCode"],
    chats: [{ title: ACTIVE_CHAT, active: true }],
    sections: baseSections(),
    engineDown: state === "error",
    project: project() ?? "",
  };
}

function baseSections(): ContextSection[] {
  return [
    { title: "Проект", rows: [{ label: "Папка не выбрана", value: "—" }] },
    {
      title: "Инструменты",
      rows: [
        { label: "Терминал", value: "позже" },
        { label: "Файловый менеджер", value: "позже" },
      ],
    },
    {
      title: "Безопасность этого чата",
      rows: [
        { label: "Доступ к файловой системе", value: "Выключен", tone: "off" },
        { label: "Интернет", value: "Выключен", tone: "off" },
      ],
    },
  ];
}

export const fixture = new Fixture();