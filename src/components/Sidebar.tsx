import type { Theme } from "../viewparams";
import { MONTHS } from "../compare";
import { Button } from "./Button";
import { SidebarItem } from "./SidebarItem";
import { SettingsGlyph } from "./glyphs";
import { ThemeSwitch } from "./ThemeSwitch";

import logoMark from "../../docs/refs/owner-2026-10-05-4-logo.png";

import "./Sidebar.css";

export type SidebarProject = { title: string; path?: string };
export type SidebarChat = { title: string; active?: boolean; time?: number };

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

/** Вторая линия строки чата — время (спека «Тексты»): сегодня — часы и минуты,
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

/** Группы чатов по датам в порядке ленты: группа без чатов не рисуется. */
function groupsOf(chats: SidebarChat[], now: number): { title: string; chats: SidebarChat[] }[] {
  const order = ["СЕГОДНЯ", "ВЧЕРА", "НА ЭТОЙ НЕДЕЛЕ", "РАНЕЕ"];
  return order
    .map((title) => ({ title, chats: chats.filter((chat) => chatGroupOf(chat.time, now) === title) }))
    .filter((group) => group.chats.length > 0);
}

/** Левая колонка: логотип, быстрые действия («+ Новый проект», «Новый чат»,
 *  «Плагины», «Настройки»), разделы «Проекты»/«Чаты» с датами, подвал. Строка
 *  списка и её состояние «активный» — SidebarItem. */
export function Sidebar({
  projects,
  chats,
  theme,
  onToggleTheme,
  onPickFolder,
  onOpenPlugins,
  onOpenSettings,
  settingsOpen,
  onOpenChat,
  onNewChat,
}: {
  projects: SidebarProject[];
  chats: SidebarChat[];
  theme: Theme;
  onToggleTheme: () => void;
  /** Выбор папки проекта системным диалогом — кнопка «+ Новый проект». */
  onPickFolder: () => void;
  /** Раздел «Плагины» из главной левой навигации (docs/SPEC/plugins.md, сцена A). */
  onOpenPlugins: () => void;
  /** Страница настроек из главной левой навигации (docs/specs/2026-10-06-12-nastrojki.md). */
  onOpenSettings: () => void;
  /** Страница настроек открыта: шестерёнка подсвечена постоянно (aria-current="page"). */
  settingsOpen: boolean;
  /** Возврат в чат кликом по строке чата: страница раздела размонтируется. */
  onOpenChat: () => void;
  /** «Новый чат»: лента чистится, движку поднимается новая сессия (замечание
   *  владельца 2026-10-06 — карточку «Новый чат» не нажать). */
  onNewChat: () => void;
}) {
  const now = Date.now();
  const groups = groupsOf(chats, now);
  return (
    <nav className="sidebar" data-testid="sidebar">
      <div className="sidebar__logo">
        <img className="sidebar__logo-mark" src={logoMark} alt="GnomeCode" />
        <span className="sidebar__logo-name">GnomeCode</span>
      </div>
      <Button variant="primary" data-testid="btn-primary" onClick={onPickFolder}>
        + Новый проект
      </Button>
      <Button variant="ghost" data-testid="btn-new-chat" onClick={onNewChat}>
        Новый чат
      </Button>
      <SidebarItem title="Плагины" testid="sidebar-plugins" onClick={onOpenPlugins} />
      <SidebarItem
        title="Настройки"
        glyph={<SettingsGlyph />}
        testid="sidebar-settings"
        active={settingsOpen}
        page
        onClick={onOpenSettings}
      />
      <div className="sidebar__lists">
        <div className="sidebar__section-title">Проекты</div>
        {projects.length ? (
          projects.map((project) => (
            <SidebarItem
              key={project.title}
              title={project.title}
              sub={project.path}
              testid="sidebar-project"
            />
          ))
        ) : (
          <SidebarItem title="Пока нет проектов" />
        )}
        <div className="sidebar__section-title">Чаты</div>
        {groups.length ? (
          groups.map((group) => (
            <div key={group.title}>
              <div className="sidebar__section-title">{group.title}</div>
              {group.chats.map((chat) => (
                <SidebarItem
                  key={chat.title}
                  title={chat.title}
                  sub={chatTimeOf(chat, now)}
                  active={chat.active}
                  testid={chat.active ? "chat-active" : undefined}
                  onClick={chat.active ? onOpenChat : undefined}
                />
              ))}
            </div>
          ))
        ) : (
          <SidebarItem title="Пока нет чатов" />
        )}
      </div>
      <div className="sidebar__footer">
        <span className="sidebar__avatar">Г</span>
        <span className="sidebar__owner">Владелец</span>
        <ThemeSwitch theme={theme} onToggle={onToggleTheme} testid="theme-switch-sidebar" />
      </div>
    </nav>
  );
}
