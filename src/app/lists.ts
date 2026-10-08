import type { panels } from "../fixture";
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

/** Чаты сайдбара: настоящий титул, когда он есть, иначе фиксёрный список;
 *  время чата несёт вторую линию и группу дат. */
export function chatsList(data: ReturnType<typeof panels>, title: string, time: number | null): SidebarChat[] {
  if (title) {
    return [{ title, active: true, ...(time ? { time } : {}) }];
  }
  return data.chats;
}
