// Действия владельца над плагинами, чей ответ моста — свежий список: подключение,
// снятие с чата, установка, Enable/Disable, правило категории, деинсталляция.
// Состояние списка и недавние живёт в usePlugins — сюда приходит только его запись.

import { useCallback } from "react";

import { bridge, type Plugin, type PluginScope } from "../../bridge";

/** Действия над плагинами: список приходит из ответа самого действия, без
 *  отдельного plugin_list — кнопки в шапке появляются тем же ответом. */
export type PluginActions = {
  /** Подключить со скоупом (сцена E): без скоупа — «этот чат». */
  connect: (id: string, scope?: PluginScope) => void;
  /** Свежий список из ответа чужого действия (подключение Tool Set). */
  apply: (call: Promise<Plugin[]>) => void;
  /** Снять плагин с чата без деинсталляции (панель «Plugins in this chat»). */
  disconnect: (id: string) => void;
  install: (id: string, scope?: PluginScope) => void;
  /** Enable/Disable карточки раздела «Плагины»: кнопки команд уходят из всех чатов. */
  setEnabled: (disabled: boolean, id: string) => void;
  /** Сменить правило категории плагина (панель Configure): действует на следующий
   *  вызов без перезапуска — список обновляется, панель показывает нажатую кнопку. */
  setRule: (id: string, category: string, value: string) => void;
  /** Uninstall после подтверждения: запись реестра и файл плагина уходят. */
  uninstall: (id: string) => void;
};

/** Действия плагинов, трогающие список одним шагом: ответ моста — свежий список
 *  в состояние, причина — словами в ошибку. Установка и подключение кладут
 *  плагин в недавние (rememberRecent пишет состояние окна в usePlugins). */
export function usePluginActions(
  setPlugins: (list: Plugin[]) => void,
  setError: (reason: string) => void,
  rememberRecent: (id: string) => void,
): PluginActions {
  /** Один ответ моста: свежий список — в состояние, причина — словами в ошибку. */
  const applied = useCallback(
    (call: Promise<Plugin[]>) => {
      return call
        .then((list) => {
          setPlugins(list);
          setError("");
        })
        .catch((reason: unknown) => setError(String(reason)));
    },
    [setPlugins, setError],
  );

  /** Подключение к чату со скоупом (сцена E): плагин уходит в недавние (и на диск
   *  в состояние окна), кнопки появляются в шапке. */
  const connect = useCallback(
    (id: string, scope?: PluginScope) => {
      void applied(bridge().connectPlugin(id, scope)).then(() => {
        rememberRecent(id);
      });
    },
    [applied, rememberRecent],
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
    [applied, rememberRecent],
  );

  /** Enable/Disable карточки: мост меняет состояние плагина (список — как после
   *  подключения), кнопки команд в шапках пересчитаются при возврате в чат. */
  const setEnabled = useCallback(
    (disabled: boolean, id: string) => {
      void applied(bridge().setPluginEnabled(disabled, id));
    },
    [applied],
  );

  /** Смена правила категории в панели Configure: действует на следующий вызов
   *  без перезапуска — панель показывает правило нажатой кнопкой. */
  const setRule = useCallback(
    (id: string, category: string, value: string) => {
      void applied(bridge().setPluginRule(id, category, value));
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

  return { connect, apply, disconnect, install, setEnabled, setRule, uninstall };
}
