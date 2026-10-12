// Плагины в интерфейсе: что установлено, что подключено к чату, что искать.
// Разбор формы движка делает мост (ADR-0001) — здесь только состояние окна и
// действия владельца: «открыть список», «найти», «подключить», «в избранное».
//
// Пины и недавние переживают перезапуск приложения: едут в состоянии окна
// (src-tauri/src/state.rs через мост, ADR-0001), правки пишут его же тем же полям.

import { useCallback, useEffect, useMemo, useState } from "react";

import { loadState, patchState } from "../../appstate";
import type { CatalogEntry } from "../../catalog";
import {
  bridge,
  ENGINE_READY_NOTICES,
  subscribeToFeed,
  type HeldUpdate,
  type Plugin,
} from "../../bridge";
import { usePluginActions, type PluginActions } from "./usePluginActions";

/** Раздел списка плагинов: заголовок и плагины в нём. */
export type PluginGroup = { title: string; plugins: Plugin[] };

/** Действия над списком (connect, apply, …) — их определения в usePluginActions. */
export type PluginsState = PluginActions & {
  /** Все установленные плагины — строки списка. */
  plugins: Plugin[];
  /** Подключённые к чату: их команды становятся кнопками шапки. */
  connected: Plugin[];
  /** Разделы списка: избранные, недавние, остальные — поименно. */
  groups: PluginGroup[];
  /** Что ищет владелец; пусто — показываем все разделы. */
  query: string;
  /** Отмеченные «в избранное»: их строки показывают отметку. */
  favorites: string[];
  /** Список ещё едет от движка — окно об этом говорит. */
  loading: boolean;
  /** Движок не ответил или плагина нет: причина словами, а не пустота. */
  error: string;
  /** Пометка последней проверки каталога: не ответил — работаем на текущих;
   *  `null` — каталог отвечал (src-tauri/src/plugins/updates.rs). */
  updatesNote: string | null;
  /** Удержанные правами обновления (updates.json): по ним сводка новых прав
   *  открывается сама при старте (сцена K, решение владельца 2026-10-06). */
  heldUpdates: HeldUpdate[];
  search: (text: string) => void;
  favorite: (id: string) => void;
  /** Свежий список без действий владельца: «Once» снимается после вопроса. */
  refresh: () => void;
};

/** Список установленного и ответ о проверке обновлений: два ответа моста, каждый
 *  сам по себе — заметка и удержанные не отвечают, список работает (updates.rs,
 *  «каталог недоступен — работаем на текущих»). */
function listAndNote(
  setPlugins: (list: Plugin[]) => void,
  setError: (reason: string) => void,
  setLoading: (loading: boolean) => void,
  setUpdatesNote: (note: string | null) => void,
  setHeld: (held: HeldUpdate[]) => void,
): void {
  bridge()
    .listPlugins()
    .then((list) => {
      setPlugins(list);
      setError("");
    })
    .catch((reason: unknown) => setError(String(reason)))
    .finally(() => setLoading(false));
  bridge()
    .updatesNote()
    .then((answer) => {
      setUpdatesNote(answer.note);
      setHeld(answer.held);
    })
    .catch(() => {
      setUpdatesNote(null);
      setHeld([]);
    });
}

/** Пины и недавние с прошлого запуска — из состояния окна (src-tauri/src/state.rs). */
function pinsFromState(
  setFavorites: (ids: string[]) => void,
  setRecent: (ids: string[]) => void,
): void {
  void loadState().then((state) => {
    if (state) {
      setFavorites(state.pluginFavorites ?? []);
      setRecent(state.pluginRecent ?? []);
    }
  });
}

/** Список плагинов проекта: загрузка, поиск, подключение и избранное. */
export function usePlugins(): PluginsState {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatesNote, setUpdatesNote] = useState<string | null>(null);
  const [held, setHeld] = useState<HeldUpdate[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  const load = useCallback(() => {
    listAndNote(setPlugins, setError, setLoading, setUpdatesNote, setHeld);
  }, []);

  useEffect(() => {
    load();
    // Пины и недавние с прошлого запуска: до их ответа разделы собираются пустыми.
    pinsFromState(setFavorites, setRecent);
  }, [load]);

  // Движок обосновался после подъёма (при старте окна plugin_list честно
  // ответил «не готов»): список перечитывается сам, кнопки плагинов приходят
  // без клика. Подписка и её отписка — мосту (subscribeToFeed), повторов нет.
  useEffect(() => {
    return subscribeToFeed((event) => {
      if (
        event.type === "row" &&
        event.kind === "notice" &&
        ENGINE_READY_NOTICES.includes(event.text)
      ) {
        load();
      }
    });
  }, [load]);

  /** Пин плагина: снять или поставить; правка сразу едёт в состояние окна. */
  const favorite = useCallback(
    (id: string) => {
      setFavorites((known) => {
        const next = togglePin(known, id);
        void patchState({ pluginFavorites: next });
        return next;
      });
    },
    [],
  );

  /** Плагин в недавние: свежий сверху, повторы не дублируются; запись — в состояние окна. */
  const rememberRecent = useCallback((id: string) => {
    setRecent((known) => {
      const next = onTop(known, id);
      void patchState({ pluginRecent: next });
      return next;
    });
  }, []);

  // Действия над списком (подключить, снять, установить, Enable/Disable,
  // правило, деинсталляция) — соседний файл (usePluginActions); здесь остаётся
  // их запись состояния и недавние.
  const actions = usePluginActions(setPlugins, setError, rememberRecent);

  const found = useMemo(() => foundIn(plugins, query), [plugins, query]);
  return {
    plugins,
    connected: plugins.filter((plugin) => plugin.connected && !plugin.disabled),
    groups: grouped(found, favorites, recent),
    query,
    favorites,
    loading,
    error,
    updatesNote,
    heldUpdates: held,
    search: setQuery,
    ...actions,
    favorite,
    refresh: load,
  };
}

/** Удержанные записи, чью сводку эта сессия уже показывала: страница чата и
 *  раздел «Плагины» монтируются по очереди, а окно при старте — одно, поэтому
 *  память о показанном живёт здесь, а не в состоянии страницы. */
const shownAtStart = new Set<string>();

/** Сводка удержанного обновления и её ответы — что окно держит открытым. */
export type HeldSummary = {
  /** Открытая сводка; нет — очередь пуста или все показанные отвечены. */
  summary: CatalogEntry | undefined;
  /** «Разрешить»: обновление переносится тем же путём, что установка каталога. */
  allow: (entry: CatalogEntry) => void;
  /** «Отмена»: карточка остаётся «ждёт прав», окно уходит. */
  cancel: () => void;
  /** Кнопка «Обновить» карточки: сводка записи открывается снова. */
  open: (id: string) => void;
};

/** Сводка новых прав удержанного обновления (сцена K, решение владельца
 *  2026-10-06): при старте held-записи updates.json открывают сводку сами, по
 *  одной на плагин — ответ («Разрешить»/«Отмена») выпускает следующую. Ответ
 *  запоминает запись показанной: сводка сама не возвращается, вернуть её можно
 *  кнопкой «Обновить» карточки вкладки Updates. */
export function useHeldSummary(plugins: PluginsState): HeldSummary {
  const [summary, setSummary] = useState<CatalogEntry | undefined>(undefined);
  useEffect(() => {
    if (summary) {
      return;
    }
    const next = plugins.heldUpdates.find((one) => !shownAtStart.has(one.id));
    if (!next) {
      return;
    }
    shownAtStart.add(next.id);
    setSummary(summaryEntry(next, plugins.plugins));
  }, [summary, plugins.heldUpdates, plugins.plugins]);
  const allow = useCallback(
    (entry: CatalogEntry) => {
      setSummary(undefined);
      plugins.install(entry.id);
    },
    [plugins.install],
  );
  const cancel = useCallback(() => setSummary(undefined), []);
  const open = useCallback(
    (id: string) => {
      const one = plugins.plugins.find((plugin) => plugin.id === id);
      if (one?.update) {
        shownAtStart.add(id);
        setSummary(summaryEntry({ id, ...one.update }, plugins.plugins));
      }
    },
    [plugins.plugins],
  );
  return { summary, allow, cancel, open };
}

/** Карточка сводки из удержанной записи: имя и описание — от списка плагинов,
 *  версия — цель обновления, права — строки updates.json «Категория: значение». */
function summaryEntry(held: HeldUpdate, plugins: Plugin[]): CatalogEntry {
  const known = plugins.find((one) => one.id === held.id);
  return {
    id: held.id,
    name: known?.name ?? held.id,
    description: known?.description ?? "",
    author: known?.author ?? "",
    version: held.to,
    repo: "",
    entry: "",
    permissions: (held.permissions ?? []).map((line) => {
      const at = line.indexOf(": ");
      return { category: line.slice(0, at), value: line.slice(at + 2) };
    }),
    commands: [],
  };
}

/** Пин в списке с поворотом: был — снять, не было — сверху. */
function togglePin(known: string[], id: string): string[] {
  return known.includes(id) ? known.filter((one) => one !== id) : [id, ...known];
}

/** id сверху списка: повторы не дублируются. */
function onTop(known: string[], id: string): string[] {
  return [id, ...known.filter((one) => one !== id)];
}

/** Поиск по имени и описанию — без учёта регистра, как ищет владелец руками. */
function foundIn(plugins: Plugin[], query: string): Plugin[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return plugins;
  }
  return plugins.filter(
    (plugin) =>
      plugin.id.toLowerCase().includes(needle) ||
      plugin.commands.some((command) =>
        `${command.label} ${command.description}`.toLowerCase().includes(needle),
      ),
  );
}

/** Разделы списка: сначала избранные, потом недавние, потом остальные по имени.
 *  Пустой раздел на экране не рисуется — заголовок без строк только шумит. */
function grouped(plugins: Plugin[], favorites: string[], recent: string[]): PluginGroup[] {
  const order: PluginGroup[] = [
    { title: "Избранные", plugins: pick(plugins, favorites) },
    { title: "Недавние", plugins: pick(plugins, recent) },
    { title: "Все плагины", plugins: byName(plugins.filter((one) => !favorites.includes(one.id) && !recent.includes(one.id))) },
  ];
  return order.filter((group) => group.plugins.length > 0);
}

/** Плагины по списку id, в порядке этого списка: избранное и недавнее — как отмечали. */
function pick(plugins: Plugin[], ids: string[]): Plugin[] {
  return ids.flatMap((id) => plugins.filter((plugin) => plugin.id === id));
}

/** Плагины по имени: список установленных читают сверху вниз, как он есть. */
function byName(plugins: Plugin[]): Plugin[] {
  return plugins.slice().sort((one, another) => one.id.localeCompare(another.id));
}
