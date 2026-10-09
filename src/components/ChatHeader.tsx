import type { ReactNode } from "react";
import type { Plugin } from "../bridge";
import { DEFAULT_MODEL } from "../appstate";
import { HeaderMenu } from "./HeaderMenu";

import "./ChatHeader.css";

export type ChatHeaderProps = {
  title: string;
  model?: string;
  /** Кластер кнопок окна (тема + свернуть/развернуть/закрыть): единственный дом —
   *  шапка чата на любой ширине (docs/specs/2026-10-09-2-тихий-хром.md, §4). */
  cluster?: ReactNode;
  /** Подключённые к чату плагины: их команды живут в меню «⋯». */
  plugins?: Plugin[];
  /** Движок не отвечает: команды меню выключены с причиной. */
  engineDown?: boolean;
  /** Правая панель открыта: пункт «Контекст проекта» показывает слово «открыта». */
  panelOpen?: boolean;
  /** Открыть/закрыть правую панель — пункт «Контекст проекта» меню «⋯». */
  onTogglePanel: () => void;
  /** Меню «⋯» открыто: рисуется HeaderMenu, кнопка держит aria-expanded. */
  moreOpen?: boolean;
  /** Клик по «⋯»: меню открывается, повторный клик закрывает. */
  onToggleMore: () => void;
  /** Клик по команде в меню: слой прав решает вопрос одобрения и запуск. */
  onRunCommand: (plugin: Plugin, command: Plugin["commands"][number]) => void;
  /** Пункт «Плагины этого чата»: панель-оверлей области чата. */
  onOpenPlugins: () => void;
  /** Пункт «Настройки» ведёт на ту же страницу, что шестерёнка сайдбара. */
  onOpenSettings: () => void;
  /** Клик по бейджу модели: панель «Сравнение моделей» открывается или закрывается. */
  onToggleCompare?: () => void;
  /** Панель сравнения открыта: бейдж нажат и держит нажатие. */
  compareOpen?: boolean;
};

/** Шапка-минимум («тихий хром», docs/specs/2026-10-09-2-тихий-хром.md, §4):
 *  название чата слева, справа бейдж модели, «⋯» и кластер кнопок окна. Ряда кнопок
 *  плагинов и кнопки ☰ больше нет — команды и панель переехали в меню «⋯» (§5–6);
 *  кластер окна здесь всегда — у правой панели своего кластера нет. */
export function ChatHeader({
  title,
  model = DEFAULT_MODEL,
  cluster,
  plugins = [],
  engineDown = false,
  panelOpen = false,
  onTogglePanel,
  moreOpen = false,
  onToggleMore,
  onRunCommand,
  onOpenPlugins,
  onOpenSettings,
  onToggleCompare,
  compareOpen = false,
}: ChatHeaderProps) {
  return (
    <header
      className="chat-header"
      data-testid="chat-header"
      data-tauri-drag-region
      title="Перетащить окно"
    >
      <span
        className="chat-header__title"
        data-testid="chat-title"
        title={title}
        data-tauri-drag-region
      >
        {title}
      </span>
      {/* Бейдж модели — действие: открывает панель сравнения, поэтому у
          него все шесть состояний кнопки, в обходе шапки он стоит первым
          (спека docs/specs/2026-10-06-10-compare.md, «Клавиатура»). */}
      <button
        type="button"
        className="chat-header__badge"
        data-testid="model-badge"
        title="Сравнить модели и выбрать для этого чата"
        aria-pressed={compareOpen}
        onClick={onToggleCompare}
      >
        {model}
      </button>
      <button
        type="button"
        className="chat-header__more"
        data-testid="header-more"
        title="Ещё"
        aria-label="Ещё"
        aria-expanded={moreOpen}
        onClick={onToggleMore}
      >
        ⋯
      </button>
      {moreOpen ? (
        <HeaderMenu
          plugins={plugins}
          engineDown={engineDown}
          panelOpen={panelOpen}
          onTogglePanel={onTogglePanel}
          onOpenPlugins={onOpenPlugins}
          onRunCommand={onRunCommand}
          onOpenSettings={onOpenSettings}
          onClose={onToggleMore}
        />
      ) : null}
      {cluster}
    </header>
  );
}
