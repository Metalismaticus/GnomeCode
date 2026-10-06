// Markdown-lite разбор ответа модели (docs/specs/2026-10-06-11-glavnoe.md, «Компоненты»):
// fenced-код становится код-блоком, заголовки — ступенями разбора, списки — строками
// с маркером. Полный рендер Markdown не нужен: сложные ответы отрендерятся частично,
// обычный текст и переносы строк не ломаются. Чистая функция без моста и React.
import type { CompareModel } from "./compare";

/** Блок внутри ответа: абзац, список или код-блок с языком. */
export type MarkdownBlock =
  | { type: "para"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; lang: string; text: string };

/** Ступень разбора: заголовок Markdown с порядковым номером в сообщении. */
export type MarkdownStep = { number: number; title: string; blocks: MarkdownBlock[] };

/** Разобранный ответ: вступление до первой ступени и сами ступени. */
export type MarkdownDoc = { intro: MarkdownBlock[]; steps: MarkdownStep[] };

const HEADING = /^#{1,6}\s+(.+?)\s*$/;
const LIST = /^\s*[-*]\s+(.+?)\s*$/;
const FENCE = /^\s*```(.*)$/;

/** Разбор текста ответа на вступление и ступени. Заголовок открывает новую ступень,
 *  номер — порядковый в сообщении (спека «Состав основы»), fenced-код может стоять
 *  и внутри ступени, и во вступлении. */
export function parseMarkdown(text: string): MarkdownDoc {
  const intro: MarkdownBlock[] = [];
  const steps: MarkdownStep[] = [];
  let current: MarkdownStep | undefined;
  let paragraph: string[] = [];
  let list: string[] = [];
  let fence: { lang: string; lines: string[] } | undefined;

  const push = (block: MarkdownBlock): void => {
    if (current) {
      current.blocks.push(block);
    } else {
      intro.push(block);
    }
  };
  const flushParagraph = (): void => {
    if (paragraph.length) {
      push({ type: "para", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = (): void => {
    if (list.length) {
      push({ type: "list", items: list });
      list = [];
    }
  };
  const flushFence = (): void => {
    if (fence) {
      push({ type: "code", lang: fence.lang, text: fence.lines.join("\n") });
      fence = undefined;
    }
  };

  for (const line of text.split("\n")) {
    const opening = line.match(FENCE);
    if (opening) {
      if (fence) {
        flushFence();
      } else {
        flushParagraph();
        flushList();
        fence = { lang: opening[1].trim(), lines: [] };
      }
      continue;
    }
    if (fence) {
      fence.lines.push(line);
      continue;
    }
    const heading = line.match(HEADING);
    if (heading) {
      flushParagraph();
      flushList();
      current = { number: steps.length + 1, title: heading[1], blocks: [] };
      steps.push(current);
      continue;
    }
    const item = line.match(LIST);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushFence();
  flushParagraph();
  flushList();
  return { intro, steps };
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

