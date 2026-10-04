import { useEffect, useState } from "react";

import { useFeed } from "./chat";
import type { FeedRow } from "./bridge";

type Theme = "dark" | "light";

/** Каркас трёх колонок по референсам: сайдбар · чат · правая панель.
 *  Содержимое — заготовки Этапа 1; живые системы приходят пунктами очереди. */
export default function App() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="app">
      <Sidebar />
      <ChatView theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <ContextPanel />
    </div>
  );
}

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar__logo">
        <span className="sidebar__logo-mark">G</span>
        GnomeCode
      </div>
      <button className="btn btn--primary">+ Новый проект</button>
      <button className="btn btn--ghost">Новый чат</button>
      <div>
        <div className="sidebar__section-title">Проекты</div>
        <button className="sidebar__item">Пока нет проектов</button>
        <div className="sidebar__section-title">Чаты</div>
        <button className="sidebar__item">Пока нет чатов</button>
      </div>
      <div className="sidebar__footer">
        <span className="sidebar__avatar">Г</span>
        Владелец
      </div>
    </nav>
  );
}

function ChatView({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const [draft, setDraft] = useState("");
  const { rows, error, send } = useFeed();

  const ask = (text: string) => {
    setDraft("");
    void send(text);
  };

  return (
    <main className="chat">
      <header className="chat__header">
        <span className="chat__title">Новый чат</span>
        {/* Кнопки подключённых плагинов — слова владельца: «выводятся над чатом».
            Живое подключение — пункт «Плагины из чата» Этапа 1. */}
        <span className="badge">GLM-5.3 High</span>
        <button className="btn btn--ghost" onClick={onToggleTheme}>
          {theme === "dark" ? "☀ Светлая" : "☾ Тёмная"}
        </button>
      </header>
      <div className="chat__messages" data-testid="feed">
        {rows.length ? (
          <Feed rows={rows} />
        ) : (
          <div className="empty">
            <div className="empty__title">Новый чат</div>
            <div className="empty__subtitle">
              Опишите задачу, приложите файл или выберите сценарий
            </div>
            <div className="empty__cards">
              <button className="empty__card">Прототипировать идею</button>
              <button className="empty__card">Проверить код</button>
              <button className="empty__card">Открыть проект</button>
            </div>
          </div>
        )}
        {error ? <div className="feed__notice">{error}</div> : null}
      </div>
      <div className="composer">
        <div className="composer__box">
          <button className="composer__add" title="Добавить">+</button>
          <textarea
            className="composer__input"
            data-testid="composer"
            placeholder="Напишите сообщение… (Ctrl + Enter — отправить)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                ask(draft);
              }
            }}
          />
          <button className="composer__send" data-testid="send" title="Отправить" onClick={() => ask(draft)}>↑</button>
        </div>
        <div className="composer__hint">Enter — перенос строки · Ctrl + Enter — отправить</div>
      </div>
    </main>
  );
}

/** Лента: строки по порядку, вид строки — по её роли в разговоре. */
function Feed({ rows }: { rows: FeedRow[] }) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} className={`feed__row feed__row--${row.kind}`} data-kind={row.kind}>
          {row.text || "…"}
        </div>
      ))}
    </>
  );
}

function ContextPanel() {
  return (
    <aside className="context">
      <div className="context__header">Контекст проекта</div>
      <div className="context__section">
        <div className="context__section-title">Проект</div>
        <div className="context__row">
          <span>Папка не выбрана</span>
          <span className="context__row-value">—</span>
        </div>
      </div>
      <div className="context__section">
        <div className="context__section-title">Инструменты</div>
        <div className="context__row">
          <span>Терминал</span>
          <span className="context__row-value">позже</span>
        </div>
        <div className="context__row">
          <span>Файловый менеджер</span>
          <span className="context__row-value">позже</span>
        </div>
      </div>
      <div className="context__section">
        <div className="context__section-title">Безопасность этого чата</div>
        <div className="context__row">
          <span>Доступ к файловой системе</span>
          <span className="context__row-value context__row-value--off">Выключен</span>
        </div>
        <div className="context__row">
          <span>Интернет</span>
          <span className="context__row-value context__row-value--off">Выключен</span>
        </div>
      </div>
    </aside>
  );
}
