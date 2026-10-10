// Живой список чатов ядра — один запрос при старте окна (спека сайдбара §7):
// мост отдаёт загруженные сессии, своего хранилища списка интерфейс не ведёт.

import { useEffect, useState } from "react";

import { chatList, type ChatRow } from "../bridge";

/** Список ядра глазами сайдбара: движок не ответил (ещё поднимается) — пустой,
 *  сайдбар живёт тем, что уже знает. StrictMode зовёт эффект дважды — ответ
 *  один и тот же, второй ответ тех же строк не портит. */
export function useChatList(): ChatRow[] {
  const [rows, setRows] = useState<ChatRow[]>([]);
  useEffect(() => {
    let alive = true;
    chatList()
      .then((live) => {
        if (alive) {
          setRows(live);
        }
      })
      .catch(() => {
        // Списка нет: сайдбар показывает то, что передало окно, без поломки.
      });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}
