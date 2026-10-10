import { useRef, useState, type RefObject } from "react";

import type { Theme } from "../viewparams";
import { params } from "../viewparams";
import { chatsWithLive } from "../app/lists";
import { useChatList } from "../app/useChatList";
import { panels } from "../fixture";
import { MONTHS } from "../compare";
import { Button } from "./Button";
import { SidebarItem } from "./SidebarItem";
import { SettingsGlyph } from "./glyphs";
import { ThemeSwitch } from "./ThemeSwitch";

import logoMark from "../../docs/refs/owner-2026-10-05-3-icon.png";

import "./Sidebar.css";

export type SidebarProject = { title: string; path?: string; cost?: string };
export type SidebarChat = { title: string; active?: boolean; time?: number; preview?: string };

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

/** Группы чатов по датам в порядке ленты: группа без чатов не рисуется —
 *  и при поиске тоже, дата-контекст найденного сохраняется (спека сайдбара §5). */
function groupsOf(chats: SidebarChat[], now: number): { title: string; chats: SidebarChat[] }[] {
  const order = ["СЕГОДНЯ", "ВЧЕРА", "НА ЭТОЙ НЕДЕЛЕ", "РАНЕЕ"];
  return order
    .map((title) => ({ title, chats: chats.filter((chat) => chatGroupOf(chat.time, now) === title) }))
    .filter((group) => group.chats.length > 0);
}

/** Поиск по чатам — подстрока без регистра по названию и превью (спека §5);
 *  превью в данных нет — по названию. Проекты и навигацию не трогает. */
function matches(chat: SidebarChat, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return chat.title.toLowerCase().includes(needle) || (chat.preview ?? "").toLowerCase().includes(needle);
}

const SEARCH_PLACEHOLDER = "Поиск по чатам…";

/** Поле поиска по чатам — первый контрол после логотипа (спека сайдбара §3/§5):
 *  рецепт готового поиска, ✕ видна только при тексте. Esc — жест самого поля:
 *  чистит текст, повторный снимает фокус. */
function searchField(query: string, onQuery: (next: string) => void, input: RefObject<HTMLInputElement>) {
  return (
    <div className="sidebar__search">
      <input
        ref={input}
        className="sidebar__search-input"
        data-testid="sidebar-search"
        type="text"
        placeholder={SEARCH_PLACEHOLDER}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") {
            return;
          }
          if (query) {
            onQuery("");
          } else {
            input.current?.blur();
          }
        }}
      />
      {query ? (
        <button
          type="button"
          className="sidebar__search-clear"
          data-testid="sidebar-search-clear"
          title="Очистить"
          aria-label="Очистить"
          onClick={() => {
            onQuery("");
            input.current?.focus();
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}

/** Аватар проекта — буква в квадрате с точкой состояния движка (спека сайдбара
 *  §6): статусные цвета, не акцент; своей второй правды о движке здесь нет. */
function avatar(title: string, engineDown: boolean) {
  return (
    <span className="sidebar-item__avatar" aria-hidden="true">
      {title.slice(0, 1).toUpperCase()}
      <span
        className={`sidebar-item__avatar-dot${engineDown ? " sidebar-item__avatar-dot--down" : ""}`}
        data-testid="sidebar-project-dot"
      />
    </span>
  );
}

/** Тело раздела «Чаты» (спека сайдбара §5/§7): группы дат со строками; список
 *  пуст — «Пока нет чатов», поиск без совпадений — «Ничего не нашлось». */
function chatRows(all: SidebarChat[], visible: SidebarChat[], now: number, onOpenChat: () => void) {
  if (!all.length) {
    return <SidebarItem title="Пока нет чатов" />;
  }
  const groups = groupsOf(visible, now);
  if (!groups.length) {
    return (
      <div className="sidebar__none" data-testid="sidebar-search-none">
        Ничего не нашлось
      </div>
    );
  }
  return groups.map((group) => (
    <div key={group.title}>
      <div className="sidebar__section-title">{group.title}</div>
      {group.chats.map((chat) => (
        <SidebarItem
          key={chat.title}
          title={chat.title}
          end={chatTimeOf(chat, now)}
          sub={chat.preview}
          active={chat.active}
          testid={chat.active ? "chat-active" : undefined}
          onClick={chat.active ? onOpenChat : undefined}
        />
      ))}
    </div>
  ));
}

/** Левая колонка: логотип, поиск по чатам, быстрые действия («+ Новый проект»,
 *  «Новый чат», «Плагины», «Настройки»), разделы «Проекты»/«Чаты» с датами,
 *  подвал. Строка списка и её состояние «активный» — SidebarItem. */
export function Sidebar({
  projects,
  chats,
  theme,
  onToggleTheme,
  onPickFolder,
  onOpenPlugins,
  onOpenStats,
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
  /** Раздел «Статистика» из главной левой навигации (docs/BATCH.md, пункт 2). */
  onOpenStats: () => void;
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
  /** Поиск живёт в самом поле: кадры поиска приходят адресом (`?поиск=`),
   *  дальше поле ведёт себя как обычный ввод. */
  const [query, setQuery] = useState(params.search);
  const searchRef = useRef<HTMLInputElement>(null);
  /** Живой список ядра: строки истории — из загруженных сессий движка одним
   *  запросом при старте (спека сайдбара §7); не дошёл — сайдбар живёт тем,
   *  что передало окно. */
  const live = useChatList();
  /** Движок не отвечает: точка аватара проекта краснеет (спека сайдбара §6).
   *  Источник тот же, что у «Не отвечает» правой панели, — panels состояния
   *  страницы; своего второго правды о движке сайдбар не заводит. */
  const engineDown = panels(params.feed).engineDown;
  const all = chatsWithLive(chats, live);
  const visible = all.filter((chat) => matches(chat, query));
  return (
    <nav className="sidebar" data-testid="sidebar">
      <div className="sidebar__logo">
        <img className="sidebar__logo-mark" src={logoMark} alt="GnomeCode" />
        <span className="sidebar__logo-name">GnomeCode</span>
      </div>
      {searchField(query, setQuery, searchRef)}
      <Button variant="primary" data-testid="btn-primary" onClick={onPickFolder}>
        + Новый проект
      </Button>
      <Button variant="ghost" data-testid="btn-new-chat" onClick={onNewChat}>
        Новый чат
      </Button>
      <SidebarItem title="Плагины" testid="sidebar-plugins" onClick={onOpenPlugins} />
      <SidebarItem title="Статистика" testid="sidebar-stats" onClick={onOpenStats} />
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
              glyph={avatar(project.title, engineDown)}
              sub={project.path}
              sub2={project.cost ? `Этот проект стоил ${project.cost}` : undefined}
              testid="sidebar-project"
            />
          ))
        ) : (
          <SidebarItem title="Пока нет проектов" />
        )}
        <div className="sidebar__section-title">Чаты</div>
        {chatRows(all, visible, now, onOpenChat)}
      </div>
      <div className="sidebar__footer">
        <span className="sidebar__avatar">Г</span>
        <span className="sidebar__owner">Владелец</span>
        <ThemeSwitch theme={theme} onToggle={onToggleTheme} testid="theme-switch-sidebar" />
      </div>
    </nav>
  );
}
