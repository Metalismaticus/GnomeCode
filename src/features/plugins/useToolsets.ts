// Tool Sets в интерфейсе: список сохранённых групп и действия владельца над
// ними. Узор usePlugins (loading/error, applied) — список из ответа каждого
// действия и есть состояние; подключение сета раскладывается на одиночные
// подключения на стороне моста, его ответ применяет usePlugins (ChatView).

import { useCallback, useEffect, useState } from "react";

import { bridge, type Plugin, type PluginScope, type ToolSet } from "../../bridge";

export type ToolsetsState = {
  /** Сохранённые сеты списком имя → id — пустой список законное состояние. */
  toolsets: ToolSet[];
  /** Список ещё едет — окно об этом говорит. */
  loading: boolean;
  /** Мост не ответил или сохранить было нельзя: причина словами. */
  error: string;
  /** Сохранить Tool Set из подключённого сейчас к чату. */
  save: (name: string) => void;
  /** Подключить Tool Set одним пунктом меню со скоупом: свежий список —
   *  из ответа самого подключения, его применяет usePlugins (ChatView). */
  connect: (name: string, scope?: PluginScope) => Promise<Plugin[]>;
  /** Удалить Tool Set: ярлык группы, плагины не трогаются. */
  remove: (name: string) => void;
};

/** Список Tool Sets: загрузка и действия владельца. */
export function useToolsets(): ToolsetsState {
  const [toolsets, setToolsets] = useState<ToolSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    bridge()
      .listToolsets()
      .then((list) => {
        setToolsets(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const applied = useCallback((call: Promise<ToolSet[]>) => {
    return call
      .then((list) => {
        setToolsets(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  const save = useCallback(
    (name: string) => {
      void applied(bridge().saveToolset(name));
    },
    [applied],
  );

  /** Подключение сета: список из ответа подключения возвращается окну — его
   *  применяет usePlugins (ChatView), параллельный plugin_list не нужен:
   *  подключение по HTTP делает ходы к движку, отдельный список вернул бы
   *  прежний реестр раньше записи. */
  const connect = useCallback((name: string, scope?: PluginScope): Promise<Plugin[]> => {
    const call = bridge().connectToolset(name, scope);
    call.catch((reason: unknown) => setError(String(reason)));
    return call;
  }, []);

  const remove = useCallback(
    (name: string) => {
      void applied(bridge().deleteToolset(name));
    },
    [applied],
  );

  return { toolsets, loading, error, save, connect, remove };
}
