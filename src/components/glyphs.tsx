// Глифы карточек сценариев (docs/specs/2026-10-06-11-glavnoe.md, «Компоненты»):
// четыре inline-SVG 16×16, контур цветом текста (stroke: currentColor) — никакого
// иконного набора в продукте нет, поэтому минимальные собственные знаки.
import "./glyphs.css";

type GlyphProps = { className?: string };

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/** Папка — сценарий «Открыть проект». */
export function FolderGlyph({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2 5.2c0-1 .8-1.7 1.7-1.7h2.4l1.5 1.8h4.7c1 0 1.7.8 1.7 1.7v5.3c0 1-.8 1.7-1.7 1.7H3.7c-1 0-1.7-.8-1.7-1.7z" />
    </svg>
  );
}

/** Чат — сценарий «Новый чат». */
export function ChatGlyph({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 3h9c.6 0 1 .4 1 1v6.5c0 .6-.4 1-1 1H8.3L5 14.5v-3H3.5c-.6 0-1-.4-1-1V4c0-.6.4-1 1-1z" />
    </svg>
  );
}

/** Пазл — сценарий «Подключить плагин». */
export function PuzzleGlyph({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 6.2c0-.7.5-1.2 1.2-1.2h1.5a1.9 1.9 0 1 1 3.6 0h1.5c.7 0 1.2.5 1.2 1.2v1.5a1.9 1.9 0 1 0 0 3.6v1.5c0 .7-.5 1.2-1.2 1.2H4.2c-.7 0-1.2-.5-1.2-1.2z" />
    </svg>
  );
}

/** Весы — сценарий «Сравнить модели». */
export function ScalesGlyph({ className }: GlyphProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 2.5v10M5 12.5h6M3.2 5.2h9.6" />
      <path d="M3.2 5.2 2 8.4a2 2 0 0 0 2.4 0zM12.8 5.2l-1.2 3.2a2 2 0 0 0 2.4 0z" />
    </svg>
  );
}
