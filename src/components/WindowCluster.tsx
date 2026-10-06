import type { Theme } from "../viewparams";
import { ThemeSwitch } from "./ThemeSwitch";
import { WindowButtons } from "./WindowButtons";

import "./WindowCluster.css";

/** Кластер собственных кнопок окна в правом краю верхней полосы: переключатель
 *  темы и свернуть/развернуть/закрыть одной строкой (замечание владельца
 *  2026-10-06: «кнопки свернуть, тема и т.д. должны быть справа»). Живёт там,
 *  чья полоса стоит в правом краю окна: в шапке чата при узком окне (панель
 *  складывается) и в шапке правой панели при ширине от 1200 px. Сама полоса
 *  — зона перетаскивания; кнопки её не наследуют: у Tauri 2 перетаскивание
 *  ловит только элементы с data-tauri-drag-region, кнопка целиком — не оно. */
export function WindowCluster({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <div className="window-cluster" data-testid="window-cluster" data-tauri-drag-region>
      <ThemeSwitch theme={theme} onToggle={onToggleTheme} />
      <WindowButtons />
    </div>
  );
}
