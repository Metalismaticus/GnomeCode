// Слой прав вне окна Tauri: ту же работу в окне делает Rust (src-tauri/src/plugins/permissions.rs).
// Правило одно — утверждённый UX «Спрашивать при первом использовании»
// (docs/SPEC/plugins.md): первый чувствительный вызов команды плагина спрашивает
// владельца окном, «Разрешить для этого чата» запоминает правило до перезапуска,
// «Отказать» не зовёт движок и выводит строку отказа.
//
// Состояние `?состояние=плагины` даёт разрешение заранее: шаг «к)» сценария
// плагинов проверяет исполнение, а не окно одобрения; окно — состояние
// `?состояние=одобрение`, где правило ещё не выдано. Правила — память страницы,
// на диск не пишутся (docs/TESTING.md, «Данные пользователя»).

import { fixture } from "./fixture";
import { params } from "./viewparams";
import type { FeedEvent } from "./bridge";

/** Выданные правила чата: ключ — полное имя команды у движка (`docs:search`). */
const grants = new Set<string>();

/** Якорь идентификаторов строк запуска: строка одна, новый запуск — новая строка. */
let started = 0;

/** Как зовёт строку запуска движок в окне: opencode/client.rs, `command_started`. */
const STARTED_MARK = "⧗";

/** Как зовёт строку отказа движок в окне: opencode/client.rs, `command_refused`. */
const REFUSED_MARK = "⚠";
const REFUSED_TAIL = " requires approval";

/** Это состояние в окне одобрения не нуждается: разрешение уже выдано заранее. */
const PREGRANTED = "plugins";

/** Пропустил ли слой прав этот вызов без вопроса. */
export function granted(command: string): boolean {
  if (params.feed === PREGRANTED) {
    return true;
  }
  return grants.has(command);
}

/** Владелец разрешил команде этот чат: дальше она не спрашивает (кусок 4c). */
export function remember(command: string): void {
  grants.add(command);
}

/** Запуск команды: строка «⧗ плагин · команда» — дальше отвечает движок. */
export function launch(plugin: string, label: string): void {
  started += 1;
  emit(started, `${STARTED_MARK} ${plugin} · ${label}`);
}

/** Отказ владельца: строка «⚠ плагин · команда requires approval», вызов не идёт. */
export function refuse(plugin: string, label: string): void {
  started += 1;
  emit(started, `${REFUSED_MARK} ${plugin} · ${label}${REFUSED_TAIL}`);
}

function emit(number: number, text: string): void {
  const event: FeedEvent = { type: "row", id: `plugin-${number}`, kind: "tool", text };
  fixture.emit(event);
}
