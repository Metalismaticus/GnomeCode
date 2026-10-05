// Состояние окна в интерфейсе («Один полный цикл»): активный чат, папка проекта и
// тема приезжают при старте окна мостом (`stateGet`) и правятся им же
// (`statePatch`). Форму полей знает Rust (src-tauri/src/state.rs, ADR-0001) —
// интерфейс зовёт мост и держит структуру, а не файл и папку данных.
import { bridge } from "./bridge";
import type { Theme } from "./viewparams";

/** Что окно помнит о себе: те же поля, что у `state.rs::AppState` (ADR-0001). */
export type WindowState = {
  /** Открытая сессия движка: лента на неё вернётся. Интерфейс id не читает. */
  session: string | null;
  /** Титул чата для сайдбара: первый вопрос владельца. */
  chatTitle: string | null;
  /** Папка проекта, если выбрана. */
  project: string | null;
  /** Тема, если владелец переключал. */
  theme: Theme | null;
};

/** Правка состояния: названные поля меняются, остальное — как было. */
export type WindowPatch = {
  session?: string;
  chatTitle?: string;
  project?: string;
  theme?: Theme;
};

export function loadState(): Promise<WindowState | null> {
  return bridge()
    .stateGet()
    .catch((reason: unknown) => {
      console.error("состояние окна не прочитано:", reason);
      return null;
    });
}

export function patchState(patch: WindowPatch): Promise<WindowState | null> {
  return bridge()
    .statePatch(patch)
    .catch((reason: unknown) => {
      console.error("состояние окна не сохранено:", reason);
      return null;
    });
}

/** Титул чата: первый вопрос до перевода строк, длинный — с обрывом. */
export function chatTitleOf(question: string): string {
  const first = question.trim().split("\n")[0] ?? question.trim();
  return first.length > 60 ? `${first.slice(0, 60)}…` : first;
}
