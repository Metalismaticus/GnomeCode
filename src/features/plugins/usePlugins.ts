// Плагины в интерфейсе: что установлено, что подключено к чату, что искать.
// Разбор формы движка делает мост (ADR-0001) — здесь только состояние окна и
// действия владельца: «открыть список», «найти», «подключить», «в избранное».
//
// Пины и недавние переживают перезапуск приложения: едут в состоянии окна
// (src-tauri/src/state.rs через мост, ADR-0001), правки пишут его же тем же полям.

import { useCallback, useEffect, useMemo, useState } from "react";

import { loadState, patchState } from "../../appstate";
import { bridge, type Plugin, type PluginScope } from "../../bridge";

/** Раздел списка плагинов: заголовок и плагины в нём. */
export type PluginGroup = { title: string; plugins: Plugin[] };

export type PluginsState = {
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
  search: (text: string) => void;
  /** Подключить со скоупом (сцена E): без скоупа — «этот чат». */
  connect: (id: string, scope?: PluginScope) => void;
  /** Свежий список из ответа чужого действия (подключение Tool Set): тот же
   *  узор applied — список из ответа самого действия, не отдельный plugin_list. */
  apply: (call: Promise<Plugin[]>) => void;
  /** Снять плагин с чата без деинсталляции (панель «Plugins in this chat»). */
  disconnect: (id: string) => void;
  install: (id: string, scope?: PluginScope) => void;
  favorite: (id: string) => void;
  /** Enable/Disable карточки раздела «Плагины»: кнопки команд уходят из всех чатов. */
  setEnabled: (disabled: boolean, id: string) => void;
  /** Сменить правило категории плагина (панель Configure): действует на следующий
   *  вызов без перезапуска — список обновляется, панель показывает нажатую кнопку. */
  setRule: (id: string, category: string, value: string) => void;
  /** Uninstall после подтверждения: запись реестра и файл плагина уходят. */
  uninstall: (id: string) => void;
  /** Свежий список без действий владельца: «Once» снимается после вопроса. */
  refresh: () => void;
};

/** Список установленного и заметка о последней проверке каталога: два ответа
 *  моста, каждый сам по себе — заметка не отвечает, список работает
 *  (updates.rs, «каталог недоступен — работаем на текущих»). */
function listAndNote(
  setPlugins: (list: Plugin[]) => void,
  setError: (reason: string) => void,
  setLoading: (loading: boolean) => void,
  setUpdatesNote: (note: string | null) => void,
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
    .then(setUpdatesNote)
    .catch(() => setUpdatesNote(null));
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
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  const load = useCallback(() => {
    listAndNote(setPlugins, setError, setLoading, setUpdatesNote);
  }, []);

  useEffect(() => {
    load();
    // Пины и недавние с прошлого запуска: до их ответа разделы собираются пустыми.
    pinsFromState(setFavorites, setRecent);
  }, [load]);

  /** Один ответ моста: свежий список — в состояние, причина — словами в ошибку.
   *  Список у всех действий тот же, что и у подключения (usePlugins), — шаг один. */
  const applied = useCallback((call: Promise<Plugin[]>) => {
    return call
      .then((list) => {
        setPlugins(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  /** Подключение к чату со скоупом (сцена E): плагин уходит в недавние (и на диск
   *  в состояние окна), кнопки появляются в шапке. */
  const connect = useCallback(
    (id: string, scope?: PluginScope) => {
      void applied(bridge().connectPlugin(id, scope)).then(() => {
        rememberRecent(id);
      });
    },
    [applied],
  );

  /** Чужой ответ моста (подключение Tool Set из ChatView): тот же applied —
   *  один шаг от действия до кнопок в шапке. */
  const apply = useCallback(
    (call: Promise<Plugin[]>) => {
      void applied(call);
    },
    [applied],
  );

  /** Снять плагин с чата без деинсталляции: кнопки уходят из этого окна. */
  const disconnect = useCallback(
    (id: string) => {
      void applied(bridge().disconnectPlugin(id));
    },
    [applied],
  );

  /** Установка из каталога по кнопкам сводки прав: мост ставит файл и
   *  подключает к чату с выбранным скоупом (тихий перезапуск внутри), список
   *  обновляется тем же состоянием, что и подключение из списка. */
  const install = useCallback(
    (id: string, scope?: PluginScope) => {
      void applied(bridge().installPlugin(id, scope)).then(() => {
        rememberRecent(id);
      });
    },
    [applied],
  );

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

  /** Enable/Disable карточки: мост меняет состояние плагина (список — как после
   *  подключения), кнопки команд в шапках пересчитаются при возврате в чат. */
  const setEnabled = useCallback(
    (disabled: boolean, id: string) => {
      void applied(bridge().setPluginEnabled(disabled, id));
    },
    [applied],
  );

  /** Uninstall после подтверждения: мост удаляет запись и файл, список — свежий. */
  const uninstall = useCallback(
    (id: string) => {
      void applied(bridge().uninstallPlugin(id));
    },
    [applied],
  );

  /** Смена правила категории в панели Configure: мост пишет правило, список
   *  свежий — панель показывает правило нажатой кнопкой (критерий готовности:
   *  следующий вызов ведёт себя по-новому, перезапуск не нужен). */
  const setRule = useCallback(
    (id: string, category: string, value: string) => {
      void applied(bridge().setPluginRule(id, category, value));
    },
    [applied],
  );

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
    search: setQuery,
    connect,
    apply,
    disconnect,
    install,
    favorite,
    setEnabled,
    setRule,
    uninstall,
    refresh: load,
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
