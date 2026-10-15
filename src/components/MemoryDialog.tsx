// Редактор памяти чата (пункт «Память чата» меню «+», правка владельца
// 15.10: «доделывай всё, что позже»): инструкция этого чата уходит в каждый
// его вопрос незаметно в ленте — движку, не владельцу. Одна textarea, три
// действия: сохранить, убрать, отмена.

import { useEffect, useRef, useState } from "react";

import { Button } from "./Button";
import "./MemoryDialog.css";

export type MemoryDialogProps = {
  /** Текущий текст памяти: правится черновиком, как поле ключа настроек. */
  memory: string;
  /** «Сохранить» и «Убрать»: текст идёт в состояние окна и запросы чата. */
  onSave: (text: string) => void;
  onClose: () => void;
};

/** Окно памяти чата: черновик синхронизируется, если память изменили снаружи. */
export function MemoryDialog({ memory, onSave, onClose }: MemoryDialogProps) {
  const [draft, setDraft] = useState(memory);
  const field = useRef<HTMLTextAreaElement | null>(null);

  // Фокус в поле при открытии: печать сразу, без клика (спека «Клавиатура»).
  useEffect(() => {
    field.current?.focus();
  }, []);

  const save = (text: string) => {
    onSave(text.trim());
    onClose();
  };

  return (
    <div
      className="memory-dialog"
      data-testid="memory-dialog"
      role="dialog"
      aria-label="Память чата"
    >
      <div className="memory-dialog__title">Память чата</div>
      <textarea
        ref={field}
        className="memory-dialog__text"
        data-testid="memory-text"
        placeholder="Например: отвечай кратко; проект на React; не трогай папку legacy"
        value={draft}
        rows={5}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && event.ctrlKey) {
            event.preventDefault();
            save(draft);
          }
        }}
      />
      <div className="memory-dialog__sub">
        Уходит в каждый вопрос этого чата как инструкция — в ленте её не видно.
        Действует до «Нового чата».
      </div>
      <div className="memory-dialog__actions">
        <Button
          variant="primary"
          data-testid="memory-save"
          title="Сохранить память чата"
          onClick={() => save(draft)}
        >
          Сохранить
        </Button>
        <Button
          variant="ghost"
          data-testid="memory-clear"
          title="Убрать память чата"
          onClick={() => save("")}
        >
          Убрать
        </Button>
        <Button variant="ghost" data-testid="memory-cancel" title="Закрыть без сохранения" onClick={onClose}>
          Отмена
        </Button>
      </div>
    </div>
  );
}
