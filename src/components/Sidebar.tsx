import { useEffect, useRef, useState, type RefObject } from "react";

import { params } from "../viewparams";
import { chatsWithLive } from "../app/lists";
import { chatGroupOf, chatTimeOf } from "../app/chatTime";
import type { ChatActions } from "../features/chat/useChatActions";
import { panels } from "../fixture";
import { ChatRow } from "./ChatRow";
import { SidebarItem } from "./SidebarItem";
import { MenuItem, RowMenu, type MenuSpot } from "./RowMenu";


import "./Sidebar.css";
import "./SidebarRow.css";
import "./RowMenu.css";

export type SidebarProject = { title: string; path?: string; cost?: string };
/** Чат сайдбара: `id` стоит у строк с ядром за ними — клик открывает чат;
 *  строка без него (фиксёрная) — отображение. */
export type SidebarChat = { id?: string; title: string; active?: boolean; time?: number; preview?: string };

/** Группы чатов по датам в порядке ленты: группа без чатов не рисуется —
 *  и при поиске тоже, дата-контекст найденного сохраняется (спека сайдбара §5). */
function groupsOf(chats: SidebarChat[], now: number): { title: string; chats: SidebarChat[] }[] {
  const order = ["СЕГОДНЯ", "ВЧЕРА", "НА ЭТОЙ НЕДЕЛЕ", "РАНЕЕ"];
  return order
    .map((title) => ({
      title,
      chats: chats.filter((chat) => chatGroupOf(chat.time, now) === title),
    }))
    .filter((group) => group.chats.length > 0);
}

/** Поиск по чатам — подстрока без регистра по названию и превью (спека §5);
 *  у живых строк ядра превью нет (спека §7) — там ищет титул, у строк с
 *  превью — и оно. Проекты и навигацию не трогает. */
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

/** Строка проекта с меню: правый щелчок или «⋯» — «Сменить папку…» и «Убрать
 *  проект» (замечание владельца 2026-10-10: «удаление … проектов»). Папка на
 *  диске не трогается — убирается только из окна. */
function ProjectRow({
  project,
  engineDown,
  onPickFolder,
  onRemove,
}: {
  project: SidebarProject;
  engineDown: boolean;
  onPickFolder: () => void;
  onRemove: () => void;
}) {
  const [spot, setSpot] = useState<MenuSpot | null>(null);
  const close = () => setSpot(null);
  return (
    <div
      className="sidebar-row"
      onContextMenu={(event) => {
        event.preventDefault();
        setSpot({ x: event.clientX, y: event.clientY });
      }}
    >
      <SidebarItem
        title={project.title}
        glyph={avatar(project.title, engineDown)}
        sub={project.path}
        sub2={project.cost ? `Этот проект стоил ${project.cost}` : undefined}
        testid="sidebar-project"
      />
      <button
        type="button"
        className="sidebar-row__more"
        data-testid="sidebar-project-more"
        title="Действия с проектом"
        aria-label="Действия с проектом"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          setSpot({ x: box.left - 180, y: box.bottom + 4 });
        }}
      >
        ⋯
      </button>
      {spot ? (
        <RowMenu spot={spot} onClose={close}>
          <MenuItem label="Сменить папку…" onPick={() => { onPickFolder(); close(); }} />
          <MenuItem label="Убрать проект" danger onPick={() => { onRemove(); close(); }} />
        </RowMenu>
      ) : null}
    </div>
  );
}

/** Тело раздела «Чаты» (спека сайдбара §5/§7): группы дат со строками; список
 *  пуст — «Пока нет чатов», поиск без совпадений — «Ничего не нашлось». Строка
 *  с ядром за ней (id) — кнопка открытия с меню действий, активная — возврат
 *  на экран чата; фиксёрная строка — отображение (§15: «нажать нельзя»). */
function chatRows(
  all: SidebarChat[],
  visible: SidebarChat[],
  now: number,
  actions: ChatActions,
  onOpenChat: () => void,
  onOpenChatRow: (chat: SidebarChat) => void,
  onRenameChat: (id: string, title: string, wasActive: boolean) => void,
  onDeleteChat: (id: string, wasActive: boolean) => void,
  pinnedIds: string[],
  onTogglePin: (id: string) => void,
) {
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
      {group.chats.map((chat) =>
        chat.id ? (
          <ChatRow
            key={chat.id}
            chat={chat}
            now={now}
            pinned={pinnedIds.includes(chat.id)}
            onTogglePin={() => onTogglePin(chat.id as string)}
            onOpen={() => onOpenChatRow(chat)}
            onReturn={onOpenChat}
            onRename={(title) => onRenameChat(chat.id as string, title, Boolean(chat.active))}
            onArchive={() => actions.archive(chat.id as string)}
            onDelete={() => onDeleteChat(chat.id as string, Boolean(chat.active))}
          />
        ) : (
          <SidebarItem
            key={chat.title}
            title={chat.title}
            end={chatTimeOf(chat, now)}
            sub={chat.preview}
          />
        ),
      )}
    </div>
  ));
}

/** Раздел «Архив»: чаты, убранные из списка, но живые в ядре. Строка-заголовок
 *  со счётом раскрывает список; у строк — «Вернуть» и «Удалить» (совсем).
 *  Пустой архив строки не показывает: честное «нечего показывать» — ничего. */
function archiveSection(
  rows: SidebarChat[],
  archived: string[],
  open: boolean,
  toggle: () => void,
  actions: ChatActions,
) {
  const held = rows.filter((row) => row.id !== undefined && archived.includes(row.id));
  if (!held.length && !open) {
    return null;
  }
  return (
    <div className="sidebar-archive">
      <button
        type="button"
        className="sidebar-item sidebar-archive__head"
        data-testid="sidebar-archive"
        aria-expanded={open}
        onClick={toggle}
      >
        <span className="sidebar-item__line">
          <span className="sidebar-item__title">Архив</span>
          {held.length ? <span className="sidebar-item__end">{held.length}</span> : null}
        </span>
      </button>
      {open
        ? held.map((row) => (
            <div className="sidebar-row sidebar-row--archived" key={row.id} data-testid="sidebar-archive-row">
              <span className="sidebar-row__archived-title" title={row.title}>
                {row.title}
              </span>
              <button
                type="button"
                className="sidebar-row__mini"
                data-testid="archive-unarchive"
                onClick={() => row.id && actions.unarchive(row.id)}
              >
                Вернуть
              </button>
              <button
                type="button"
                className="sidebar-row__mini sidebar-row__mini--danger"
                data-testid="archive-delete"
                onClick={() => row.id && actions.remove(row.id)}
              >
                Удалить
              </button>
            </div>
          ))
        : null}
    </div>
  );
}

/** Левая колонка: логотип, поиск по чатам, быстрые действия («+ Новый проект»,
 *  «Новый чат», «Статистика»), разделы «Проекты»/«Чаты» с датами и архивом,
 *  подвал с общими настройками. Строка списка и её состояние «активный» —
 *  SidebarItem. */
export function Sidebar({
  projects,
  chats,
  onPickFolder,
  onRemoveProject,
  onOpenChat,
  onOpenChatRow,
  onRenameChat,
  onDeleteChat,
  onTogglePin,
  pinnedIds,
  onNewChat,
  chatActions,
}: {
  projects: SidebarProject[];
  chats: SidebarChat[];
  /** Выбор папки проекта системным диалогом — кнопка «+ Новый проект». */
  onPickFolder: () => void;
  /** Убрать проект: меню строки проекта, папка на диске остаётся. */
  onRemoveProject: () => void;
  /** Возврат в чат кликом по строке чата: страница раздела размонтируется. */
  onOpenChat: () => void;
  /** Открыть старый чат кликом по строке истории: сессия переключается,
   *  лента показывает его переписку (слова владельца 2026-10-10). */
  onOpenChatRow: (chat: SidebarChat) => void;
  /** Переименовать чат: заголовок меняется в движке; был открыт — титул
   *  окна едет за ним (шапка и строка сайдбара покажут новое имя). */
  onRenameChat: (id: string, title: string, wasActive: boolean) => void;
  /** Удалить чат совсем; был открыт — титул окна снимается, следующий вопрос
   *  начнёт новый чат. */
  onDeleteChat: (id: string, wasActive: boolean) => void;
  /** Закрепить или открепить чат (замечание владельца 14.10): раздел
   *  «Закреплённые» поверх групп дат. */
  onTogglePin: (id: string) => void;
  /** Закреплённые чаты: идентификаторы из состояния окна. */
  pinnedIds: string[];
  /** «Новый чат»: лента чистится, движку поднимается новая сессия (замечание
   *  владельца 2026-10-06 — карточку «Новый чат» не нажать). */
  onNewChat: () => void;
  /** Чаты и действия над ними: живой список, архив, переименование и удаление. */
  chatActions: ChatActions;
}) {
  const now = Date.now();
  /** Ctrl+K (концепт B10): из любого места окна фокус уходит в поиск чатов. */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        (document.querySelector('[data-testid="sidebar-search"]') as HTMLElement | null)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  /** Поиск живёт в самом поле: кадры поиска приходят адресом (`?поиск=`),
   *  дальше поле ведёт себя как обычный ввод. */
  const [query, setQuery] = useState(params.search);
  const searchRef = useRef<HTMLInputElement>(null);
  /** Раскрытый архив: строка-заголовок со счётом, один раскрытый список. */
  const [archiveOpen, setArchiveOpen] = useState(false);
  /** Движок не отвечает: точка аватара проекта краснеет (спека сайдбара §6).
   *  Источник тот же, что у «Не отвечает» правой панели, — panels состояния
   *  страницы; своего второго правды о движке сайдбар не заводит. */
  const engineDown = panels(params.feed).engineDown;
  const merged = chatsWithLive(chats, chatActions.rows);
  const all = merged.filter(
    (chat) => !chat.id || !chatActions.archived.includes(chat.id),
  );
  /** Закреплённые поверх (замечание владельца 14.10): раздел до групп дат;
   *  в самих группах закреплённая строка не дублируется. */
  const pinned = all.filter((chat) => chat.id !== undefined && pinnedIds.includes(chat.id));
  const loose = all.filter((chat) => chat.id === undefined || !pinnedIds.includes(chat.id));
  const visiblePinned = pinned.filter((chat) => matches(chat, query));
  const visible = loose.filter((chat) => matches(chat, query));
  return (
    <nav className="sidebar" data-testid="sidebar">
      {/* Шапка колонки «Чаты» (B10): заголовок, «+» новый чат и архив-кнопка.
          Логотип и разделы переехали в icon-rail. */}
      <div className="sidebar__head">
        <span className="sidebar__head-title">Чаты</span>
        <span className="sidebar__head-actions">
          <button
            type="button"
            className="sidebar__head-btn"
            data-testid="sidebar-new-chat"
            title="Новый чат"
            onClick={onNewChat}
          >
            +
          </button>
          <button
            type="button"
            className="sidebar__head-btn"
            data-testid="sidebar-archive-toggle"
            title="Показать архив"
            onClick={() => setArchiveOpen((open) => !open)}
          >
            🗄
          </button>
        </span>
      </div>
      {searchField(query, setQuery, searchRef)}
      <div className="sidebar__lists">
        <div className="sidebar__section-title">Проекты</div>
        {projects.length ? (
          projects.map((project) => (
            <ProjectRow
              key={project.title}
              project={project}
              engineDown={engineDown}
              onPickFolder={onPickFolder}
              onRemove={onRemoveProject}
            />
          ))
        ) : (
          <SidebarItem title="Пока нет проектов" />
        )}
        {visiblePinned.length ? (
          <>
            <div className="sidebar__section-title">Закреплённые</div>
            {chatRows(all, visiblePinned, now, chatActions, onOpenChat, onOpenChatRow, onRenameChat, onDeleteChat, pinnedIds, onTogglePin)}
          </>
        ) : null}
        <div className="sidebar__section-title">Чаты</div>
        {chatRows(all, visible, now, chatActions, onOpenChat, onOpenChatRow, onRenameChat, onDeleteChat, pinnedIds, onTogglePin)}
        {/* Архив — про поиск молчит: поиск ищет чаты, архив своя полка. */}
        {query.trim()
          ? null
          : archiveSection(
              merged,
              chatActions.archived,
              archiveOpen,
              () => setArchiveOpen((open) => !open),
              chatActions,
            )}
      </div>
    </nav>
  );
}
