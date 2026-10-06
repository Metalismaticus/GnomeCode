import "./ContextRow.css";

/** Кнопка команды внутри строки-действия: моно 11 px, 24 px высотой (спека «Размеры»). */
export type ContextButton = {
  label: string;
  onClick: () => void;
  /** Причина выключенной кнопки — в подсказке (спека «Состояния»). */
  title?: string;
  disabled?: boolean;
  testid?: string;
  /** Полное имя команды для сценария проверки и слоя прав. */
  command?: string;
};

/** Тумблер строки-тумблера: показатель состояния чата, причина — в подсказке. */
export type ContextSwitch = {
  on: boolean;
  title?: string;
  disabled?: boolean;
  testid?: string;
};

export type ContextRowData = {
  label: string;
  value: string;
  /** Значение статусное: «Выключен»/«Не отвечает» — цветом опасности,
   *  «Только папка проекта» — цветом успеха. */
  tone?: "off" | "danger" | "mono" | "success";
  /** Вариант action: кнопки команд справа. */
  buttons?: ContextButton[];
  /** Вариант toggle: тумблер справа вместо значения. */
  switch?: ContextSwitch;
  testid?: string;
};

/** Строка «метка — значение» правой панели: варианты action и toggle — те же
 *  строки с управлением справа (docs/specs/2026-10-06-11-glavnoe.md, «Компоненты»). */
export function ContextRow({ label, value, tone, buttons, switch: toggle, testid }: ContextRowData) {
  return (
    <div className="context-row" data-testid={testid} title={`${label} — ${value}`}>
      <span className="context-row__label">{label}</span>
      {toggle ? (
        <>
          {value ? (
            <span className={`context-row__value${tone ? ` context-row__value--${tone}` : ""}`}>{value}</span>
          ) : null}
          <button
            type="button"
            className={`context-row__switch${toggle.on ? " context-row__switch--on" : ""}`}
            role="switch"
            aria-checked={toggle.on}
            disabled={toggle.disabled}
            data-testid={toggle.testid}
            title={toggle.title}
          >
            <span className="context-row__knob" />
          </button>
        </>
      ) : value || !buttons ? (
        <span className={`context-row__value${tone ? ` context-row__value--${tone}` : ""}`}>{value}</span>
      ) : null}
      {buttons ? (
        <span className="context-row__buttons">
          {buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              className="context-row__button"
              data-testid={button.testid ?? "context-command"}
              data-command={button.command}
              onClick={button.onClick}
              disabled={button.disabled}
              title={button.title}
            >
              {button.label}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );
}
