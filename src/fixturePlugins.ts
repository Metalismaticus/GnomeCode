// Плагины вне окна Tauri: та же форма, что отдаёт мост (src-tauri/src/plugins), —
// список установленных, команды и отметка «подключён к чату». Источник правды на
// живой движок — `GET /api/plugin` и `GET /api/command`; здесь та же форма на
// странице vite, чтобы сценарий проверки видел то же, что продукт
// (docs/specs/2026-10-05-4-glavnoe-okno.md, «Настоящие данные»).
//
// Список бывает пустым — это законное состояние движка, а не поломка: пустой
// список отдаёт `?состояние=плагины-пусто`.
//
// Подключение — наша запись (реестр чата), а не вызов сервера: `POST /api/plugin`
// у движка не существует. Здесь оно живёт в состоянии страницы, на диск не пишется
// (docs/TESTING.md, «Данные пользователя»).

import type { Plugin } from "./bridge";
import { params } from "./viewparams";

/** Подключённые к чату плагины: то же, что держит реестр чата в окне Tauri. */
const connected = new Set<string>();

/** Плагин так, как его отдаёт мост: команды с префиксом `плагин:`, как у движка. */
const plugin = (
  id: string,
  commands: { name: string; description: string }[],
  state: Plugin["state"] = "active",
  error = "",
): Plugin => ({
  commands: commands.map((one) => ({
    name: `${id}:${one.name}`,
    label: one.name,
    description: one.description,
  })),
  error,
  id,
  state,
  connected: false,
});

/** Настоящие имена плагинов, а не «Lorem ipsum»: один с одной командой
 *  (одна команда — одна кнопка, docs/ROADMAP.md, «Крайние случаи»), один с двумя,
 *  один не запустился — в строке видна причина. */
const PLUGINS: Plugin[] = [
  plugin("git", [
    { name: "diff", description: "показать изменения рабочей папки" },
    { name: "commit", description: "собрать коммит с описанием" },
  ]),
  plugin("docs", [{ name: "search", description: "поиск по документации проекта" }]),
  plugin(
    "browser",
    [
      { name: "open", description: "открыть страницу и показать её текст" },
      { name: "shot", description: "снять страницу картинкой" },
    ],
    "failed",
    "модуль браузера не установлен: playwright install chromium",
  ),
];

/** Список установленных плагинов по состоянию страницы: с плагинами или пустой.
 *  Состояние «одобрение» — тот же список: слой прав не меняет, что установлено;
 *  в состоянии «каталог» список нужен — оттуда и начинается установка. */
export function plugins(): Plugin[] {
  if (params.feed !== "plugins" && params.feed !== "approval" && params.feed !== "catalog") {
    return [];
  }
  return PLUGINS.map((one) => ({ ...one, connected: connected.has(one.id) }));
}

/** Подключение к чату: отмечаем плагин и отдаём список заново — как это делает мост. */
export function connect(list: Plugin[], id: string): Plugin[] {
  connected.add(id);
  return list.map((one) => (one.id === id ? { ...one, connected: true } : one));
}

/** Собрать плагин из карточки каталога: команды получают префикс `плагин:`,
 *  как их приписывает движок (src-tauri/src/plugins/catalog.rs). */
export function builder(id: string, commands: { name: string; description: string }[]): Plugin {
  return plugin(id, commands);
}

/** Принять установленный из каталога плагин: карточка становится строкой списка
 *  установленных и сразу подключается к чату — «Allow» сводки прав делает оба шага. */
export function adopt(one: Plugin): void {
  if (!PLUGINS.some((known) => known.id === one.id)) {
    PLUGINS.push(one);
  }
  connected.add(one.id);
}