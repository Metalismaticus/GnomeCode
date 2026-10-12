// Действия над чатами сайдбара: переименовать, удалить, в архив и вернуть.
// Одно место знает порядок: мост меняет чат в движке, список ядра
// перечитывается ответом команды, архив живёт в состоянии окна (patchState) —
// своих титулов и своих «удалённых» интерфейс не ведёт (ADR-0001).

import { useCallback, useState } from "react";

import { bridge, type ChatRow } from "../../bridge";
import { patchState } from "../../appstate";
import { useChatList } from "../../app/useChatList";

export type ChatActions = {
  /** Живой список ядра: строки сайдбара. */
  rows: ChatRow[];
  /** Перечитать список: старт окна и отказы моста. */
  refresh: () => void;
  /** Идентификаторы чатов в архиве (состояние окна). */
  archived: string[];
  /** Архив из сохранённого состояния при старте: окно помнит его между запусками. */
  applyArchived: (ids: string[] | null) => void;
  /** Переименовать: заголовок меняется в движке, список — из ответа. */
  rename: (id: string, title: string) => void;
  /** Удалить совсем: сессия и история уходят из движка. */
  remove: (id: string) => void;
  /** В архив: строка убирается из списка, сессия в ядре жива. */
  archive: (id: string) => void;
  /** Вернуть из архива: строка снова в списке. */
  unarchive: (id: string) => void;
};

export function useChatActions(): ChatActions {
  const { rows, refresh, replace } = useChatList();
  const [archived, setArchived] = useState<string[]>([]);
  const applyArchived = useCallback((ids: string[] | null) => setArchived(ids ?? []), []);

  const rename = useCallback(
    (id: string, title: string) => {
      bridge()
        .chatRename(id, title)
        .then(replace)
        .catch(() => {
          // Список не перечитан — сайдбар показывает прежний, чинить нечего.
        });
    },
    [replace],
  );

  const remove = useCallback(
    (id: string) => {
      bridge()
        .chatDelete(id)
        .then((fresh) => {
          replace(fresh);
          // Архив забывает удалённый чат локально: Rust чистит его в состоянии
          // окна, интерфейс не держит второго списка архивного.
          setArchived((held) => {
            if (!held.includes(id)) {
              return held;
            }
            const next = held.filter((one) => one !== id);
            void patchState({ archivedChats: next });
            return next;
          });
        })
        .catch(() => {
          // Удаление не удалось: список как был, чат на месте.
        });
    },
    [replace],
  );

  const archive = useCallback(
    (id: string) => {
      setArchived((held) => {
        if (held.includes(id)) {
          return held;
        }
        const next = [...held, id];
        void patchState({ archivedChats: next });
        return next;
      });
    },
    [],
  );

  const unarchive = useCallback((id: string) => {
    setArchived((held) => {
      if (!held.includes(id)) {
        return held;
      }
      const next = held.filter((one) => one !== id);
      void patchState({ archivedChats: next });
      return next;
    });
  }, []);

  return { rows, refresh, archived, applyArchived, rename, remove, archive, unarchive };
}
