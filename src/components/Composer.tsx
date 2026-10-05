import { Button } from "./Button";

import "./Composer.css";

const HINT = "Enter — перенос строки · Ctrl + Enter — отправить";
const PLACEHOLDER = "Напишите сообщение… (Ctrl + Enter — отправить)";
const EMPTY = "Напишите сообщение — отправлять нечего";

export type ComposerProps = {
  draft: string;
  sending: boolean;
  onDraft: (text: string) => void;
  onSend: () => void;
};

/** Композер: «+», поле ввода, «↑» и подсказка под ним. Кнопка отправки выключена
 *  на пустом поле, и причина видна в её подсказке (docs/DESIGN.md, раздел 6). */
export function Composer({ draft, sending, onDraft, onSend }: ComposerProps) {
  return (
    <div className="composer">
      <div className="composer__box">
        <Button square variant="ghost" className="composer__add" data-testid="composer-add" title="Добавить">
          +
        </Button>
        <textarea
          className="composer__input"
          data-testid="composer"
          placeholder={PLACEHOLDER}
          value={draft}
          rows={1}
          onChange={(event) => onDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.ctrlKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          square
          variant="ghost"
          className={`composer__send${draft.trim() ? " composer__send--ready" : ""}`}
          data-testid="send"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          title={sending ? "Отправляется" : draft.trim() ? "Отправить" : EMPTY}
        >
          {sending ? "…" : "↑"}
        </Button>
      </div>
      <div className="composer__hint">{HINT}</div>
    </div>
  );
}