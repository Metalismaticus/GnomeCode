import { Button } from "./Button";

import "./EmptyChat.css";

const CARDS = ["Прототипировать идея", "Проверить код", "Открыть проект"];

/** Пустое состояние чата: заголовок, подсказка, три карточки-сценария.
 *  Блок стоит по центру ленты, а не прижат к верху. */
export function EmptyChat() {
  return (
    <div className="empty" data-testid="empty">
      <div className="empty__title" data-testid="empty-title">
        Новый чат
      </div>
      <div className="empty__subtitle">
        Опишите задачу, приложите файл или выберите сценарий
      </div>
      <div className="empty__cards">
        {CARDS.map((card) => (
          <Button key={card} variant="card" data-testid={`empty-card-${card}`}>
            {card}
          </Button>
        ))}
      </div>
    </div>
  );
}