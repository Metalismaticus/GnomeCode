// Источники ответа (docs/SPEC/phase2.md, раздел 9.1 «Источники»): сборка из строк
// ленты — чистая функция, без моста и React. Знания (Context Pack, Skill) в продукте
// ещё нет (Этап 3) — источник — только то, что было в запросе или работе на самом
// деле: файлы вопроса и исполненные вызовы инструментов с файлом, плагины с их
// исполненными командами. Отказы («⚠ … denied») источником не были — их не показываем.
import type { FeedRow } from "./bridge";

export type Source =
  | { kind: "file"; name: string; path: string }
  | { kind: "plugin"; id: string; name: string };

/** Имя файла для строки блока: последний сегмент пути — чип и вызов инструмента
 *  показывают файл одним именем, полный путь остаётся у источника для открытия. */
const nameOf = (path: string): string => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

/** Источники одного хода: строки от вопроса владельца до следующего вопроса.
 *  Файл вопроса идёт полем `files`, файл исполненного вызова («✓») — полем `file`,
 *  исполненная команда плагина («⧗») — полем `plugin`. Повторы сворачиваются
 *  по имени: чип и чтение того же файла — один источник. */
export function sourcesOfTurn(turn: FeedRow[]): Source[] {
  const sources: Source[] = [];
  const seen = new Set<string>();
  const add = (name: string, source: Source): void => {
    if (!seen.has(name)) {
      seen.add(name);
      sources.push(source);
    }
  };
  for (const row of turn) {
    for (const path of row.files ?? []) {
      add(nameOf(path), { kind: "file", name: nameOf(path), path });
    }
    if (row.kind === "tool" && row.file) {
      add(nameOf(row.file), { kind: "file", name: nameOf(row.file), path: row.file });
    }
    if (row.kind === "tool" && row.plugin && row.text.startsWith("⧗")) {
      add(row.plugin, { kind: "plugin", id: row.plugin, name: row.plugin });
    }
  }
  return sources;
}

/** Блоки источников ленты: id строки, после которой рендерить блок хода, → его
 *  источники. Ход — строки от вопроса владельца до следующего; блок — под ответом,
 *  после последней строки хода: служебные строки хода (вызовы инструментов,
 *  «Ответ модели получен») остаются между вопросом и его источниками, а не поверх
 *  блока. Блок только если в ходе был ответ модели и нашёлся источник — пустых нет. */
export function sourceBlocks(rows: FeedRow[]): Map<string, Source[]> {
  const blocks = new Map<string, Source[]>();
  let turn: FeedRow[] = [];
  let answered = false;
  const flush = (): void => {
    const last = turn[turn.length - 1];
    const sources = answered && last ? sourcesOfTurn(turn) : [];
    if (sources.length) {
      blocks.set(last.id, sources);
    }
    turn = [];
    answered = false;
  };
  for (const row of rows) {
    if (row.kind === "user" && turn.length) {
      flush();
    }
    if (row.kind === "assistant") {
      answered = true;
    }
    turn.push(row);
  }
  flush();
  return blocks;
}
