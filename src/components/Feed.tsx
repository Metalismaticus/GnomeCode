import { Fragment, useMemo, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";

import { DEFAULT_MODEL } from "../appstate";
import type { FeedRow } from "../bridge";
import { timeOf } from "../compare";
import type { InlineToken, MarkdownBlock } from "../markdown";
import { parseMarkdown } from "../markdown";
import { sourceBlocks } from "../sources";
import { CodeBlock } from "./CodeBlock";
import { SourcesBlock } from "./SourcesBlock";
import { StepSection } from "./StepSection";

import "./Feed.css";

/** Строка о состоянии движка видна своим цветом: потеря и возврат — не тихие заметки. */
const TONE: Record<string, string> = {
  "Сервер OpenCode недоступен, перезапускаю…": "feed__row--down",
  "Сервер OpenCode снова отвечает": "feed__row--back",
  "Сообщение не ушло": "feed__row--down",
};

/** Первый символ строки вызова — знак статуса: ✓ успех, ⚠ отказ, ✗ провал;
 *  ⧗/⋯ значит «ещё работает» — на бегущей строке знак не рисуется, работа
 *  видна словами (спека ленты §6), знак остаётся у завершённых. */
const SIGN = /^(✓|⚠|✗|⧗|⋯)/;

const SIGN_TONE: Record<string, string> = {
  "✓": "feed__sign--ok",
  "⚠": "feed__sign--warn",
  "✗": "feed__sign--fail",
};

/** Глагол бегущего вызова по его имени — таблица в одном месте (спека ленты §6).
 *  Неизвестное — имя как есть: вызов с таким именем правда идёт. */
const VERBS: Record<string, string> = {
  read: "Читаю",
  grep: "Ищу",
  glob: "Ищу",
  list: "Смотрю",
  bash: "Запускаю",
  edit: "Правлю",
  write: "Пишу",
  webfetch: "Открываю",
  task: "Поручаю",
};

/** Детали раскрытого шага под его строкой: у вызова плагина — Плагин / Чат /
 *  Скилл / Модель (docs/SPEC/plugins.md, сцена J): Usage/Audit — какой плагин
 *  сгенерировал вызов, где и чем. У вызова с файлом — полный путь. Модель одна
 *  на окно (та же, что в подписи ответа), скиллов в продукте ещё нет (Этап 3) —
 *  деталь честно «—», не выдуманная. Раскрывается только то, что строка знает:
 *  выдуманных деталей нет (спека §7). */
function RowDetails({ row, chatTitle, model }: { row: FeedRow; chatTitle: string; model: string }) {
  return (
    <div className="feed__details" data-testid="feed-row-details">
      {row.plugin ? (
        <>
          <div className="feed__detail">Плагин: {row.plugin}</div>
          <div className="feed__detail">Чат: {chatTitle}</div>
          <div className="feed__detail">Скилл: —</div>
          <div className="feed__detail">Модель: {model || DEFAULT_MODEL}</div>
        </>
      ) : null}
      {row.file ? <div className="feed__detail">Файл: {row.file}</div> : null}
    </div>
  );
}

/** Что строка, раскрывающаяся деталями, добавляет к обычной: клик по любой точке
 *  строки — открыть, повторный — закрыть; с клавиатуры — Enter или пробел. У
 *  строки без известных деталей (нет ни плагина, ни файла) роли кнопки нет —
 *  она просто тихий шаг. */
function expansion(row: FeedRow, open: boolean, toggle: (id: string) => void) {
  if (row.kind !== "tool" || (!row.plugin && !row.file)) {
    return {};
  }
  return {
    role: "button",
    tabIndex: 0,
    title: "Детали вызова",
    "aria-expanded": open,
    onClick: () => toggle(row.id),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        toggle(row.id);
      }
    },
  };
}

/** Бегущий вызов словами: глагол по имени + деталь строки; у команды плагина
 *  глаголов нет — её слова пишет автор плагина. Детали нет — глагол один,
 *  файл не выдумывается (спека ленты §6). */
function runningText(rest: string, plugin: boolean): string {
  if (plugin) {
    return rest;
  }
  const [name, ...detail] = rest.split(" · ");
  const verb = VERBS[name] ?? name;
  return detail.length ? `${verb} ${detail.join(" · ")}` : verb;
}

/** Строка вызова: завершённая — знак статуса + текст + чеврон (спека §7);
 *  бегущая («⧗ read», «⋯ read · src/bridge.ts») — словами с живым многоточием
 *  и без знака: «Читаю src/bridge.ts…» (спека ленты §6). */
function ToolLine({ row }: { row: FeedRow }) {
  const sign = SIGN.exec(row.text)?.[1] ?? "";
  const rest = sign ? row.text.slice(sign.length).trimStart() : row.text;
  if (sign === "⧗" || sign === "⋯") {
    return (
      <span className="feed__step feed__run" data-testid="feed-run">
        {runningText(rest, Boolean(row.plugin))}
        <span className="feed__dots" aria-hidden="true">…</span>
      </span>
    );
  }
  return (
    <span className="feed__step">
      {sign ? <span className={`feed__sign ${SIGN_TONE[sign] ?? ""}`}>{sign}</span> : null}
      {sign ? " " : ""}
      {rest || "…"}
      {row.plugin || row.file ? <span className="feed__chevron" aria-hidden="true">▸</span> : null}
    </span>
  );
}

/** Строчное форматирование: жирный, курсив, инлайн-код, ссылка. Ссылка без
 *  http(s) — не ссылка, а текст (разбор её таким и отдаёт). */
function Inline({ tokens }: { tokens: InlineToken[] }): ReactNode {
  return tokens.map((token, index) => {
    if (token.t === "bold") {
      return (
        <strong key={index} className="feed__b">
          <Inline tokens={token.v} />
        </strong>
      );
    }
    if (token.t === "italic") {
      return (
        <em key={index} className="feed__i">
          <Inline tokens={token.v} />
        </em>
      );
    }
    if (token.t === "code") {
      return (
        <code key={index} className="feed__code">
          {token.v}
        </code>
      );
    }
    if (token.t === "link") {
      return (
        <a key={index} className="feed__link" href={token.href} target="_blank" rel="noreferrer">
          <Inline tokens={token.v} />
        </a>
      );
    }
    return token.v;
  });
}

/** Список: маркер или число висит в желобе, текст с отступом по уровню. */
function MarkedList({ block }: { block: Extract<MarkdownBlock, { type: "list" }> }) {
  return (
    <div className={`feed__list${block.ordered ? " feed__list--ordered" : ""}`}>
      {block.items.map((item, index) => (
        <div
          key={index}
          className="feed__list-item"
          style={{ paddingLeft: `calc(var(--space-4) * ${item.level + 1})` }}
        >
          <span className="feed__marker" aria-hidden="true">
            {item.marker}
          </span>
          <span className="feed__list-text">
            <Inline tokens={item.text} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Таблица в своей горизонтальной прокрутке: шапка и ряды, клетки не переносятся. */
function MarkedTable({ block }: { block: Extract<MarkdownBlock, { type: "table" }> }) {
  return (
    <div className="feed__table">
      <table>
        <thead>
          <tr>
            {block.head.map((cell, index) => (
              <th key={index}>
                <Inline tokens={cell} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, at) => (
            <tr key={at}>
              {row.map((cell, index) => (
                <td key={index}>
                  <Inline tokens={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Блок ответа: абзац, подзаголовки глубины, список, таблица, цитата,
 *  разделитель, код-блок. */
function MarkedBlock({ block }: { block: MarkdownBlock }) {
  if (block.type === "code") {
    return <CodeBlock lang={block.lang} code={block.text} />;
  }
  if (block.type === "para") {
    return (
      <div className="feed__para">
        <Inline tokens={block.text} />
      </div>
    );
  }
  if (block.type === "h3" || block.type === "h4") {
    return (
      <div className={`feed__${block.type}`}>
        <Inline tokens={block.text} />
      </div>
    );
  }
  if (block.type === "list") {
    return <MarkedList block={block} />;
  }
  if (block.type === "table") {
    return <MarkedTable block={block} />;
  }
  if (block.type === "quote") {
    return (
      <div className="feed__quote">
        <Inline tokens={block.text} />
      </div>
    );
  }
  return <hr className="feed__hr" />;
}

/** Ответ модели — полный markdown (спека ленты §5): заголовки `#`/`##` —
 *  нумерованные ступени, остальное — блоки. Во время стрима текст дописывается —
 *  разбор пересчитывается сам. Пустая строка ответа читается «Думаю…» и уходит
 *  с первым кусочком текста или шагом (§6). */
function AssistantText({ text }: { text: string }) {
  const doc = useMemo(() => parseMarkdown(text), [text]);
  if (!doc.intro.length && !doc.steps.length) {
    return (
      <span className="feed__run" data-testid="feed-run">
        Думаю<span className="feed__dots" aria-hidden="true">…</span>
      </span>
    );
  }
  return (
    <div className="feed__text">
      {doc.intro.map((block, index) => (
        <MarkedBlock key={`intro-${index}`} block={block} />
      ))}
      {doc.steps.map((step) => (
        <StepSection key={step.number} number={step.number} title={step.title}>
          {step.blocks.map((block, index) => (
            <MarkedBlock key={index} block={block} />
          ))}
        </StepSection>
      ))}
    </div>
  );
}

/** Подпись реплики: «Вы» у вопроса, имя модели у ответа, время из данных
 *  (спека ленты §4); нет времени в событии — подпись без времени. */
function RowLabel({ who, time }: { who: string; time?: number }) {
  return <div className="feed__label">{time ? `${who} · ${timeOf(time)}` : who}</div>;
}

/** Ритм хода (спека ленты §4): вопрос и шаг перед ответом стоят на 12 px до
 *  следующей строки, остальные строки хода — по зазору 8. */
function gapClass(row: FeedRow, next?: FeedRow): string {
  const before = next?.kind === "assistant" && (row.kind === "user" || row.kind === "tool");
  return before ? " feed__row--gap" : "";
}

/** Лента: строки по порядку, вид строки — по её роли в разговоре. */
export function Feed({
  rows,
  error,
  chatTitle,
  model,
  onSourceFile,
  onSourcePlugin,
}: {
  rows: FeedRow[];
  error: string;
  /** Титул чата для деталей вызова — тот, что стоит в шапке. */
  chatTitle: string;
  /** Имя модели чата — подпись ответа (спека ленты §8): модель одна на окно. */
  model: string;
  /** Клик по источнику-файлу: показать файл в дереве правой панели. */
  onSourceFile: (path: string) => void;
  /** Клик по источнику-плагину: открыть раздел «Плагины». */
  onSourcePlugin: (id: string) => void;
}) {
  /** Раскрытая строка вызова: клик по строке — открыть, повторный — закрыть. */
  const [opened, setOpened] = useState<string | undefined>(undefined);
  const toggle = (id: string): void => {
    setOpened((open) => (open === id ? undefined : id));
  };
  /** Блоки источников по ходам: под какой строкой какой блок (src/sources.ts). */
  const blocks = useMemo(() => sourceBlocks(rows), [rows]);
  return (
    <>
      {rows.map((row, index) => {
        const tone = TONE[Object.keys(TONE).find((text) => row.text.startsWith(text)) ?? ""] ?? "";
        /** Шаг с известными деталями — кнопка: роль, клик и обводка фокуса. */
        const expandable = row.kind === "tool" && Boolean(row.plugin || row.file);
        const expanded = expandable && opened === row.id;
        const block = blocks.get(row.id);
        const label =
          row.kind === "user" ? "Вы" : row.kind === "assistant" ? model || DEFAULT_MODEL : "";
        return (
          <Fragment key={row.id}>
            <div
              className={`feed__row feed__row--${row.kind}${tone ? ` ${tone}` : ""}${expandable ? " feed__row--expandable" : ""}${gapClass(row, rows[index + 1])}`}
              data-kind={row.kind}
              {...(expansion(row, expanded, toggle) as object)}
            >
              {label ? <RowLabel who={label} time={row.time} /> : null}
              {row.kind === "tool" ? <ToolLine row={row} /> : null}
              {row.kind === "assistant" ? <AssistantText text={row.text} /> : null}
              {row.kind !== "tool" && row.kind !== "assistant" ? row.text || "…" : null}
            </div>
            {expanded ? <RowDetails row={row} chatTitle={chatTitle} model={model} /> : null}
            {block ? (
              <SourcesBlock sources={block} onFile={onSourceFile} onPlugin={onSourcePlugin} />
            ) : null}
          </Fragment>
        );
      })}
      {error ? <div className="feed__notice">{error}</div> : null}
    </>
  );
}
