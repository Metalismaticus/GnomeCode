// Код-блок ответа модели (docs/specs/2026-10-06-11-glavnoe.md, «Состав основы»):
// тёмная плашка --code-bg в обеих темах, в шапке — имя языка и кнопка «Копировать»,
// видимая без наведения. Подсветка — highlight.js (подмножество языков); цвета
// подсветки — токены (CodeBlock.css), не чужая тема библиотеки.
import { useState } from "react";
import hljs from "highlight.js/lib/common";

import "./CodeBlock.css";

const COPY = "Копировать";
const COPIED = "Скопировано";
const COPIED_MS = 2000;

/** Побег HTML для языка, которого нет в подмножестве: код показывается как есть. */
const escaped = (code: string): string =>
  code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const language = lang && hljs.getLanguage(lang) ? lang : "";
  const marked = language ? hljs.highlight(code, { language }).value : escaped(code);

  /** Копирование в буфер; подпись «Скопировано» — сразу, на 2 с: в headless-проверке
   *  и в окне буфер может быть недоступен, а действие владелец уже совершил. */
  const copy = (): void => {
    setCopied(true);
    try {
      void navigator.clipboard.writeText(code).catch(() => {});
    } catch {
      // Буфер недоступен — подпись уже показана, текст остаётся в код-блоке.
    }
    window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className="codeblock" data-testid="codeblock">
      <div className="codeblock__head">
        <span className="codeblock__lang" data-testid="code-lang">
          {lang || "код"}
        </span>
        <button type="button" className="codeblock__copy" data-testid="code-copy" onClick={copy}>
          {copied ? COPIED : COPY}
        </button>
      </div>
      <pre className="codeblock__code">
        <code
          className={language ? `hljs language-${language}` : "hljs"}
          dangerouslySetInnerHTML={{ __html: marked }}
        />
      </pre>
    </div>
  );
}
