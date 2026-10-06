// Строки настроек (docs/specs/2026-10-06-12-nastrojki.md, «Размеры»): узор строки
// с устойчивой колонкой label 160 px — второй линией 11 px dim и действиями
// справа; строка провайдера с раскрытым полем ключа. Цвет — только токены.

import type { ReactNode } from "react";

/** Строка настройки: label с устойчивой колонкой (160 px), значение, действия
 *  и вторая линия — узор строки настроек (будет в DESIGN при /studio/done). */
export function Row({
  label,
  value,
  hint,
  sub,
  action,
  mono = false,
  testid,
  children,
}: {
  label: string;
  /** Значение строки; нет — контролы справа сами. */
  value?: string;
  /** Подпись под значением (11 px dim). */
  hint?: string;
  sub?: string;
  action?: ReactNode;
  mono?: boolean;
  testid?: string;
  /** Контролы строки: переключатель, кнопки значения. */
  children?: ReactNode;
}) {
  return (
    <div className="settings-row" data-testid={testid}>
      <span className="settings-row__label">{label}</span>
      <span className={`settings-row__value${mono ? " settings-row__value--mono" : ""}`}>
        {value ? <span className="settings-row__main">{value}</span> : null}
        {hint ? <span className="settings-row__sub">{hint}</span> : null}
        {sub}
        {children}
      </span>
      {action ? <span className="settings-row__actions">{action}</span> : null}
    </div>
  );
}

/** Строка провайдера с раскрытием поля ключа: пометка «задан ✓» — статусным
 *  цветом, «Убрать» рисуется только у ключа, который есть. */
export function ProviderRowLine({
  id,
  name,
  keySet,
  formOpen,
  saving,
  draft,
  status,
  tone,
  onOpenForm,
  onDraft,
  onSave,
  onCancel,
  onRemove,
}: {
  id: string;
  name: string;
  keySet: boolean;
  formOpen: boolean;
  saving: boolean;
  draft: string;
  status: string;
  tone: "dim" | "success" | "danger";
  onOpenForm: () => void;
  onDraft: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <>
      <div className="settings-row" data-testid="settings-provider-row" data-provider={id}>
        <span className="settings-row__label">{name}</span>
        <span className="settings-row__value">
          <span
            className={`settings-key-mark${keySet ? " settings-key-mark--set" : ""}`}
            data-testid="settings-key-mark"
          >
            {keySet ? "ключ задан ✓" : "ключ не задан"}
          </span>
        </span>
        <span className="settings-row__actions">
          <button
            type="button"
            className="settings-row__ghost"
            data-testid="settings-key-open"
            title={keySet ? "Заменить ключ провайдера" : "Задать ключ провайдера"}
            onClick={onOpenForm}
          >
            {keySet ? "Заменить ключ" : "Задать ключ"}
          </button>
          {keySet ? (
            <button
              type="button"
              className="settings-row__ghost settings-row__ghost--dim"
              data-testid="settings-key-remove"
              title={`Убрать ключ ${name}: пометка станет «ключ не задан»`}
              onClick={onRemove}
            >
              Убрать
            </button>
          ) : null}
        </span>
      </div>
      {formOpen ? <KeyForm saving={saving} draft={draft} status={status} tone={tone} onDraft={onDraft} onSave={onSave} onCancel={onCancel} /> : null}
    </>
  );
}

/** Раскрытое поле ключа: поле + две кнопки и строка статуса проверки. */
function KeyForm({
  saving,
  draft,
  status,
  tone,
  onDraft,
  onSave,
  onCancel,
}: {
  saving: boolean;
  draft: string;
  status: string;
  tone: "dim" | "success" | "danger";
  onDraft: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="settings-key-form" data-testid="settings-key-form">
      <label className="settings-key-form__label" htmlFor="settings-key-input">
        Ключ API
      </label>
      <div className="settings-key-form__line">
        <input
          id="settings-key-input"
          className="settings-key-form__input"
          type="password"
          placeholder="Вставьте ключ провайдера"
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
        />
        <button
          type="button"
          className="settings-key-form__clear"
          data-testid="settings-key-clear"
          title="Очистить поле"
          onClick={() => onDraft("")}
        >
          ✕
        </button>
      </div>
      <div className="settings-key-form__actions">
        <button
          type="button"
          className="settings-key-form__save"
          data-testid="settings-key-save"
          title={draft ? "Сохранить ключ и спросить провайдера" : "Вставьте ключ"}
          disabled={!draft.trim() || saving}
          onClick={onSave}
        >
          Сохранить
        </button>
        <button
          type="button"
          className="settings-row__ghost"
          data-testid="settings-key-cancel"
          title="Закрыть поле без сохранения"
          onClick={onCancel}
        >
          Отмена
        </button>
      </div>
      {status ? (
        <div className={`settings-key-form__status settings-key-form__status--${tone}`} data-testid="settings-key-status">
          {status}
        </div>
      ) : null}
    </div>
  );
}
