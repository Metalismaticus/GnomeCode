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
 *  время чата несёт хвост первой линии и группу дат. Титул есть — активная
 *  строка сверху, история под ней: до ответа списка ядра сайдбар показывает
 *  те же строки, что и до вопроса, — фиксёрные строки несёт панель и в живом
 *  окне, настоящий список заменит их с ответом `chat_list`. */export function chatsList(data: ReturnType<typeof panels>, title: string, time: number | null): SidebarChat[] {
  if (title) {
    // Активная строка — настоящий чат окна; фиксёрные строки идут историей
    // без своей пометки «активный» (она у строки панели — не у этого чата).
    const history = data.chats
      .filter((chat) => chat.title !== title)
      .map((chat) => ({ ...chat, active: undefined }));
    return freshAbove([{ title, active: true, ...(time ? { time } : {}) }, ...history]);
  }
  return freshAbove(data.chats);
}

/** Живой список ядра поверх того, что окно уже показывает (спека сайдбара §7):
 *  строки истории — из загруженных сессий (название и время обновления, превью
 *  в списке ядра нет — строки без второй линии); идентификатор строки ведёт
 *  клик — старый чат открывается переключением сессии. Активный чат окна
 *  остаётся активным, совпавший с ним по титулу в истории не дублируется.
 *  Список ядра не дошёл — сайдбар живёт тем, что есть. */
export function chatsWithLive(known: SidebarChat[], live: ChatRow[]): SidebarChat[] {
  if (!live.length) {
    return known;
  }
  const active = known.find((chat) => chat.active);
  const history = live
    .filter((row) => row.title !== active?.title)
    .map((row) => ({ id: row.id, title: row.title, ...(row.updated ? { time: row.updated } : {}) }));
  return freshAbove(active ? [active, ...history] : history);
}
