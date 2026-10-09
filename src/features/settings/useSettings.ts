// Настройки окна (docs/specs/2026-10-06-12-nastrojki.md): провайдеры и их
// ключи, умолчания прав, папка данных. Узор `useCatalog` (пункт 1 партии):
// состояние loading/error/data, повтор при провале. Ключи — по одному
// (мост знает запись целиком), секрет не возвращается.
import { useCallback, useEffect, useState } from "react";

import { bridge, type ProviderRow, type RuleEntry } from "../../bridge";

export type SettingsState = {
  /** Провайдеры: строки раздела «Модели»; null — ещё едут. */
  providers: ProviderRow[] | null;
  /** «Движок недоступен»: список не читается, остальное работает. */
  error: string;
  /** Пометки «задан/не задан» по id; секрет не возвращается никогда. */
  keys: Record<string, boolean>;
  /** Умолчания прав: строка на категорию, значение — как нажато. */
  defaults: RuleEntry[];
  /** Полный путь папки данных; пусто — ещё читается. */
  folder: string;
  /** Сохранить ключ: мост пишет хранилище ОС и тихо перезапускает движок. */
  saveKey: (provider: string, secret: string) => Promise<ProviderRow>;
  /** Убрать ключ: пометка «не задан», секрет никуда не возвращается. */
  removeKey: (provider: string) => Promise<void>;
  /** Повтор чтения провайдеров («Повторить» при недоступном движке). */
  retry: () => void;
  /** Сменить умолчание одной категории прав. */
  setDefault: (category: string, value: string) => void;
  /** Включить или выключить провайдера/endpoint: модели выключенного уходят
   *  из переключателя чата. */
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  /** Добавить свой endpoint: имя + база URL (+ ключ); список обновляется сам. */
  addEndpoint: (name: string, baseUrl: string, key: string) => Promise<void>;
  /** Удалить свой endpoint. */
  removeEndpoint: (id: string) => Promise<void>;
};

/** Список провайдеров и его повтор: loading/error/data — узор useCatalog. */
function useProviderRows() {
  const [providers, setProviders] = useState<ProviderRow[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setError("");
    bridge()
      .providerList()
      .then(setProviders)
      .catch((reason: unknown) => {
        setProviders(null);
        setError(String(reason));
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { providers, setProviders, error, setError, load };
}

/** Умолчания прав — от секции rules.json; права и тема от движка не зависят
 *  (спека «Движок недоступен») — отдельный запрос не мешает ошибке списка. */
function useDefaultsList(setError: (reason: string) => void) {
  const [defaults, setDefaults] = useState<RuleEntry[]>([]);
  useEffect(() => {
    let alive = true;
    bridge()
      .defaults()
      .then((held) => {
        if (alive) {
          setDefaults(held);
        }
      })
      .catch(() => {
        // Секции нет — умолчание ask у каждой категории рисует сама строка.
      });
    return () => {
      alive = false;
    };
  }, [setError]);
  return { defaults, setDefaults };
}

/** Путь папки данных — показ, не действие; читаётся один раз при входе. */
function useDataFolder() {
  const [folder, setFolder] = useState("");
  useEffect(() => {
    let alive = true;
    bridge()
      .dataFolder()
      .then((path) => {
        if (alive) {
          setFolder(path);
        }
      })
      .catch(() => {
        // Путь не читается — строка останется с прочерком.
      });
    return () => {
      alive = false;
    };
  }, []);
  return folder;
}

/** Пометки «задан/не задан» после свежего списка: по одному, секрет не читается. */
function useKeyMarks(providers: ProviderRow[] | null) {
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!providers) {
      return;
    }
    bridge()
      .keyStatuses(providers.map((one) => one.id))
      .then(setKeys)
      .catch(() => {
        // Заметки не читаются — строки покажут «ключ не задан»: безопаснее.
      });
  }, [providers]);
  return { keys, setKeys };
}

/** Действия над списком провайдеров: каждый мост вызывает и перечитывает
 *  список — строки раздела обновляются одним путём. */
function useProviderActions(
  setProviders: (rows: ProviderRow[]) => void,
  setError: (reason: string) => void,
) {
  const refreshList = useCallback(() => {
    return bridge()
      .providerList()
      .then(setProviders)
      .catch((reason: unknown) => setError(String(reason)));
  }, [setProviders, setError]);

  const setEnabled = useCallback(
    async (id: string, enabled: boolean) => {
      await bridge().providerSetEnabled(id, enabled);
      await refreshList();
    },
    [refreshList],
  );

  const addEndpoint = useCallback(
    async (name: string, baseUrl: string, key: string) => {
      await bridge().endpointAdd(name, baseUrl, key);
      await refreshList();
    },
    [refreshList],
  );

  const removeEndpoint = useCallback(
    async (id: string) => {
      await bridge().endpointRemove(id);
      await refreshList();
    },
    [refreshList],
  );

  return { refreshList, setEnabled, addEndpoint, removeEndpoint };
}

export function useSettings(): SettingsState {
  const list = useProviderRows();
  const { defaults, setDefaults } = useDefaultsList(list.setError);
  const folder = useDataFolder();
  const { keys, setKeys } = useKeyMarks(list.providers);
  const actions = useProviderActions(list.setProviders, list.setError);

  const saveKey = useCallback(
    async (provider: string, secret: string) => {
      await bridge().saveKey(provider, secret);
      setKeys((held) => ({ ...held, [provider]: true }));
      const fresh = await bridge().providerList();
      list.setProviders(fresh);
      const row = fresh.find((one) => one.id === provider);
      return row ?? { id: provider, name: provider, models: 0, endpoint: false, enabled: true };
    },
    [list.setProviders, setKeys],
  );

  const removeKey = useCallback(
    async (provider: string) => {
      await bridge().removeKey(provider);
      setKeys((held) => ({ ...held, [provider]: false }));
    },
    [setKeys],
  );

  const setDefault = useCallback(
    (category: string, value: string) => {
      void bridge()
        .setDefault(category, value)
        .then(setDefaults)
        .catch((reason: unknown) => list.setError(String(reason)));
    },
    [list.setError, setDefaults],
  );

  return {
    providers: list.providers,
    error: list.error,
    keys,
    defaults,
    folder,
    saveKey,
    removeKey,
    retry: list.load,
    setDefault,
    setEnabled: actions.setEnabled,
    addEndpoint: actions.addEndpoint,
    removeEndpoint: actions.removeEndpoint,
  };
}
