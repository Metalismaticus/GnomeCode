// Слой прав вне окна Tauri: ту же работу в окне делает Rust (src-tauri/src/plugins/commands.rs,
// `plugin_run` + rules.rs). Правило одно — утверждённый UX «Спрашивать при первом
// использовании» (docs/SPEC/plugins.md): первый чувствительный вызов команды плагина
// спрашивает владельца окном, «Разрешить для этого чата» запоминает правило до
// перезапуска, «Отказать» не зовёт движок и выводит строку отказа. Правило категории
// (rules.rs) зеркалит порядок решения: deny — строка «⚠ … denied» и конец, грант
// чата или allow — молча, иначе окно.
//
// Состояние `?состояние=плагины` даёт разрешение заранее: шаг «к)» сценария
// плагинов проверяет исполнение, а не окно одобрения; окно — состояние
// `?состояние=одобрение`, где правило ещё не выдано. Правила и правила категорий —
// память страницы, на диск не пишутся (docs/TESTING.md, «Данные пользователя»).

import { fixture } from "./fixture";
import { params } from "./viewparams";
import type { FeedEvent } from "./bridge";

/** Выданные правила чата: ключ — полное имя команды у движка (`docs:search`). */
const grants = new Set<string>();

/** Правила категорий: ключ `плагин:категория` → allow/ask/deny — то же, что
 *  держит rules.json в окне (src-tauri/src/plugins/rules.rs). */
const rules = new Map<string, string>();

/** Якорь идентификаторов строк запуска: строка одна, новый запуск — новая строка. */
let started = 0;

/** Как зовёт строку запуска движок в окне: opencode/client.rs, `command_started`. */
const STARTED_MARK = "⧗";

/** Как зовёт строку отказа движок в окне: opencode/client.rs, `command_refused`. */
const REFUSED_MARK = "⚠";
const REFUSED_TAIL = " requires approval";
const DENIED_TAIL = " denied";

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

/** Правило категории плагина, если выставлено в Configure. */
export function ruleOf(plugin: string, category: string): string | undefined {
  return rules.get(`${plugin}:${category}`);
}

/** Сменить правило категории: то же, что plugin_set_rule в окне; отдаёт карту
 *  правил плагина для панели Configure — она показывает, что уже выставлено. */
export function setRule(plugin: string, category: string, value: string): Record<string, string> {
  rules.set(`${plugin}:${category}`, value);
  return rulesMap(plugin);
}

/** Правила одного плагина: `категория → значение`, пусто — умолчание ask. */
export function rulesMap(plugin: string): Record<string, string> {
  const own: Record<string, string> = {};
  for (const [key, value] of rules) {
    const [id, category] = key.split(":");
    if (id === plugin && category) {
      own[category] = value;
    }
  }
  return own;
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

/** Запрещено правилом категории: строка «⚠ плагин · команда denied» — denied-
 *  категории не спрашиваются никогда, окна одобрения не будет. */
export function denyByRule(plugin: string, label: string): void {
  started += 1;
  emit(started, `${REFUSED_MARK} ${plugin} · ${label}${DENIED_TAIL}`);
}

function emit(number: number, text: string): void {
  const event: FeedEvent = { type: "row", id: `plugin-${number}`, kind: "tool", text };
  fixture.emit(event);
}
