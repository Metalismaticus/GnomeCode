// Приветственная сборка пустого чата (docs/specs/2026-10-10-5-приветственная.md):
// H1 с подзаголовком, шесть счётчиков — четыре из настоящего состояния и расход
// «за сегодня» из данных «Статистики» (useStats; без сводки — честный прочерк
// с причиной на карточке), герой-ввод слотом между счётчиками и сценариями —
// тот же композер крупным вариантом (ChatView создаёт его один раз, первый
// вопрос уводит вниз строкой), ровно 4 карточки сценариев и ряд моделей.
// Ряд без данных не рисуется вовсе; ноль счётчика — честный. Сборка стоит
// вверху прокручиваемой ленты.
import { useMemo, type ReactNode } from "react";

import { moneyOf } from "../compare";
import { knownModels, type KnownModel } from "../markdown";
import { useCompare } from "../features/compare/useCompare";
import type { PluginsState } from "../features/plugins/usePlugins";
import { tokensOf, useStats } from "../features/stats/useStats";
import { ChatGlyph, FolderGlyph, PuzzleGlyph, ScalesGlyph } from "./glyphs";

import "./EmptyChat.css";

const TITLE = "Добро пожаловать в GnomeCode";
const SUBTITLE = "Опишите задачу, приложите файл или выберите сценарий";
const MANAGE = "Управление моделями →";
const MODEL_OF_CHAT = "модель этого чата";
/** Подпись под рядом счётчиков: называет период «за сегодня» для обеих карточек
 *  расхода — короткие метки без периода влезают в карточку (спека §5/§13);
 *  стоит всегда, и при прочерке тоже — поясняет метрику, а не данные. */
const SPEND_NOTE = "Токены и деньги — за сегодня";
/** Причины прочерка расхода на самой карточке (спека приветствия §9). */
const SPEND_LOADING = "Считаю расход…";
const SPEND_BROKEN = "Статистика не читается";
const SPEND_NO_PRICES = "Цены моделей неизвестны — деньги не считаются";
/** Ряд моделей — текущая плюс известные, не весь каталог: приветствие не должно
 *  выкатывать сотни карточек за сгиб (замечание владельца 2026-10-06, живая копия). */
const MODEL_ROW_LIMIT = 8;

type WelcomeCounts = { chats: number; projects: number };

/** Сценарии: константа — действия реальные, те же, что кнопки шапки сайдбара.
 *  «Новый чат» ведёт себя как кнопка сайдбара: лента чистится, движку
 *  поднимается новая сессия (замечание владельца 2026-10-06). */
const SCENARIOS = [
  { key: "open-project", title: "Открыть проект", sub: "Выбрать папку с кодом", Glyph: FolderGlyph },
  { key: "new-chat", title: "Новый чат", sub: "Начать с чистого листа", Glyph: ChatGlyph },
  { key: "connect-plugin", title: "Подключить плагин", sub: "Каталог и права", Glyph: PuzzleGlyph },
  { key: "compare-models", title: "Сравнить модели", sub: "Выбрать для этого чата", Glyph: ScalesGlyph },
] as const;

export function EmptyChat({
  counts,
  plugins,
  model,
  hero,
  onOpenProject,
  onConnectPlugin,
  onCompare,
  onNewChat,
}: {
  counts: WelcomeCounts;
  plugins: PluginsState;
  model: string;
  /** Герой-ввод слотом: тот же композер крупным вариантом, стоит между
   *  счётчиками и сценариями (спека приветствия §3/§7). */
  hero?: ReactNode;
  /** Клик по карточке сценария: папка проекта, каталог плагинов, панель сравнения. */
  onOpenProject: () => void;
  onConnectPlugin: () => void;
  onCompare: () => void;
  /** Карточка «Новый чат»: тот же ход, что кнопка сайдбара. */
  onNewChat: () => void;
}) {
  const compare = useCompare(true);
  // Расход «за сегодня» — те же данные, что у раздела «Статистика» (спека §5):
  // сводку считает Rust, значения приходят с моста при каждом появлении сборки —
  // после разговора «Новый чат» показывает свежие числа.
  const { summary: spend, error: spendError } = useStats("today");
  /** Причина прочерка, пока сводки нет: «считаю» или «не читается» (§9). */
  const spendTitle = spend ? undefined : spendError ? SPEND_BROKEN : SPEND_LOADING;
  // Ряд моделей: сегодня известные за текущей не выходит за лимит — приветствие
  // отвечает за сводку, а не за весь каталог (замечание владельца 21:46).
  const models = useMemo(
    () => knownModels(model, compare.models).slice(0, MODEL_ROW_LIMIT),
    [model, compare.models],
  );
  // Счётчик «ПЛАГИНЫ» — реестр установленного: записи, которые владелец ставил
  // сам и которые не выключил. Выключенный плагин кнопок не даёт и в ряду
  // счётчика не считается — одно число с разделом «Плагины» (карточки).
  const usage = useMemo(
    () => plugins.plugins.reduce((sum, plugin) => sum + (plugin.usage?.count ?? 0), 0),
    [plugins.plugins],
  );
  const installed = useMemo(
    () => plugins.plugins.filter((plugin) => !plugin.disabled && plugin.uninstallable).length,
    [plugins.plugins],
  );
  const counters: { label: string; value: string; title?: string }[] = [
    { label: "ЧАТЫ", value: counts.chats.toLocaleString("ru-RU") },
    { label: "ПРОЕКТЫ", value: counts.projects.toLocaleString("ru-RU") },
    { label: "ПЛАГИНЫ", value: installed.toLocaleString("ru-RU") },
    { label: "ВЫЗОВЫ", value: usage.toLocaleString("ru-RU") },
    // Токены — по одной формуле с «Статистикой», деньги — тем же moneyOf:
    // числа сборки и раздела сходятся (спека §13). Данных нет — «—» у обеих;
    // цены неизвестны — «—» только у денег, токены показываются.
    { label: "ТОКЕНЫ", value: spend ? tokensOf(spend.totals) : "—", title: spendTitle },
    {
      label: "ДЕНЬГИ",
      value: spend ? moneyOf(spend.totals.cost) : "—",
      title: spend ? (spend.totals.cost === null ? SPEND_NO_PRICES : undefined) : spendTitle,
    },
  ];
  const actionOf = (key: (typeof SCENARIOS)[number]["key"]): (() => void) | undefined => {
    if (key === "open-project") {
      return onOpenProject;
    }
    if (key === "new-chat") {
      return onNewChat;
    }
    if (key === "connect-plugin") {
      return onConnectPlugin;
    }
    if (key === "compare-models") {
      return onCompare;
    }
    return undefined;
  };
  return (
    <div className="empty" data-testid="empty">
      <h1 className="empty__title" data-testid="empty-title">
        {TITLE}
      </h1>
      <div className="empty__subtitle">{SUBTITLE}</div>

      <div className="empty__spend">
        <div className="empty__row empty__row--counters">
          {counters.map((counter) => (
            <div
              className="welcome-card"
              key={counter.label}
              data-testid="welcome-counter"
              title={counter.title}
            >
              <span className="counter__value">{counter.value}</span>
              <span className="counter__label">{counter.label}</span>
            </div>
          ))}
        </div>
        <div className="empty__spend-note" data-testid="welcome-spend-note">
          {SPEND_NOTE}
        </div>
      </div>

      {hero ? (
        <div className="empty__composer" data-testid="welcome-composer">
          {hero}
        </div>
      ) : null}

      <div className="empty__row empty__row--scenarios" data-testid="welcome-scenarios">
        {SCENARIOS.map((scenario) => (
          <button
            key={scenario.key}
            type="button"
            className="welcome-scenario"
            data-testid="welcome-scenario"
            title={scenario.title}
            onClick={actionOf(scenario.key)}
          >
            <scenario.Glyph className="welcome-scenario__glyph" />
            <span className="welcome-scenario__text">
              <span className="welcome-scenario__title">{scenario.title}</span>
              <span className="welcome-scenario__sub">{scenario.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {models.length ? <ModelRow models={models} onCompare={onCompare} /> : null}
    </div>
  );
}

/** Ряд моделей каталога и «Управление моделями» под ним: шаг сборки, а не своя
 *  логика — модели считаны в EmptyChat (useCompare/knownModels). */
function ModelRow({ models, onCompare }: { models: KnownModel[]; onCompare: () => void }) {
  return (
    <>
      <div className="empty__row" data-testid="welcome-models">
        {models.map((known, index) => (
          <div className="welcome-card" key={`${known.name}-${index}`} data-testid="welcome-model">
            <span className="welcome-card__name">{known.name}</span>
            <span className="welcome-card__sub">{known.lab || MODEL_OF_CHAT}</span>
          </div>
        ))}
      </div>
      <button type="button" className="empty__manage" data-testid="welcome-manage" onClick={onCompare}>
        {MANAGE}
      </button>
    </>
  );
}
