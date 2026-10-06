// Хранилище страницы вне окна Tauri («Один полный цикл»): зеркало `state.rs`, верное
// для продуктовых правил, но не по форме (docs/TESTING.md, «Данные пользователя» —
// проверка не обязана повторять файл). В окне Tauri эту работу делает Rust;
// странице localStorage жизненно нужен «перезапуск приложения» сценария:
// `page.reload()` в том же браузерном контексте localStorage сохраняет, свежий
// chromium — нет, поэтому только reload честно имитирует рестарт.
//
// Наполняют его те же действия, что и состояние окна: отвечают фикстурный мост и
// App (`src/App.tsx`), читают `appstate.ts` и страница при загрузке.
export type FixtureState = {
  /** Титул активного чата: первый вопрос владельца. */
  chatTitle: string;
  /** Папка проекта, если выбрана. */
  project: string;
  /** Тема, если владелец переключал. */
  theme: string;
  /** Пины плагинов: порядок списка — как пиновал. */
  pluginFavorites: string[];
  /** Недавние подключения плагинов: порядок — как подключали. */
  pluginRecent: string[];
  /** Модель текущего чата: выбор панели сравнения (имя + идентификатор). */
  chatModel: { name: string; id: string } | null;
  /** Модель по умолчанию для новых чатов: выбор настроек (имя + идентификатор). */
  defaultModel: { name: string; id: string } | null;
  /** Время начала текущего чата: группы дат сайдбара строятся по нему. */
  chatTime: number | null;
};

const KEY = "gnomecode-fixture-state";

/** Список id плагинов из зеркала: массив строк — иначе пусто (файл могли портить). */
const pluginIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : [];

/** Модель чата из зеркала: пара имя+идентификатор — иначе нет выбора. */
const chatModelOf = (value: unknown): { name: string; id: string } | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const held = value as Record<string, unknown>;
    if (typeof held.name === "string" && typeof held.id === "string") {
      return { name: held.name, id: held.id };
    }
  }
  return null;
};

export function readFixtureState(): FixtureState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const state: unknown = JSON.parse(raw);
      if (state && typeof state === "object") {
        const held = state as Record<string, unknown>;
        return {
          chatTitle: typeof held.chatTitle === "string" ? held.chatTitle : "",
          project: typeof held.project === "string" ? held.project : "",
          theme: typeof held.theme === "string" ? held.theme : "",
          pluginFavorites: pluginIds(held.pluginFavorites),
          pluginRecent: pluginIds(held.pluginRecent),
          chatModel: chatModelOf(held.chatModel),
          defaultModel: chatModelOf(held.defaultModel),
          chatTime: typeof held.chatTime === "number" ? held.chatTime : null,
        };
      }
    }
  } catch {
    // Хранилище страницы не всегда доступно — страница работает и без него.
  }
  return {
    chatTitle: "",
    project: "",
    theme: "",
    pluginFavorites: [],
    pluginRecent: [],
    chatModel: null,
    defaultModel: null,
    chatTime: null,
  };
}

export function writeFixtureState(state: FixtureState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Молча: страница проверки не обязана иметь хранилище.
  }
}
