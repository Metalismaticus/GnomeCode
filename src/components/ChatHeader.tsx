import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject, ReactNode } from "react";
import type { Plugin } from "../bridge";
import { DEFAULT_MODEL } from "../appstate";
import { PluginButton } from "./PluginButton";

import "./ChatHeader.css";

export type ChatHeaderProps = {
  title: string;
  onTogglePanel: () => void;
  panelOpen?: boolean;
  model?: string;
  /** Кластер кнопок окна (тема + свернуть/развернуть/закрыть): приходит извне,
   *  потому что живёт в правом краю окна — в шапке чата только при узком окне,
   *  когда правая панель складывается (WindowCluster.tsx). */
  cluster?: ReactNode;
  /** Подключённые к чату плагины: одна кнопка на команду, рядом с бейджем. */
  plugins?: Plugin[];
  /** Клик по кнопке команды: слой прав решает вопрос одобрения и запуск. */
  onRunCommand: (plugin: Plugin, command: Plugin["commands"][number]) => void;
  /** Клик по области бейджей (не по кнопке команды): панель «Plugins in this chat». */
  onOpenPlugins?: () => void;
  /** Клик по бейджу модели: панель «Сравнение моделей» открывается или закрывается. */
  onToggleCompare?: () => void;
  /** Панель сравнения открыта: бейдж нажат и держит нажатие. */
  compareOpen?: boolean;
};

/** Зазор ряда кнопок — --space-2 (ChatHeader.css); для замера помещаемости он
 *  нужен числом, CSS-переменную здесь не прочитать. */
const ROW_GAP = 8;

/** Замер помещаемости ряда кнопок: сколько кнопок помещается рядом с бейджем «+N»;
 *  null — помещаются все. Ширины кнопок снимаются с DOM, пока ряд показан целиком
 *  (новый список — показ целиком и замер заново), и живут в ref: свёрнутый хвост
 *  мерить нечего. Ширина бейджа известна заранее — проба стоит в DOM всегда. */
function useFittingCount(areaRef: MutableRefObject<HTMLSpanElement | null>, plugins: Plugin[]) {
  const widthsRef = useRef<number[]>([]);
  /** Сколько кнопок показывать; null — ряд помещается целиком. */
  const [limit, setLimit] = useState<number | null>(null);

  /** Разложить ряд: не поместившиеся кнопки уходят в «+N», кнопка не режется.
   *  Место ряда считается от шапки, а не от ширины самого ряда: ряд сжимается
   *  вместе со своим содержимым, и замер по его текущей ширине сваливается
   *  в «+N» навсегда (петля сжатия). Заголовок в счёт не идёт — он умеет
   *  сжиматься до нуля (min-width: 0) и уступает место ряду. */
  const reflow = useCallback(() => {
    const area = areaRef.current;
    const widths = widthsRef.current;
    const header = area?.parentElement ?? null;
    if (!area || !header || !widths.length) {
      return;
    }
    const badge = area.querySelector<HTMLElement>(".chat-header__more");
    const badgeWidth = badge ? badge.offsetWidth + ROW_GAP : 0;
    let fixed = 0;
    for (const child of Array.from(header.children)) {
      if (child !== area && !child.classList.contains("chat-header__title")) {
        fixed += (child as HTMLElement).offsetWidth;
      }
    }
    const headerStyle = getComputedStyle(header);
    const headerGap = parseFloat(headerStyle.columnGap || "0") || 0;
    const cap = header.clientWidth * 0.5; // max-width: 50% ряда (ChatHeader.css)
    const free = header.clientWidth - fixed - headerGap * (header.children.length - 1);
    const available = Math.min(cap, free);
    const total = widths.reduce((sum, width) => sum + width, 0) + ROW_GAP * (widths.length - 1);
    if (total <= available) {
      setLimit(null);
      return;
    }
    let taken = 0;
    let count = 0;
    for (const width of widths) {
      const next = count === 0 ? width : taken + ROW_GAP + width;
      if (next + ROW_GAP + badgeWidth > available) {
        break;
      }
      taken = next;
      count += 1;
    }
    setLimit(count);
  }, []);

  // Новый список плагинов: ряд показывается целиком — прежние ширины сняты со
  // старого списка, мерить по ним нельзя. Следом замер снят заново.
  useLayoutEffect(() => {
    setLimit(null);
  }, [plugins]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) {
      return;
    }
    // Пока свёртывания нет, весь ряд на месте — самое время снять ширины кнопок.
    if (limit === null) {
      widthsRef.current = Array.from(area.querySelectorAll<HTMLElement>(".plugin-button")).map(
        (button) => button.offsetWidth,
      );
    }
    reflow();
  }, [plugins, limit, reflow]);

  useLayoutEffect(() => {
    const area = areaRef.current;
    const header = area?.parentElement ?? null;
    if (!header || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => reflow());
    observer.observe(header);
    return () => observer.disconnect();
  }, [reflow]);

  return limit;
}

/** Бейдж «+N» переполнения ряда и его проба замера. Клик открывает ту же панель
 *  «Плагины этого чата», что и клик по области: всплытие переключило бы её
 *  дважды и вернуло бы на место. Пока переполнения нет, в DOM стоит невидимая
 *  проба с шириной самого длинного бейджа («+все») — ряд заранее знает, сколько
 *  места оставить «+N». */
function MoreBadge({ overflow, total, onOpen }: { overflow: number; total: number; onOpen?: () => void }) {
  if (!overflow) {
    return (
      <button
        type="button"
        className="chat-header__more chat-header__more--idle"
        tabIndex={-1}
        aria-hidden="true"
      >
        +{total}
      </button>
    );
  }
  return (
    <button
      type="button"
      className="chat-header__more"
      data-testid="header-plugins-more"
      title="Плагины этого чата"
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
    >
      +{overflow}
    </button>
  );
}

/** Область бейджей в шапке: кнопки команд подключённых плагинов; клик мимо
 *  кнопки команды — панель «Plugins in this chat» (docs/SPEC/plugins.md, сцена D).
 *  Ряд не режет кнопку краем: пока кнопки помещаются — видны все; первая
 *  непомещающаяся и хвост сворачиваются в бейдж «+N» (решение владельца
 *  2026-10-04 «компактно, при переполнении +N»), клик по нему — та же панель. */
function PluginsArea({
  plugins,
  onRunCommand,
  onOpenPlugins,
}: {
  plugins: Plugin[];
  onRunCommand: ChatHeaderProps["onRunCommand"];
  onOpenPlugins?: () => void;
}) {
  const areaRef = useRef<HTMLSpanElement | null>(null);
  const limit = useFittingCount(areaRef, plugins);
  const buttons = plugins.flatMap((plugin) =>
    plugin.commands.map((command) => (
      <PluginButton
        key={command.name}
        plugin={plugin}
        command={command}
        onRun={onRunCommand}
      />
    )),
  );
  const shown = limit === null ? buttons : buttons.slice(0, limit);
  return (
    <span
      ref={areaRef}
      className="chat-header__plugins"
      data-testid="header-plugins-area"
      role="button"
      tabIndex={0}
      title="Плагины этого чата"
      onClick={onOpenPlugins}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onOpenPlugins?.();
        }
      }}
    >
      {shown}
      {buttons.length ? (
        <MoreBadge overflow={buttons.length - shown.length} total={buttons.length} onOpen={onOpenPlugins} />
      ) : null}
    </span>
  );
}

/** Шапка чата: название слева, бейдж модели и подключённые плагины справа.
 *  Кнопка `☰` рисуется только при ширине < 1200 px — при ней правая панель
 *  складывается (docs/DESIGN.md, раздел 5); вместе с ней в шапке остаётся и
 *  кластер кнопок окна: при широкой панели он живёт в её шапке (правый край
 *  окна), при узкой — возвращается сюда. */
export function ChatHeader({
  title,
  onTogglePanel,
  panelOpen = false,
  model = DEFAULT_MODEL,
  cluster,
  plugins = [],
  onRunCommand,
  onOpenPlugins,
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
      {/* Бейдж модели — теперь действие: открывает панель сравнения, поэтому у
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
      <PluginsArea plugins={plugins} onRunCommand={onRunCommand} onOpenPlugins={onOpenPlugins} />
      <button
        type="button"
        className="chat-header__panel"
        data-testid="panel-toggle"
        title="Контекст проекта"
        aria-pressed={panelOpen}
        onClick={onTogglePanel}
      >
        ☰
      </button>
      {cluster}
    </header>
  );
}
