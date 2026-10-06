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
};

export function useSettings(): SettingsState {
  const [providers, setProviders] = useState<ProviderRow[] | null>(null);
  const [error, setError] = useState("");
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [defaults, setDefaults] = useState<RuleEntry[]>([]);
  const [folder, setFolder] = useState("");

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

  /** Умолчания прав — от секции rules.json; права и тема от движка не зависят
   *  (спека «Движок недоступен») — отдельный запрос не мешает ошибке списка. */
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
  }, []);

  /** Путь папки данных — показ, не действие; читаётся один раз при входе. */
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

  /** Статусы ключей после свежего списка: по одному, секрет не читается. */
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

  const saveKey = useCallback(async (provider: string, secret: string) => {
    await bridge().saveKey(provider, secret);
    setKeys((held) => ({ ...held, [provider]: true }));
    const fresh = await bridge().providerList();
    setProviders(fresh);
    const row = fresh.find((one) => one.id === provider);
    return {
      id: provider,
      name: row?.name ?? provider,
      models: row?.models ?? 0,
    };
  }, []);

  const removeKey = useCallback(async (provider: string) => {
    await bridge().removeKey(provider);
    setKeys((held) => ({ ...held, [provider]: false }));
  }, []);

  const setDefault = useCallback((category: string, value: string) => {
    void bridge()
      .setDefault(category, value)
      .then(setDefaults)
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  return {
    providers,
    error,
    keys,
    defaults,
    folder,
    saveKey,
    removeKey,
    retry: load,
    setDefault,
  };
}
