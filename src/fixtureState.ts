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
};

const KEY = "gnomecode-fixture-state";

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
        };
      }
    }
  } catch {
    // Хранилище страницы не всегда доступно — страница работает и без него.
  }
  return { chatTitle: "", project: "", theme: "" };
}

export function writeFixtureState(state: FixtureState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Молча: страница проверки не обязана иметь хранилище.
  }
}
