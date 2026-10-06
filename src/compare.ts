// Данные каталога моделей (панель «Сравнение моделей»): та же форма, что отдаёт
// `compare_list` (src-tauri/src/compare.rs — ADR-0001: интерфейс знает свои типы,
// а не JSON источника). Здесь же единственный форматтер чисел и даты: цены,
// контекст и оценка в таблице и в раскрытии выглядят одинаково (спека, «Формат»).

/** Бенчмарк модели: имя, число и метрика сайта. */
export type CompareBenchmark = { name: string; score: number; metric: string };

/** Строка каталога: то, что показывает таблица и раскрытие строки. */
export type CompareModel = {
  /** Идентификатор `лаборатория/модель` — им модель уходит движку. */
  id: string;
  /** Лаба модели — подпись под именем. */
  lab: string;
  name: string;
  description: string;
  context: number;
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  releaseDate: string | null;
  reasoning: boolean;
  toolCall: boolean;
  openWeights: boolean;
  imageOutput: boolean;
  benchmarks: CompareBenchmark[];
  /** Нет у провайдера: «Выбрать» выключена, строка помечена. */
  available: boolean;
};

/** Каталог с датой загрузки: «Обновлено …» и пометка «данные от <дата>». */
export type CompareSnapshot = {
  fetchedAt: number;
  models: CompareModel[];
  /** Таблица читалась из кэша — сайт не ответил. */
  stale: boolean;
};

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Дата в «Обновлено 6 окт, 07:38»: день, месяц кратко и чч:мм — один формат. */
export function dateOf(fetchedAt: number): string {
  const date = new Date(fetchedAt);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${time}`;
}

/** Цена за 1 млн токенов: два знака; меньше цента — четыре (`$0.0040`). */
export function moneyOf(price: number | null): string {
  if (price === null) {
    return "—";
  }
  if (price > 0 && price < 0.01) {
    return `$${price.toFixed(4)}`;
  }
  return `$${price.toFixed(2)}`;
}

/** Контекст: K и M, как показывает сайт (`1M`, `256K`, `8K`). */
export function contextOf(tokens: number): string {
  if (tokens <= 0) {
    return "—";
  }
  if (tokens >= 1_000_000) {
    return `${Math.round(tokens / 1_000_000)}M`;
  }
  return `${Math.round(tokens / 1_000)}K`;
}

/** Оценка одного бенчмарка: проценты или рейтинг Elo (`1844 Elo`). */
export function scoreOf(benchmark: CompareBenchmark): string {
  return benchmark.metric.toLowerCase() === "elo" ? `${benchmark.score} Elo` : `${benchmark.score.toFixed(1)}%`;
}

/** Признаки модели в раскрытии: только наличные, английским — как Install. */
export function featuresOf(model: CompareModel): string[] {
  const features: string[] = [];
  if (model.reasoning) {
    features.push("Reasoning");
  }
  if (model.toolCall) {
    features.push("Tool call");
  }
  if (model.openWeights) {
    features.push("Open weights");
  }
  return features;
}
