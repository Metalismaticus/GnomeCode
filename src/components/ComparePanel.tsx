// Панель «Сравнение моделей» (docs/specs/2026-10-06-10-compare.md): таблица
// каталога opencode.ai поверх области чата — окно-оверлей по узору
// `ChatPluginsPanel`; главный жест один — «Выбрать» у строки меняет модель
// текущего чата. Поиск, дата данных и «Обновить» — вторично, поэтому тише.

import { useEffect, useRef, useState } from "react";

import type { CompareModel } from "../compare";
import { radarSeries, RADAR_AXES } from "../compare/radar";
import { contextOf, dateOf, featuresOf, priceOf, scoreOf } from "../compare";
import type { CompareState } from "../features/compare/useCompare";
import { RadarChart } from "./RadarChart";

import "./ComparePanel.css";
import "./RadarChart.css";

export type ComparePanelProps = {
  compare: CompareState;
  /** Модель текущего чата: её строка помечена «Выбрана» (по точному имени). */
  currentModel: string;
  /** Чьи модели: чат («Выбрать») или новые чаты по умолчанию
   *  («По умолчанию» из окна настроек — docs/specs/2026-10-06-12-nastrojki.md). */
  mode: "chat" | "default";
  /** Строка, уже раскрытая при открытии (снимок `сравнение-раскрыто`). */
  initialExpanded?: string | null;
  /** «Выбрать»/«По умолчанию»: модель меняется, панель закрывает себя. */
  onChoose: (model: CompareModel) => void;
  onClose: () => void;
};

const TITLE = "Сравнение моделей";
const TITLE_DEFAULT = "Выбор модели по умолчанию";
const SUBTITLE = "Цена за 1 млн токенов, контекст, бенчмарки. Источник: opencode.ai";
const SEARCH_PLACEHOLDER = "Поиск модели…";
const STALE_NOTE = "Сайт недоступен — данные от";
const EMPTY_SEARCH = "Ничего не нашлось";
const LOADING = "Читаю каталог моделей…";
const ERROR_TITLE = "Сайт opencode.ai недоступен";
const ERROR_HINT = "Данные ещё не загружались — нажмите «Обновить» позже";
const NO_BENCHMARKS = "Бенчмарков нет";
const ENGINE_SECTION = "Модели движка";

/** Панель поверх области чата: шапка с датой и «Обновить», поиск, таблица. */
export function ComparePanel({ compare, currentModel, mode, initialExpanded, onChoose, onClose }: ComparePanelProps) {
  const [expanded, setExpanded] = useState<string | null>(initialExpanded ?? null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Панель открывается — фокус сразу в поиск (спека «Клавиатура»); фокус
  // возвращает бейджу закрытие панели: ChatView делает это после снятия оверлея.
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const title = mode === "default" ? TITLE_DEFAULT : TITLE;
  // Модели движка (свои endpoint'ы, локальные серверы) идут после каталога
  // под своим заголовком: цены у них «—», поиск находит их вместе с каталогом.
  // Внутри каталога сначала доступные (правка владельца 15.10), потом нет —
  // сортировка устойчивая, порядок внутри групп прежний.
  const catalog = compare.models
    .filter((model) => !model.engine)
    .sort((a, b) => Number(b.available) - Number(a.available));
  const engine = compare.models.filter((model) => model.engine);
  /** База радара (усиление сравнения): ручной выбор (владелец 14.10, как в
   *  образце — ручной выбор); по умолчанию модель текущего чата, без неё —
   *  первая строка каталога. Раскрытая строка сравнивается с ней на радаре. */
  const [radarBaseId, setRadarBaseId] = useState<string | null>(null);
  const baseline =
    catalog.find((model) => model.id === radarBaseId) ??
    catalog.find((model) => model.name === currentModel) ??
    catalog[0];
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
    return (
      <>
        <RowList
          models={catalog}
          currentModel={currentModel}
          mode={mode}
          expanded={expanded}
          setExpanded={setExpanded}
          onChoose={onChoose}
          baseline={baseline}
          baseOptions={catalog}
          onBasePick={setRadarBaseId}
        />
        {engine.length ? (
          <>
            <div className="compare-panel__section" data-testid="compare-engine-section">
              {ENGINE_SECTION}
            </div>
            <RowList
              models={engine}
              currentModel={currentModel}
              mode={mode}
              expanded={expanded}
              setExpanded={setExpanded}
              onChoose={onChoose}
              baseline={baseline}
              baseOptions={catalog}
              onBasePick={setRadarBaseId}
            />
          </>
        ) : null}
      </>
    );
  })();

  return (
    <div className="compare-panel" data-testid="compare-panel" role="dialog" aria-label={title}>
      <Head compare={compare} mode={mode} onClose={onClose}  />
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

/** Строки одной части таблицы: каталог или секция движка — одно раскрытие на
 *  панель, «Выбрать» общим выбором. */
function RowList({
  models,
  currentModel,
  mode,
  expanded,
  setExpanded,
  onChoose,
  baseline,
  baseOptions,
  onBasePick,
}: {
  models: CompareModel[];
  currentModel: string;
  mode: "chat" | "default";
  expanded: string | null;
  setExpanded: (update: (open: string | null) => string | null) => void;
  onChoose: (model: CompareModel) => void;
  /** Модель-база радара: текущая или первая строка каталога. */
  baseline?: CompareModel;
  /** Выбор базы вручную (владелец 14.10, как в образце): список каталога. */
  baseOptions: CompareModel[];
  onBasePick: (id: string) => void;
}) {
  return (
    <>
      {models.map((model) => (
        <Row
          key={model.id}
          model={model}
          current={model.name === currentModel}
          mode={mode}
          expanded={expanded === model.id}
          onToggle={() => setExpanded((open) => (open === model.id ? null : model.id))}
          onChoose={() => onChoose(model)}
          baseline={baseline}
          baseOptions={baseOptions}
          onBasePick={onBasePick}
        />
      ))}
    </>
  );
}

/** Шапка панели: заголовок, дата снимка, пометка недоступного сайта, кнопки. */
function Head({ compare, mode, onClose }: { compare: CompareState; mode: "chat" | "default"; onClose: () => void }) {
  return (
    <div className="compare-panel__head">
      <div className="compare-panel__titles">
        <div className="compare-panel__title">{mode === "default" ? TITLE_DEFAULT : TITLE}</div>
        <div className="compare-panel__subtitle">{SUBTITLE}</div>
        {compare.fetchedAt ? (
          <div className="compare-panel__date" data-testid="compare-date">
            Обновлено {dateOf(compare.fetchedAt)}
          </div>
        ) : null}
        {compare.stale ? (
          <div className="compare-panel__note" data-testid="compare-note">
            {STALE_NOTE}  {dateOf(compare.fetchedAt)}
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
  mode,
  expanded,
  onToggle,
  onChoose,
  baseline,
  baseOptions,
  onBasePick,
}: {
  model: CompareModel;
  current: boolean;
  mode: "chat" | "default";
  expanded: boolean;
  onToggle: () => void;
  onChoose: () => void;
  baseline?: CompareModel;
  baseOptions: CompareModel[];
  onBasePick: (id: string) => void;
}) {
  const top = model.benchmarks[0];
  /** Строка — div с ролью button (XT-fix): внутри живёт кнопка «Выбрать», а
   *  button в button запрещён (React validateDOMNesting). Клавиатура —
   *  Enter/пробел, как у кнопки. */
  const rowKey = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };
  return (
    <div className={expanded ? "compare-line is-open" : "compare-line"}>
      <div
        className="compare-line__row"
        data-testid="compare-row"
        data-model={model.id}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        title={model.name}
        onClick={onToggle}
        onKeyDown={rowKey}
      >
        <span className="compare-line__name-block">
          <span className="compare-line__name">{model.name}</span>
          <span className="compare-line__lab">{model.lab}</span>
          {!model.available ? (
            <span className="compare-line__unavailable">Нет у провайдера</span>
          ) : null}
        </span>
        <span className="compare-line__num">{priceOf(model.input)}</span>
        <span className="compare-line__num">{priceOf(model.output)}</span>
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
            title={mode === "default" ? "Уже по умолчанию" : "Модель текущего чата"}
            disabled
          >
            {mode === "default" ? "Уже по умолчанию" : "Выбрана"}
          </button>
        ) : (
          <button
            type="button"
            className="compare-line__choose"
            data-testid="compare-choose"
            data-model={model.id}
            title={
              !model.available
                ? "Модель недоступна у вашего провайдера"
                : mode === "default"
                  ? "Сделать моделью для новых чатов"
                  : "Сделать моделью текущего чата"
            }
            disabled={!model.available}
            onClick={(event) => {
              event.stopPropagation();
              onChoose();
            }}
          >
            {mode === "default" ? "По умолчанию" : "Выбрать"}
          </button>
        )}
      </div>
      {expanded ? (
        <Expanded
          model={model}
          against={baseline}
          baseOptions={baseOptions}
          onBasePick={onBasePick}
        />
      ) : null}
    </div>
  );
}

/** Значения и флаги реальности одной серией — радару нужны отдельными массивами. */
function pointsOf(series: { name: string; points: { value: number; real: boolean }[] }): {
  values: number[];
  real: boolean[];
} {
  return {
    values: series.points.map((point) => point.value),
    real: series.points.map((point) => point.real),
  };
}

/** Раскрытие строки: радар пяти осей против модели-базы (усиление сравнения,
 *  как на opencode.ai/data/compare), описание, полный прайс, выпуск, признаки
 *  и бенчмарки. База выбирается комбобоксом с поиском по названию (по
 *  умолчанию — модель чата); радара нет, если база = эта же строка. */
function Expanded({
  model,
  against,
  baseOptions,
  onBasePick,
}: {
  model: CompareModel;
  against?: CompareModel;
  baseOptions: CompareModel[];
  onBasePick: (id: string) => void;
}) {
  const features = featuresOf(model);
  const comparable = against !== undefined && against.id !== model.id;
  /** Комбобокс базы: поиск по подстроке имени/id, выбор кликом из списка. */
  const [baseQuery, setBaseQuery] = useState("");
  const [baseOpen, setBaseOpen] = useState(false);
  const needle = baseQuery.trim().toLowerCase();
  const baseMatches = baseOptions.filter(
    (one) =>
      one.name.toLowerCase().includes(needle) || one.id.toLowerCase().includes(needle),
  );
  return (
    <div className="compare-details" data-testid="compare-details">
      {comparable ? (
        <div className="compare-details__radar" data-testid="compare-radar">
          <label className="compare-details__base">
            Сравнить с:
            <span className="compare-combo">
              <input
                className="compare-combo__input"
                data-testid="radar-base-search"
                type="text"
                placeholder={against.name}
                aria-label="Модель для сравнения — поиск по названию"
                value={baseQuery}
                onFocus={() => setBaseOpen(true)}
                onBlur={() => setBaseOpen(false)}
                onChange={(event) => {
                  setBaseQuery(event.target.value);
                  setBaseOpen(true);
                }}
              />
              {baseOpen ? (
                <div className="compare-combo__list" data-testid="radar-base-list">
                  {baseMatches.length ? (
                    baseMatches.slice(0, 30).map((one) => (
                      <button
                        type="button"
                        key={one.id}
                        className="compare-combo__option"
                        data-testid="radar-base-option"
                        // onMouseDown раньше blur: клик по варианту успевает выбрать.
                        onMouseDown={(event) => {
                          event.preventDefault();
                          onBasePick(one.id);
                          setBaseQuery("");
                          setBaseOpen(false);
                        }}
                      >
                        {one.name}
                      </button>
                    ))
                  ) : (
                    <div className="compare-combo__empty">Ничего не нашлось</div>
                  )}
                </div>
              ) : null}
            </span>
          </label>
          <RadarChart
            axes={[...RADAR_AXES]}
            series={[
              {
                name: `${against.name} — база`,
                color: "var(--text-dim, #888)",
                ...pointsOf(radarSeries(against, model)),
              },
              {
                name: model.name,
                color: "var(--accent, #7c5cff)",
                ...pointsOf(radarSeries(model, against)),
              },
            ]}
          />
        </div>
      ) : null}
      <div className="compare-details__description">{model.description}</div>
      <div className="compare-details__price">
        Цена за 1 млн: Ввод {priceOf(model.input)} · Вывод {priceOf(model.output)}
        {model.cacheRead !== null ? <> · Из кэша {priceOf(model.cacheRead)}</> : null}
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
