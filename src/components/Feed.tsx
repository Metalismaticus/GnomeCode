import { Fragment, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";

import { DEFAULT_MODEL } from "../appstate";
import type { FeedRow } from "../bridge";
import { parseMarkdown, type MarkdownBlock } from "../markdown";
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

/** Первый символ строки вызова — знак статуса: ✓ успех, ⚠ отказ, ⧗ работает. */
const SIGN = /^(✓|⚠|⧗)/;

const SIGN_TONE: Record<string, string> = {
  "✓": "feed__sign--ok",
  "⚠": "feed__sign--warn",
  "⧗": "feed__sign--run",
};

/** Детали раскрытого шага под его строкой: у вызова плагина — Плагин / Чат /
 *  Скилл / Модель (docs/SPEC/plugins.md, сцена J): Usage/Audit — какой плагин
 *  сгенерировал вызов, где и чем. У вызова с файлом — полный путь. Модель пока
 *  одна (ниже константа — переключение появится с панелью «Сравнение моделей»),
 *  скиллов в продукте ещё нет (Этап 3) — деталь честно «—», не выдуманная.
 *  Раскрывается только то, что строка знает: выдуманных деталей нет (спека §7). */
function RowDetails({ row, chatTitle }: { row: FeedRow; chatTitle: string }) {
  return (
    <div className="feed__details" data-testid="feed-row-details">
      {row.plugin ? (
        <>
          <div className="feed__detail">Плагин: {row.plugin}</div>
          <div className="feed__detail">Чат: {chatTitle}</div>
          <div className="feed__detail">Скилл: —</div>
          <div className="feed__detail">Модель: {DEFAULT_MODEL}</div>
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

/** Свёрнутый шаг вызова: знак статуса + текст вызова + чеврон (спека §7).
 *  Бегущий ⧗ тоже свёрнут — прогресс виден пульсирующим знаком. Чеврон стоит
 *  только у строк с известными деталями; по умолчанию шаг свёрнут всегда. */
function ToolLine({ row }: { row: FeedRow }) {
  const sign = SIGN.exec(row.text)?.[1] ?? "";
  const rest = sign ? row.text.slice(sign.length).trimStart() : row.text;
  return (
    <span className="feed__step">
      {sign ? <span className={`feed__sign ${SIGN_TONE[sign] ?? ""}`}>{sign}</span> : null}
      {sign ? " " : ""}
      {rest || "…"}
      {row.plugin || row.file ? <span className="feed__chevron" aria-hidden="true">▸</span> : null}
    </span>
  );
}

/** Ответ модели Markdown-lite (спека «Компоненты»): заголовки — ступени,
 *  fenced-код — код-блок, списки — строки с маркером; обычный текст — абзацы.
 *  Во время стрима текст дописывается — разбор пересчитывается сам. */
function AssistantText({ text }: { text: string }) {
  const doc = useMemo(() => parseMarkdown(text), [text]);
  if (!doc.intro.length && !doc.steps.length) {
    return "…";
  }
  return (
    <>
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
    </>
  );
}

function MarkedBlock({ block }: { block: MarkdownBlock }) {
  if (block.type === "code") {
    return <CodeBlock lang={block.lang} code={block.text} />;
  }
  if (block.type === "list") {
    return (
      <div className="feed__list">
        {block.items.map((item, index) => (
          <div key={index} className="feed__list-item">
            {item}
          </div>
        ))}
      </div>
    );
  }
  return <div className="feed__para">{block.text}</div>;
}

/** Лента: строки по порядку, вид строки — по её роли в разговоре. */
export function Feed({
  rows,
  error,
  chatTitle,
  onSourceFile,
  onSourcePlugin,
}: {
  rows: FeedRow[];
  error: string;
  /** Титул чата для деталей вызова — тот, что стоит в шапке. */
  chatTitle: string;
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
      {rows.map((row) => {
        const tone = TONE[Object.keys(TONE).find((text) => row.text.startsWith(text)) ?? ""] ?? "";
        /** Шаг с известными деталями — кнопка: роль, клик и обводка фокуса. */
        const expandable = row.kind === "tool" && Boolean(row.plugin || row.file);
        const expanded = expandable && opened === row.id;
        const block = blocks.get(row.id);
        return (
          <Fragment key={row.id}>
            <div
              className={`feed__row feed__row--${row.kind}${tone ? ` ${tone}` : ""}${expandable ? " feed__row--expandable" : ""}`}
              data-kind={row.kind}
              {...(expansion(row, expanded, toggle) as object)}
            >
              {row.kind === "tool" ? <ToolLine row={row} /> : null}
              {row.kind === "assistant" ? <AssistantText text={row.text} /> : null}
              {row.kind !== "tool" && row.kind !== "assistant" ? row.text || "…" : null}
            </div>
            {expanded ? <RowDetails row={row} chatTitle={chatTitle} /> : null}
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
