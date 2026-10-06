// Плагины в интерфейсе: что установлено, что подключено к чату, что искать.
// Разбор формы движка делает мост (ADR-0001) — здесь только состояние окна и
// действия владельца: «открыть список», «найти», «подключить», «в избранное».
//
// Избранное и недавнее живут в окне, на диск не пишутся: данных пользователя в
// проекте ещё нет (docs/TESTING.md, «Данные пользователя»).

import { useCallback, useEffect, useMemo, useState } from "react";

import { bridge, type Plugin } from "../../bridge";

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
  connect: (id: string) => void;
  install: (id: string) => void;
  favorite: (id: string) => void;
  /** Enable/Disable карточки раздела «Плагины»: кнопки команд уходят из всех чатов. */
  setEnabled: (disabled: boolean, id: string) => void;
  /** Сменить правило категории плагина (панель Configure): действует на следующий
   *  вызов без перезапуска — список обновляется, панель показывает нажатую кнопку. */
  setRule: (id: string, category: string, value: string) => void;
  /** Uninstall после подтверждения: запись реестра и файл плагина уходят. */
  uninstall: (id: string) => void;
};

/** Список плагинов проекта: загрузка, поиск, подключение и избранное. */
export function usePlugins(): PluginsState {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatesNote, setUpdatesNote] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    bridge()
      .listPlugins()
      .then(setPlugins)
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setLoading(false));
    bridge()
      .updatesNote()
      .then(setUpdatesNote)
      .catch(() => setUpdatesNote(null));
  }, []);

  /** Подключение к чату: плагин уходит в недавние, кнопки появляются в шапке. */
  const connect = useCallback((id: string) => {
    bridge()
      .connectPlugin(id)
      .then((list) => {
        setPlugins(list);
        setError("");
        setRecent((known) => [id, ...known.filter((one) => one !== id)]);
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  /** Установка из каталога по «Разрешить» сводки прав: мост ставит файл и
   *  подключает к чату (тихий перезапуск внутри), список обновляется тем же
   *  состоянием, что и подключение из списка — плагин сразу в кнопках шапки. */
  const install = useCallback((id: string) => {
    bridge()
      .installPlugin(id)
      .then((list) => {
        setPlugins(list);
        setError("");
        setRecent((known) => [id, ...known.filter((one) => one !== id)]);
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  const favorite = useCallback((id: string) => {
    setFavorites((known) =>
      known.includes(id) ? known.filter((one) => one !== id) : [id, ...known],
    );
  }, []);

  /** Enable/Disable карточки: мост меняет состояние плагина (список — как после
   *  подключения), кнопки команд в шапках пересчитаются при возврате в чат. */
  const setEnabled = useCallback((disabled: boolean, id: string) => {
    bridge()
      .setPluginEnabled(disabled, id)
      .then((list) => {
        setPlugins(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  /** Uninstall после подтверждения: мост удаляет запись и файл, список — свежий. */
  const uninstall = useCallback((id: string) => {
    bridge()
      .uninstallPlugin(id)
      .then((list) => {
        setPlugins(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  /** Смена правила категории в панели Configure: мост пишет правило, список
   *  свежий — панель показывает правило нажатой кнопкой (критерий готовности:
   *  следующий вызов ведёт себя по-новому, перезапуск не нужен). */
  const setRule = useCallback((id: string, category: string, value: string) => {
    bridge()
      .setPluginRule(id, category, value)
      .then((list) => {
        setPlugins(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

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
    install,
    favorite,
    setEnabled,
    setRule,
    uninstall,
  };
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