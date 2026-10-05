// Окно одобрения вызова плагина: компактное, по утверждённому UX
// «Спрашивать при первом использовании» (docs/SPEC/plugins.md):
// [Разрешить] [Разрешить для этого чата] [Отказать]. Отказ — строка
// «⚠ плагин · команда requires approval» в ленте, вызов не идёт; «Разрешить»
// исполняет этот вызов один раз, правило запоминает слой прав, а не окно.
import type { ApprovalDecision } from "../bridge";
import "./PluginApproval.css";

export type PluginApprovalProps = {
  /** Имя плагина — он подписывает команду у движка. */
  plugin: string;
  /** Подпись команды — та, что стоит на кнопке в шапке. */
  label: string;
  /** Что команда делает — словами, в окне и без обхода. */
  description: string;
  onDecide: (decision: ApprovalDecision) => void;
};

/** Компактное окно одобрения над чатом: вызов не исполняется без ответа. */
export function PluginApproval({ plugin, label, description, onDecide }: PluginApprovalProps) {
  return (
    <div
      className="plugin-approval"
      data-testid="plugin-approval"
      role="alertdialog"
      aria-label={`Одобрение команды ${label}`}
    >
      <div className="plugin-approval__title">Требуется одобрение</div>
      <div className="plugin-approval__command" data-testid="approval-command">
        {plugin} · {label}
      </div>
      {description ? <div className="plugin-approval__hint">{description}</div> : null}
      <div className="plugin-approval__actions">
        <button
          type="button"
          className="plugin-approval__btn"
          data-testid="approval-allow"
          title="Исполнить этот вызов; следующий спросит снова"
          onClick={() => onDecide("allow")}
        >
          Разрешить
        </button>
        <button
          type="button"
          className="plugin-approval__btn plugin-approval__btn--main"
          data-testid="approval-chat"
          title="Запомнить правило на этот чат: команда больше не спрашивает"
          onClick={() => onDecide("chat")}
        >
          Разрешить для этого чата
        </button>
        <button
          type="button"
          className="plugin-approval__btn"
          data-testid="approval-deny"
          title="Не исполнять: в ленте появится строка отказа"
          onClick={() => onDecide("deny")}
        >
          Отказать
        </button>
      </div>
    </div>
  );
}
