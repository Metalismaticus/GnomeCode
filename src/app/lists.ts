import type { panels } from "../fixture";
import type { ChatRow } from "../bridge";
import type { SidebarChat, SidebarProject } from "../components/Sidebar";

/** Проекты сайдбара: настоящая папка проекта, когда она есть, иначе фикстура.
 *  Название — папка, вторая линия — полный путь (спека «Двухстрочные строки»). */
function baseName(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

export function projectsList(data: ReturnType<typeof panels>, root: string): SidebarProject[] {
  if (root) {
    return [{ title: baseName(root), path: root }];
  }
  return data.projects;
}

/** Свежее выше — одно место сортировки списка чатов (спека сайдбара §9):
 *  порядок внутри группы дат строится на нём; чат без времени — как самый старый. */
function freshAbove(chats: SidebarChat[]): SidebarChat[] {
  return [...chats].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
}

/** Чаты сайдбара: настоящий титул, когда он есть, иначе фиксёрный список;
 *  время чата несёт хвост первой линии и группу дат. */
export function chatsList(data: ReturnType<typeof panels>, title: string, time: number | null): SidebarChat[] {
  if (title) {
    return freshAbove([{ title, active: true, ...(time ? { time } : {}) }]);
  }
  return freshAbove(data.chats);
}

/** Живой список ядра поверх того, что окно уже показывает (спека сайдбара §7):
 *  строки истории — из загруженных сессий (название и время обновления, превью
 *  в списке ядра нет — строки без второй линии); активный чат окна остаётся
 *  активным, совпавший с ним по титулу в истории не дублируется. Список ядра
 *  не дошёл — сайдбар живёт тем, что есть. */
export function chatsWithLive(known: SidebarChat[], live: ChatRow[]): SidebarChat[] {
  if (!live.length) {
    return known;
  }
  const active = known.find((chat) => chat.active);
  const history = live
    .filter((row) => row.title !== active?.title)
    .map((row) => ({ title: row.title, ...(row.updated ? { time: row.updated } : {}) }));
  return freshAbove(active ? [active, ...history] : history);
}
