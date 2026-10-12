import type { Theme } from "../viewparams";

import "./ThemeSwitch.css";

/** Переключатель темы: одна кнопка в шапке чата и в подвале сайдбара.
 *  Тема живёт на `<html data-theme>` — переключение меняет всё окно целиком. */
export function ThemeSwitch({
  theme,
  onToggle,
  testid = "theme-switch",
}: {
  theme: Theme;
  onToggle: () => void;
  testid?: string;
}) {
  return (
    <button
      type="button"
      className="theme-switch"
      data-testid={testid}
      onClick={onToggle}
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
    >
      {theme === "dark" ? "☀ Светлая" : "☾ Тёмная"}
    </button>
  );
}