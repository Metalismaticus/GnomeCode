// Адрес страницы разбирается в одном месте (docs/specs/2026-10-05-4-glavnoe-okno.md,
// «Где снимать»): тема, состояние ленты и правая панель. Второго разбора адреса в коде
// нет — App берёт отсюда тему, фикстура — состояние ленты, ChatView — оверлей панели.
//
// В окне Tauri адреса нет: страница открыта как `tauri://localhost`, поэтому там тёмная
// тема и обычная лента, как раньше. Браузер отдаёт поиск в процентной кодировке, а
// URLSearchParams её разбирает сам — иначе `?тема=светлая` молча не сойдётся.

export type Theme = "dark" | "light";

/** Состояние экрана ленты: пусто, ошибка или много данных (`?состояние=`). */
export type FeedState = "feed" | "empty" | "error" | "many";

export type ViewParams = {
  theme: Theme;
  feed: FeedState;
  /** Правая панель открыта оверлеем — ракурс 1024×640 с панелью. */
  right: boolean;
  /** Обрыв потока по требованию сценария ленты (`?обрыв=1`). */
  breaks: boolean;
};

const THEMES: Record<string, Theme> = { тёмная: "dark", темная: "dark", светлая: "light" };
const FEEDS: Record<string, FeedState> = { пусто: "empty", ошибка: "error", много: "many" };

export function viewParams(search: string): ViewParams {
  const query = new URLSearchParams(search);
  return {
    theme: THEMES[query.get("тема") ?? ""] ?? "dark",
    feed: FEEDS[query.get("состояние") ?? ""] ?? "feed",
    right: query.get("правая") === "открыта",
    breaks: query.has("обрыв"),
  };
}

/** Параметры текущей страницы: в окне Tauri поиск пуст, поэтому значения по умолчанию. */
export const params: ViewParams = viewParams(typeof location === "undefined" ? "" : location.search);