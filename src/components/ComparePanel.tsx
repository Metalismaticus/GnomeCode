// Панель «Сравнение моделей» (docs/specs/2026-10-06-10-compare.md): таблица
// каталога opencode.ai поверх области чата — окно-оверлей по узору
// `ChatPluginsPanel`; главный жест один — «Выбрать» у строки меняет модель
// текущего чата. Поиск, дата данных и «Обновить» — вторично, поэтому тише.

import { useEffect, useRef, useState } from "react";

import type { CompareModel } from "../compare";
import { contextOf, dateOf, featuresOf, moneyOf, scoreOf } from "../compare";
import type { CompareState } from "../features/compare/useCompare";

import "./ComparePanel.css";

export type ComparePanelProps = {
  compare: CompareState;
  /** Модель текущего чата: её строка помечена «Выбрана» (по точному имени). */
  currentModel: string;
  /** Строка, уже раскрытая при открытии (снимок `сравнение-раскрыто`). */
  initialExpanded?: string | null;
  /** «Выбрать»: модель меняется, панель закрывает себя. */
  onChoose: (model: CompareModel) => void;
  onClose: () => void;
};

const TITLE = "Сравнение моделей";
const SUBTITLE = "Цена за 1 млн токенов, контекст, бенчмарки. Источник: opencode.ai";
const SEARCH_PLACEHOLDER = "Поиск модели…";
const STALE_NOTE = "Сайт недоступен — данные от";
const EMPTY_SEARCH = "Ничего не нашлось";
const LOADING = "Читаю каталог моделей…";
const ERROR_TITLE = "Сайт opencode.ai недоступен";
const ERROR_HINT = "Данные ещё не загружались — нажмите «Обновить» позже";
const NO_BENCHMARKS = "Бенчмарков нет";

/** Панель поверх области чата: шапка с датой и «Обновить», поиск, таблица. */
export function ComparePanel({ compare, currentModel, initialExpanded, onChoose, onClose }: ComparePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(initialExpanded ?? null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Панель открывается — фокус сразу в поиск (спека «Клавиатура»); фокус
  // возвращает бейджу закрытие панели: ChatView делает это после снятия оверлея.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const body = (() => {
    if (compare.error) {
      return (
        <div className="compare-panel__message" data-testid="compare-error">
          <div className="compare-panel__error">{ERROR_TITLE}</div>
          <div className="compare-panel__hint">{ERROR_HINT}</div>
        </div>
      );
    }
    if (compare.loading && !compare.models.length) {
      return <div className="compare-panel__message">{LOADING}</div>;
    }
    if (!compare.models.length) {
      return <div className="compare-panel__message">{EMPTY_SEARCH}</div>;
    }
    return compare.models.map((model) => (
      <Row
        key={model.id}
        model={model}
        current={model.name === currentModel}
        expanded={expanded === model.id}
        onToggle={() => setExpanded((open) => (open === model.id ? null : model.id))}
        onChoose={() => onChoose(model)}
      />
    ));
  })();

  return (
    <div className="compare-panel" data-testid="compare-panel" role="dialog" aria-label={TITLE}>
      <Head compare={compare} onClose={onClose} />
      <input
        ref={searchRef}
        className="compare-panel__search"
        data-testid="compare-search"
        type="search"
        placeholder={SEARCH_PLACEHOLDER}
        value={compare.query}
        onChange={(event) => compare.search(event.target.value)}
      />
      <Columns />
      <div className="compare-panel__list">{body}</div>
    </div>
  );
}

/** Шапка панели: заголовок, дата снимка, пометка недоступного сайта, кнопки. */
function Head({ compare, onClose }: { compare: CompareState; onClose: () => void }) {
  return (
    <div className="compare-panel__head">
      <div className="compare-panel__titles">
        <div className="compare-panel__title">{TITLE}</div>
        <div className="compare-panel__subtitle">{SUBTITLE}</div>
        {compare.fetchedAt ? (
          <div className="compare-panel__date" data-testid="compare-date">
            Обновлено {dateOf(compare.fetchedAt)}
          </div>
        ) : null}
        {compare.stale ? (
          <div className="compare-panel__note" data-testid="compare-note">
            {STALE_NOTE} {dateOf(compare.fetchedAt)}
          </div>
        ) : null}
      </div>
      <div className="compare-panel__actions">
        <button
          type="button"
          className="compare-panel__refresh"
          data-testid="compare-refresh"
          title={compare.loading ? "Уже обновляется…" : "Заново прочитать данные с opencode.ai"}
          disabled={compare.loading}
          onClick={compare.refresh}
        >
          Обновить
        </button>
        <button
          type="button"
          className="compare-panel__close"
          data-testid="compare-close"
          title="Закрыть сравнение"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/** Строка заголовков столбцов таблицы. */
function Columns() {
  return (
    <div className="compare-panel__cols">
      <span className="compare-panel__col compare-panel__col--name">Модель</span>
      <span className="compare-panel__col compare-panel__col--num" title="Цена за 1 млн токенов">
        Ввод
      </span>
      <span className="compare-panel__col compare-panel__col--num" title="Цена за 1 млн токенов">
        Вывод
      </span>
      <span className="compare-panel__col compare-panel__col--num">Контекст</span>
      <span className="compare-panel__col compare-panel__col--score" title="Первый бенчмарк каталога">
        Оценка
      </span>
      <span className="compare-panel__col compare-panel__col--choose" />
    </div>
  );
}

/** Недоступная модель в строке ведёт себя как любая другая: клик по строке
 *  разворачивает подробности, но «Выбрать» сделать нельзя — кнопка выключена
 *  с причиной в `title` (спека, состояние «Модель недоступна у провайдера»). */
function Row({
  model,
  current,
  expanded,
  onToggle,
  onChoose,
}: {
  model: CompareModel;
  current: boolean;
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
}) {
  const top = model.benchmarks[0];
  return (
    <div className={expanded ? "compare-line is-open" : "compare-line"}>
      <button
        type="button"
        className="compare-line__row"
        data-testid="compare-row"
        data-model={model.id}
        aria-expanded={expanded}
        title={model.name}
        onClick={onToggle}
      >
        <span className="compare-line__name-block">
          <span className="compare-line__name">{model.name}</span>
          <span className="compare-line__lab">{model.lab}</span>
          {!model.available ? (
            <span className="compare-line__unavailable">Нет у провайдера</span>
          ) : null}
        </span>
        <span className="compare-line__num">{moneyOf(model.input)}</span>
        <span className="compare-line__num">{moneyOf(model.output)}</span>
        <span className="compare-line__num">{contextOf(model.context)}</span>
        <span className="compare-line__score">
          {top ? (
            <span className="compare-line__score-block">
              <span className="compare-line__score-num">{scoreOf(top)}</span>
              <span className="compare-line__score-name">{top.name}</span>
            </span>
          ) : (
            "—"
          )}
        </span>
        {current ? (
          <button
            type="button"
            className="compare-line__choose"
            data-testid="compare-choose"
            data-model={model.id}
            title="Модель текущего чата"
            disabled
          >
            Выбрана
          </button>
        ) : (
          <button
            type="button"
            className="compare-line__choose"
            data-testid="compare-choose"
            data-model={model.id}
            title={model.available ? "Сделать моделью текущего чата" : "Модель недоступна у вашего провайдера"}
            disabled={!model.available}
            onClick={(event) => {
              event.stopPropagation();
              onChoose();
            }}
          >
            Выбрать
          </button>
        )}
      </button>
      {expanded ? <Expanded model={model} /> : null}
    </div>
  );
}

/** Раскрытие строки: описание, полный прайс, выпуск, признаки и бенчмарки. */
function Expanded({ model }: { model: CompareModel }) {
  const features = featuresOf(model);
  return (
    <div className="compare-details" data-testid="compare-details">
      <div className="compare-details__description">{model.description}</div>
      <div className="compare-details__price">
        Цена за 1 млн: Ввод {moneyOf(model.input)} · Вывод {moneyOf(model.output)}
        {model.cacheRead !== null ? <> · Из кэша {moneyOf(model.cacheRead)}</> : null}
      </div>
      <div className="compare-details__line">{model.releaseDate ? `Выпущена ${model.releaseDate}` : null}{model.releaseDate && features.length ? " · " : ""}{features.join(" · ")}</div>
      <div className="compare-details__benchmarks">
        {model.benchmarks.length
          ? model.benchmarks.map((benchmark) => (
              <div
                className="compare-details__benchmark"
                key={`${benchmark.name}-${benchmark.score}`}
              >
                <span className="compare-details__benchmark-name">{benchmark.name}</span>
                <span className="compare-details__benchmark-score">{scoreOf(benchmark)}</span>
              </div>
            ))
          : <div className="compare-details__benchmark">{NO_BENCHMARKS}</div>}
      </div>
    </div>
  );
}
