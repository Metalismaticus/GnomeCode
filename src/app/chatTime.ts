// Время и группы чатов сайдбара — одно место на список: строка (ChatRow),
// группы (Sidebar) и будущие экраны читают одно правило, а не копии.
// Живёт отдельным файлом: Sidebar тянет ChatRow (меню строки), и обратный
// импорт времени сделал бы круг модулей.

import { MONTHS } from "../compare";
import type { SidebarChat } from "../components/Sidebar";

const DAY = 24 * 60 * 60 * 1000;

/** Местная полночь метки времени: группы считаются по локальной дате, не по часам. */
const localDay = (ms: number): number => {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

/** Название группы чата по её дате (спека «Состав основы»): сегодня, вчера,
 *  последние 7 дней, старше. Чат без времени — «РАНЕЕ». Одно место решает,
 *  в какой группе строка; теперь — момент снимка страницы, для проверки. */
export function chatGroupOf(time: number | undefined, now: number): string {
  if (!time) {
    return "РАНЕЕ";
  }
  const passed = (localDay(now) - localDay(time)) / DAY;
  if (passed <= 0) {
    return "СЕГОДНЯ";
  }
  if (passed === 1) {
    return "ВЧЕРА";
  }
  return passed < 7 ? "НА ЭТОЙ НЕДЕЛЕ" : "РАНЕЕ";
}

/** Хвост первой линии — время (спека сайдбара §4): сегодня — часы и минуты,
 *  вчера — «Вчера», старше — день и месяц кратко. */
export function chatTimeOf(chat: SidebarChat, now: number): string {
  if (!chat.time) {
    return "";
  }
  const passed = (localDay(now) - localDay(chat.time)) / DAY;
  if (passed <= 0) {
    const date = new Date(chat.time);
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  }
  if (passed === 1) {
    return "Вчера";
  }
  const date = new Date(chat.time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}
