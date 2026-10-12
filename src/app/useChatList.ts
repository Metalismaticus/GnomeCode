// Живой список чатов ядра — один запрос при старте окна (спека сайдбара §7):
// мост отдаёт загруженные сессии, своего хранилища списка интерфейс не ведёт.
// Перечитывание зовёт меню строки: после переименования и удаления сайдбар
// показывает свежий список, а не свою прошлую копию (замечание владельца
// 2026-10-10). Свежий список приходит ответом команды — `replace` принимает
// его, не держа второго запроса.

import { useCallback, useEffect, useState } from "react";

import { chatList, type ChatRow } from "../bridge";

/** Список ядра глазами сайдбара: движок не ответил (ещё поднимается) — пустой,
 *  сайдбар живёт тем, что уже знает. StrictMode зовёт эффект дважды — ответ
 *  один и тот же, второй ответ тех же строк не портит. */
export function useChatList(): { rows: ChatRow[]; refresh: () => void; replace: (rows: ChatRow[]) => void } {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const refresh = useCallback(() => {
    chatList()
      .then(setRows)
      .catch(() => {
        // Списка нет: сайдбар показывает то, что передало окно, без поломки.
      });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return { rows, refresh, replace: setRows };
}
