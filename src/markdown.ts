// Разбор ответа модели (docs/specs/2026-10-10-3-лента.md, §5): полный markdown —
// заголовки разной глубины (`#`/`##` — ступени-заголовки, `###`+ — подзаголовки),
// списки с вложенностью, таблицы, цитаты, разделители, строчное форматирование.
// HTML из ответа не разбирается и не исполняется — ответ модели не код окна,
// незнакомая разметка покажется текстом. Чистая функция без моста и React.
import type { CompareModel } from "./compare";

/** Строчный токен: текст, жирный, курсив, инлайн-код, ссылка. Ссылка без
 *  http(s) — не ссылка, а текст (спека ленты §5). */
export type InlineToken =
  | { t: "text"; v: string }
  | { t: "bold"; v: InlineToken[] }
  | { t: "italic"; v: InlineToken[] }
  | { t: "code"; v: string }
  | { t: "link"; v: InlineToken[]; href: string };

/** Пункт списка: сдвиг 16 px на уровень, маркер «•» или число из текста. */
export type ListItem = { level: number; marker: string; text: InlineToken[] };

/** Блок внутри ответа: абзац, подзаголовки глубины, список, таблица с шапкой,
 *  цитата, разделитель или код-блок с языком. */
export type MarkdownBlock =
  | { type: "para"; text: InlineToken[] }
  | { type: "h3"; text: InlineToken[] }
  | { type: "h4"; text: InlineToken[] }
  | { type: "list"; ordered: boolean; items: ListItem[] }
  | { type: "table"; head: InlineToken[][]; rows: InlineToken[][][] }
  | { type: "quote"; text: InlineToken[] }
  | { type: "hr" }
  | { type: "code"; lang: string; text: string };

/** Ступень разбора: заголовок Markdown с порядковым номером в сообщении. */
export type MarkdownStep = { number: number; title: string; blocks: MarkdownBlock[] };

/** Разобранный ответ: вступление до первой ступени и сами ступени. */
export type MarkdownDoc = { intro: MarkdownBlock[]; steps: MarkdownStep[] };

const FENCE = /^\s*```(.*)$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*$/;
const BULLET = /^(\s*)[-*]\s+(.+?)\s*$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.+?)\s*$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const HR = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;

/** Строчный разбор: `код`, **жирный**, *курсив*, [текст](https://ссылка).
 *  Код первым — внутри обратных кавычек разметка не разбирается; ** раньше *,
 *  иначе жирный разобрался бы курсивом. */
function inline(text: string): InlineToken[] {
  const out: InlineToken[] = [];
  let plain = "";
  const flush = (): void => {
    if (plain) {
      out.push({ t: "text", v: plain });
      plain = "";
    }
  };
  for (let at = 0; at < text.length; ) {
    const rest = text.slice(at);
    const taken =
      takeCode(rest) ??
      takeBold(rest) ??
      takeItalic(rest) ??
      takeLink(rest);
    if (taken) {
      flush();
      out.push(taken.token);
      at += taken.read;
      continue;
    }
    plain += text[at];
    at += 1;
  }
  flush();
  return out;
}

/** Сколько символов съел токен и что он значит; `null` — здесь не токен. */
type Taken = { read: number; token: InlineToken } | null;

function takeCode(rest: string): Taken {
  if (!rest.startsWith("`")) {
    return null;
  }
  const end = rest.indexOf("`", 1);
  return end > 0 ? { read: end + 1, token: { t: "code", v: rest.slice(1, end) } } : null;
}

function takeBold(rest: string): Taken {
  if (!rest.startsWith("**")) {
    return null;
  }
  const end = rest.indexOf("**", 2);
  return end > 0 ? { read: end + 2, token: { t: "bold", v: inline(rest.slice(2, end)) } } : null;
}

function takeItalic(rest: string): Taken {
  if (!rest.startsWith("*")) {
    return null;
  }
  const end = rest.indexOf("*", 1);
  return end > 0 ? { read: end + 1, token: { t: "italic", v: inline(rest.slice(1, end)) } } : null;
}

function takeLink(rest: string): Taken {
  const match = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(rest);
  return match
    ? { read: match[0].length, token: { t: "link", v: inline(match[1]), href: match[2] } }
    : null;
}

/** Ячейки строки таблицы: крайние трубы срезаются, остальное делится по трубам. */
function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Разделитель шапки (`| --- | :---: |`): все клетки — черта с выравниванием. */
const isSeparator = (line: string): boolean =>
  TABLE_ROW.test(line) && cells(line).length > 0 && cells(line).every((cell) => /^:?-+:?$/.test(cell));

/** Разбор текста ответа на вступление и ступени. Заголовок `#`/`##` открывает
 *  новую ступень, номер — порядковый в сообщении; `###` и глубже — подзаголовки
 *  внутри; fenced-код может стоять и внутри ступени, и во вступлении. */
export function parseMarkdown(text: string): MarkdownDoc {
  const doc = new Doc();
  for (const line of text.split("\n")) {
    doc.add(line);
  }
  return doc.done();
}

/** Накопитель блоков: строки заходят по одной, незакрытые состояния (абзац,
 *  список, отложенная шапка таблицы, цитата) сбрасываются перед следующей
 *  структурой — один шаг на вид строки. */
class Doc {
  private intro: MarkdownBlock[] = [];
  private steps: MarkdownStep[] = [];
  private current: MarkdownStep | undefined;
  private paragraph: string[] = [];
  private list: { ordered: boolean; items: ListItem[] } | undefined;
  private head: string[] | undefined;
  private table: { head: InlineToken[][]; rows: InlineToken[][][] } | undefined;
  private quote: string[] = [];
  private fence: { lang: string; lines: string[] } | undefined;

  /** Строка ответа: первым делом проверяются структуры, текст — остаток. */
  add(line: string): void {
    if (this.fenceLine(line) || this.headingLine(line) || this.ruleLine(line)) {
      return;
    }
    if (this.quoteLine(line) || this.tableLine(line) || this.listLine(line)) {
      return;
    }
    this.textLine(line);
  }

  /** Разобранный ответ: хвост сбрасывается, чтобы ничего не потерять. */
  done(): MarkdownDoc {
    this.flushFence();
    this.flushText();
    return { intro: this.intro, steps: this.steps };
  }

  /** Забор кода: открытый забор ест строки целиком, закрытый отдаёт блок. */
  private fenceLine(line: string): boolean {
    const opening = line.match(FENCE);
    if (!opening && !this.fence) {
      return false;
    }
    if (this.fence && !opening) {
      this.fence.lines.push(line);
      return true;
    }
    if (this.fence) {
      this.flushFence();
      return true;
    }
    this.flushText();
    this.fence = { lang: opening![1].trim(), lines: [] };
    return true;
  }

  /** Заголовок: `#`/`##` — новая ступень, `###` — подзаголовок, глубже — метка. */
  private headingLine(line: string): boolean {
    const heading = line.match(HEADING);
    if (!heading) {
      return false;
    }
    this.flushText();
    const level = heading[1].length;
    if (level <= 2) {
      this.current = { number: this.steps.length + 1, title: heading[2], blocks: [] };
      this.steps.push(this.current);
    } else {
      this.push(level === 3 ? { type: "h3", text: inline(heading[2]) } : { type: "h4", text: inline(heading[2]) });
    }
    return true;
  }

  /** Разделитель `---` — линия между блоками. */
  private ruleLine(line: string): boolean {
    if (!HR.test(line)) {
      return false;
    }
    this.flushText();
    this.push({ type: "hr" });
    return true;
  }

  /** Цитата: строки «> …» копятся до пустой строки или другой структуры. */
  private quoteLine(line: string): boolean {
    const quoted = line.match(QUOTE);
    if (!quoted) {
      return false;
    }
    this.flushHead();
    this.flushParagraph();
    this.flushList();
    this.flushTable();
    this.quote.push(quoted[1]);
    return true;
  }

  /** Таблица: строка клеток — шапка-кандидат, ряд или продолжение; разделитель
   *  превращает кандидата в шапку. Кандидат без таблицы — просто текст. */
  private tableLine(line: string): boolean {
    if (isSeparator(line)) {
      if (this.head) {
        this.table = { head: this.head.map(inline), rows: [] };
        this.head = undefined;
      }
      return true;
    }
    if (!TABLE_ROW.test(line)) {
      return false;
    }
    const row = cells(line);
    if (this.head) {
      this.table = { head: this.head.map(inline), rows: [row.map(inline)] };
      this.head = undefined;
    } else if (this.table) {
      this.table.rows.push(row.map(inline));
    } else {
      this.flushParagraph();
      this.flushList();
      this.flushQuote();
      this.head = row;
    }
    return true;
  }

  /** Пункт списка: маркер или число, сдвиг — по двум пробелам уровня. */
  private listLine(line: string): boolean {
    const mark = line.match(BULLET);
    const count = mark ? null : line.match(NUMBERED);
    if (!mark && !count) {
      return false;
    }
    this.flushHead();
    this.flushParagraph();
    this.flushTable();
    this.flushQuote();
    if (mark) {
      this.addItem(false, Math.floor(mark[1].replace(/\t/g, "  ").length / 2), "•", mark[2]);
    } else {
      this.addItem(true, Math.floor(count![1].replace(/\t/g, "  ").length / 2), count![2], count![3]);
    }
    return true;
  }

  /** Пустая строка закрывает текст, обычная — дописывает абзац. */
  private textLine(line: string): void {
    if (!line.trim()) {
      this.flushText();
      return;
    }
    this.flushList();
    this.flushHead();
    this.flushTable();
    this.flushQuote();
    this.paragraph.push(line.trim());
  }

  private addItem(ordered: boolean, level: number, marker: string, text: string): void {
    if (!this.list || this.list.ordered !== ordered) {
      this.flushList();
      this.list = { ordered, items: [] };
    }
    this.list.items.push({ level, marker, text: inline(text) });
  }

  private push(block: MarkdownBlock): void {
    if (this.current) {
      this.current.blocks.push(block);
    } else {
      this.intro.push(block);
    }
  }

  private flushParagraph(): void {
    if (this.paragraph.length) {
      this.push({ type: "para", text: inline(this.paragraph.join(" ")) });
      this.paragraph = [];
    }
  }

  private flushList(): void {
    if (this.list) {
      this.push({ type: "list", ordered: this.list.ordered, items: this.list.items });
      this.list = undefined;
    }
  }

  private flushHead(): void {
    // Строка клеток без разделителя под ней — не таблица, а текст.
    if (this.head) {
      this.paragraph.push(this.head.join(" "));
      this.head = undefined;
    }
  }

  private flushTable(): void {
    if (this.table) {
      this.push({ type: "table", head: this.table.head, rows: this.table.rows });
      this.table = undefined;
    }
  }

  private flushQuote(): void {
    if (this.quote.length) {
      this.push({ type: "quote", text: inline(this.quote.join("\n")) });
      this.quote = [];
    }
  }

  private flushText(): void {
    this.flushHead();
    this.flushParagraph();
    this.flushList();
    this.flushTable();
    this.flushQuote();
  }

  private flushFence(): void {
    if (this.fence) {
      this.push({ type: "code", lang: this.fence.lang, text: this.fence.lines.join("\n") });
      this.fence = undefined;
    }
  }
}

export type KnownModel = { name: string; lab: string };

/** Ряд моделей приветственной сборки: модель текущего чата первой, известные
 *  за ней; повтор по имени не дублируется (спека «Настоящие данные»). Ряд
 *  провайдеров удалён: десятки карточек съели сборку до сгиба — список
 *  провайдеров живёт в «Настройки → Модели» и в панели сравнения
 *  (замечание владельца 2026-10-06, живая копия 21:46). */
export function knownModels(current: string, known: CompareModel[]): KnownModel[] {
  const list = known.map((model) => ({ name: model.name, lab: model.lab }));
  if (!list.some((model) => model.name === current)) {
    list.unshift({ name: current, lab: "" });
  }
  return list;
}
