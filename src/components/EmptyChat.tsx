// Приветственная сборка пустого чата (docs/specs/2026-10-06-11-glavnoe.md, §3/§5):
// H1 с подзаголовком, ряд счётчиков из настоящих данных, ряды провайдеров и моделей
// из каталога, который продукт знает, и ровно 4 карточки сценариев. Ряд без данных
// не рисуется вовсе; ноль счётчика — честный. Сборка стоит вверху прокручиваемой
// ленты; композер — не часть сборки и не едет.
import { useMemo } from "react";

import { knownModels, type KnownModel } from "../markdown";
import { useCompare } from "../features/compare/useCompare";
import type { PluginsState } from "../features/plugins/usePlugins";
import { ChatGlyph, FolderGlyph, PuzzleGlyph, ScalesGlyph } from "./glyphs";

import "./EmptyChat.css";

const TITLE = "Добро пожаловать в GnomeCode";
const SUBTITLE = "Опишите задачу, приложите файл или выберите сценарий";
const MANAGE = "Управление моделями →";
const MODEL_OF_CHAT = "модель этого чата";
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
  onOpenProject,
  onConnectPlugin,
  onCompare,
  onNewChat,
}: {
  counts: WelcomeCounts;
  plugins: PluginsState;
  model: string;
  /** Клик по карточке сценария: папка проекта, каталог плагинов, панель сравнения. */
  onOpenProject: () => void;
  onConnectPlugin: () => void;
  onCompare: () => void;
  /** Карточка «Новый чат»: тот же ход, что кнопка сайдбара. */
  onNewChat: () => void;
}) {
  const compare = useCompare(true);
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
  const counters: { label: string; value: number }[] = [
    { label: "ЧАТЫ", value: counts.chats },
    { label: "ПРОЕКТЫ", value: counts.projects },
    { label: "ПЛАГИНЫ", value: installed },
    { label: "ВЫЗОВЫ", value: usage },
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
  };  return (
    <div className="empty" data-testid="empty">
      <h1 className="empty__title" data-testid="empty-title">
        {TITLE}
      </h1>
      <div className="empty__subtitle">{SUBTITLE}</div>

      <div className="empty__row">
        {counters.map((counter) => (
          <div className="welcome-card" key={counter.label} data-testid="welcome-counter">
            <span className="counter__value">{counter.value.toLocaleString("ru-RU")}</span>
            <span className="counter__label">{counter.label}</span>
          </div>
        ))}
      </div>

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
