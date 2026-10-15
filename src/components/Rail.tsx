// Левый icon-rail (B10, концепт владельца 14.10): логотип, поиск, «+ Новый
// чат», иконки-разделы и быстрые действия. Активный раздел подсвечен; те
// разделы, чьих страниц пока нет (Сравнение/Провайдеры/Безопасность),
// ведут в ближайший существующий экран — дополнятся со своими страницами.

import type { ReactNode } from "react";

import logoMark from "../assets/logo.png";

import "./Rail.css";

export type RailPage = "chat" | "plugins" | "settings" | "stats";

export type RailProps = {
  page: RailPage;
  onPage: (page: RailPage) => void;
  /** «+ Новый чат»: тот же ход, что кнопка сайдбара. */
  onNewChat: () => void;
};

/** Разделы rail: иконка (глиф-символ) и подпись. */
const ITEMS: { page: RailPage; glyph: string; label: string }[] = [
  { page: "chat", glyph: "💬", label: "Чаты" },
  { page: "plugins", glyph: "🧩", label: "MCP и плагины" },
  { page: "stats", glyph: "📊", label: "Использование" },
  { page: "settings", glyph: "⚙", label: "Настройки" },
];

/** Быстрые действия под разделами. «Открыть папку» убрана — дублирует
 *  «+ Новый проект» в колонке чатов (владелец 14.10: «зачем?»). */

export function Rail({ page, onPage, onNewChat }: RailProps) {
  const item = (glyph: string, label: string, active: boolean, onClick: () => void, testid?: string): ReactNode => (
    <button
      type="button"
      key={label}
      className={`rail__item${active ? " rail__item--active" : ""}`}
      data-testid={testid}
      title={label}
      onClick={onClick}
    >
      <span className="rail__glyph" aria-hidden="true">{glyph}</span>
      <span className="rail__label">{label}</span>
    </button>
  );
  return (
    <nav className="rail" data-testid="rail">
      <img className="rail__logo" src={logoMark} alt="GnomeCode" />
      {ITEMS.map((one) =>
        item(one.glyph, one.label, page === one.page, () => onPage(one.page), `rail-${one.page}`),
      )}
      <div className="rail__actions-title">Быстрые действия</div>
      <button
        type="button"
        className="rail__item"
        data-testid="rail-new-chat"
        title="Новый чат"
        onClick={onNewChat}
      >
        <span className="rail__glyph" aria-hidden="true">➕</span>
        <span className="rail__label">Новый чат</span>
      </button>
    </nav>
  );
}
