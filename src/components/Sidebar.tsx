import type { Theme } from "../viewparams";
import { Button } from "./Button";
import { SidebarItem } from "./SidebarItem";
import { ThemeSwitch } from "./ThemeSwitch";

import "./Sidebar.css";

export type SidebarChat = { title: string; active?: boolean };

/** Левая колонка: логотип, главная кнопка, разделы «Проекты»/«Чаты», подвал.
 *  Строка списка и её состояние «активный» — SidebarItem. */
export function Sidebar({
  projects,
  chats,
  theme,
  onToggleTheme,
}: {
  projects: string[];
  chats: SidebarChat[];
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <nav className="sidebar" data-testid="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-mark">G</span>
        <span className="sidebar__logo-name">GnomeCode</span>
      </div>
      <Button variant="primary" data-testid="btn-primary">
        + Новый проект
      </Button>
      <Button variant="ghost" data-testid="btn-new-chat">
        Новый чат
      </Button>
      <div className="sidebar__lists">
        <div className="sidebar__section-title">Проекты</div>
        {projects.length ? (
          projects.map((title) => <SidebarItem key={title} title={title} />)
        ) : (
          <SidebarItem title="Пока нет проектов" />
        )}
        <div className="sidebar__section-title">Чаты</div>
        {chats.length ? (
          chats.map((chat) => (
            <SidebarItem
              key={chat.title}
              title={chat.title}
              active={chat.active}
              testid={chat.active ? "chat-active" : undefined}
            />
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