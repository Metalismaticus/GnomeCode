// Строка чата сайдбара с меню действий: клик открывает чат, правый щелчок или
// «⋯» у правого края открывают меню — переименовать, в архив, удалить
// (замечание владельца 2026-10-10: «пкм и всплывающее меню с переименованием,
// удалением, архивация»). Переименование — поле в самой строке: Enter или
// потеря фокуса принимают, Esc отменяет. Удаление спрашивает подтверждение
// там же, в меню: историю чата не вернуть.

import { useState } from "react";

import { chatTimeOf } from "../app/chatTime";
import type { SidebarChat } from "./Sidebar";
import { ChatGlyph } from "./glyphs";
import { SidebarItem } from "./SidebarItem";
import { MenuItem, RowMenu, type MenuSpot } from "./RowMenu";

import "./SidebarRow.css";

export type ChatRowProps = {
  chat: SidebarChat;
  /** Местное «сейчас» для времени строки — его считает Sidebar (одно на список). */
  now: number;
  /** Чат закреплён (раздел «Закреплённые»): пункт меню — «Открепить». */
  pinned?: boolean;
  /** Закрепить или открепить: раздел сверху / обычные группы дат. */
  onTogglePin?: () => void;
  /** Клик по строке этого чата: сессия переключается, лента показывает его историю. */
  onOpen: () => void;
  /** Активный чат: клик только возвращает на страницу чата (сессия та же). */
  onReturn?: () => void;
  /** Новое название принято: уходит мосту, список перечитывается. */
  onRename: (title: string) => void;
  /** Убрать в архив: строка уходит из списка в «Архив», сессия в ядре жива. */
  onArchive: () => void;
  /** Удалить чат совсем — после подтверждения в меню. */
  onDelete: () => void;
  /** DnD (B8): строку можно перетащить в корзину внизу сайдбара. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

export function ChatRow({ chat, now, pinned, onTogglePin, onOpen, onReturn, onRename, onArchive, onDelete, onDragStart, onDragEnd }: ChatRowProps) {
  /** Точка открытия меню: правый щелчок по строке или кнопка «⋯». */
  const [spot, setSpot] = useState<MenuSpot | null>(null);
  /** Меню в шаге подтверждения удаления — вопрос вместо пунктов. */
  const [confirming, setConfirming] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(chat.title);

  const openAt = (at: MenuSpot) => {
    setConfirming(false);
    setSpot(at);
  };
  const close = () => setSpot(null);

  /** Принять переименание: пустое название — отмена, а не стирание имени. */
  const accept = () => {
    setRenaming(false);
    const next = draft.trim();
    if (next && next !== chat.title) {
      onRename(next);
    }
  };

  if (renaming) {
    return (
      <div className="sidebar-row">
        <input
          className="sidebar-row__rename"
          data-testid="chat-rename-input"
          aria-label="Новое название чата"
          value={draft}
          autoFocus
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              accept();
            }
            if (event.key === "Escape") {
              setRenaming(false);
            }
          }}
          onBlur={accept}
        />
      </div>
    );
  }

  return (
    <div
      className="sidebar-row"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", chat.id ?? "");
        event.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      onContextMenu={(event) => {
        event.preventDefault();
        openAt({ x: event.clientX, y: event.clientY });
      }}
    >
      <SidebarItem
        title={chat.title}
        end={chatTimeOf(chat, now)}
        sub={chat.preview}
        active={chat.active}
        glyph={<ChatGlyph className="chat-row__glyph" />}
        testid={chat.active ? "chat-active" : chat.id ? "chat-row" : undefined}
        onClick={chat.active ? (onReturn ?? onOpen) : onOpen}
      />
      <button
        type="button"
        className="sidebar-row__more"
        data-testid="chat-row-more"
        title="Действия с чатом"
        aria-label="Действия с чатом"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          openAt({ x: box.left - 180, y: box.bottom + 4 });
        }}
      >
        ⋯
      </button>
      {spot ? (
        <RowMenu spot={spot} onClose={close}>
          {confirming ? (
            <div className="row-menu__ask" data-testid="chat-delete-confirm">
              <div className="row-menu__text">Удалить чат «{chat.title}»? Историю не вернуть.</div>
              <div className="row-menu__actions">
                <button
                  type="button"
                  className="row-menu__btn"
                  data-testid="chat-delete-no"
                  onClick={close}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="row-menu__btn row-menu__btn--danger"
                  data-testid="chat-delete-yes"
                  onClick={() => {
                    onDelete();
                    close();
                  }}
                >
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuItem
                label={pinned ? "Открепить" : "Закрепить"}
                onPick={() => {
                  onTogglePin?.();
                  close();
                }}
              />
              <MenuItem
                label="Переименовать"
                onPick={() => {
                  setDraft(chat.title);
                  setRenaming(true);
                  close();
                }}
              />
              <MenuItem label="В архив" onPick={() => { onArchive(); close(); }} />
              <MenuItem
                label="Удалить"
                danger
                onPick={() => setConfirming(true)}
              />
            </>
          )}
        </RowMenu>
      ) : null}
    </div>
  );
}
