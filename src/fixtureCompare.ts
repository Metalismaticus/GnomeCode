// Каталог моделей вне окна Tauri: те же записи, что отдаёт `compare_list`
// (src-tauri/src/compare.rs), и те же состояния экрана — свежий каталог,
// загрузка, недоступный сайт без кэша, таблица из кэша. На странице данные —
// память фикстуры, сеть не трогается (docs/TESTING.md, «Данные пользователя»).
//
// Записи — из «Настоящих данных» спецификации (2026-10-06): текущая модель
// окна, Claude Sonnet 5.5, North Mini Code, DeepSeek V4.1 Flash (Elo, пометка
// «Нет у провайдера»), Qwen-Image-2.1 (без бенчмарков) и модель с длинным
// именем — сценарий и снимки видят тот же каталог, что владелец.
//
// Состояния адреса (src/viewparams.ts): `сравнение-загрузка` — запрос висит;
// `сравнение-ошибка` — сайт не отвечает, кэша нет; `сравнение-кэш` — таблица
// со снимка, у которого прошлая дата и помечена недоступность сайта.
import type { CompareModel, CompareSnapshot } from "./compare";
import { params } from "./viewparams";

const BENCH = (name: string, score: number, metric: string) => ({ name, score, metric });

const GLM: CompareModel = {
  id: "zhipuai/glm-5.3-flash",
  lab: "zhipuai",
  name: "GLM-5.3 High",
  description: "Быстрая модель Zhipu для повседневных задач — модель текущего чата",
  context: 202_048,
  input: 0.14,
  output: 0.56,
  cacheRead: 0.02,
  releaseDate: "2026-08-12",
  reasoning: true,
  toolCall: true,
  openWeights: false,
  imageOutput: false,
  benchmarks: [
    BENCH("Terminal-Bench", 59.4, "score"),
    BENCH("SWE-Bench Verified", 62.1, "resolved"),
  ],
  available: true,
};

const CLAUDE: CompareModel = {
  id: "anthropic/claude-sonnet-5-5",
  lab: "anthropic",
  name: "Claude Sonnet 5.5",
  description: "Fast Claude model for everyday coding, agents, and knowledge work",
  context: 1_000_000,
  input: 2.0,
  output: 10.0,
  cacheRead: 0.2,
  releaseDate: "2026-09-28",
  reasoning: true,
  toolCall: true,
  openWeights: false,
  imageOutput: false,
  benchmarks: [
    BENCH("Terminal-Bench", 70.6, "score"),
    BENCH("FrontierCode", 46.2, "score"),
    BENCH("CursorBench", 55.5, "score"),
    BENCH("GDPval-AA", 1844, "Elo"),
    BENCH("Humanity's Last Exam", 64.5, "score"),
    BENCH("OSWorld", 80.1, "score"),
  ],
  available: true,
};

const NORTH: CompareModel = {
  id: "cohere/north-mini-code-1-0",
  lab: "cohere",
  name: "North Mini Code",
  description: "Cohere coding model for practical software engineering and agentic edits",
  context: 256_000,
  input: 0.0,
  output: 0.0,
  cacheRead: null,
  releaseDate: "2026-06-09",
  reasoning: true,
  toolCall: true,
  openWeights: true,
  imageOutput: false,
  benchmarks: [
    BENCH("SWE-Bench Verified", 67.6, "resolved"),
    BENCH("SWE-Bench Pro", 40.2, "score"),
    BENCH("Artificial Analysis Intelligence Index", 27.6, "score"),
  ],
  available: true,
};

const DEEPSEEK: CompareModel = {
  id: "deepseek/deepseek-v4-1-flash",
  lab: "deepseek",
  name: "DeepSeek V4.1 Flash",
  description: "Reasoning model of DeepSeek with fast high-volume lane",
  context: 128_000,
  input: 0.7,
  output: 2.8,
  cacheRead: 0.07,
  releaseDate: "2026-05-20",
  reasoning: true,
  toolCall: true,
  openWeights: true,
  imageOutput: false,
  benchmarks: [
    BENCH("GDPval-AA", 1637, "Elo"),
    BENCH("Humanity's Last Exam", 24.8, "score"),
  ],
  // Провайдер лабы не подключён к движку — «Нет у провайдера» (спека, состояния).
  available: false,
};

const QWEN: CompareModel = {
  id: "alibaba/qwen-image-2.1",
  lab: "alibaba",
  name: "Qwen-Image-2.1",
  description: "Unified text-to-image generation and image editing model",
  context: 8_192,
  input: 0.0,
  output: 0.0,
  cacheRead: null,
  releaseDate: "2026-09-14",
  reasoning: false,
  toolCall: false,
  openWeights: true,
  imageOutput: true,
  benchmarks: [],
  available: true,
};

const LONG: CompareModel = {
  id: "baai/emergence-72b-a6b-instruct-2607-preview",
  lab: "baai",
  name: "Emergence-72B-A6B-Instruct-2607-Preview",
  description: "Open hybrid model whose long name truncates with ellipsis, not overflow",
  context: 131_072,
  input: 0.0040,
  output: 0.0160,
  cacheRead: 0.0010,
  releaseDate: "2026-07-26",
  reasoning: true,
  toolCall: false,
  openWeights: true,
  imageOutput: false,
  benchmarks: [BENCH("CursorBench", 38.9, "score")],
  available: true,
};

const MODELS: CompareModel[] = [GLM, CLAUDE, NORTH, DEEPSEEK, QWEN, LONG];

/** Дата кэш-состояния: «Обновлено 6 окт, 07:38» из таблицы спецификации. */
const CACHED_AT = new Date(2026, 9, 6, 7, 38).getTime();

/** Каталог по состоянию страницы: свежий, из кэша, загрузка или ошибка сети. */
export function list(): Promise<CompareSnapshot> {
  if (params.feed === "сравнение-загрузка") {
    // Сеть отвечает дольше сценария: строка ожидания держится, «Обновить» выключена.
    return new Promise<CompareSnapshot>(() => {});
  }
  if (params.feed === "сравнение-ошибка") {
    return Promise.reject(new Error("opencode.ai не отвечает"));
  }
  if (params.feed === "сравнение-кэш") {
    return Promise.resolve({
      fetchedAt: CACHED_AT,
      models: MODELS.map((one) => ({ ...one, benchmarks: [...one.benchmarks] })),
      stale: true,
    });
  }
  return Promise.resolve({
    fetchedAt: new Date(2026, 9, 6, 11, 24).getTime(),
    models: MODELS.map((one) => ({ ...one, benchmarks: [...one.benchmarks] })),
    stale: false,
  });
}
