// Панель Configure карточки плагина (docs/SPEC/plugins.md, сцена A — действие
// Configure): четыре категории прав (Read, Write, Network, Terminal) со значениями
// allow / ask / deny. Категорий без правила нет на экране умолчаний: показывается
// ask — «Спрашивать при первом использовании» (src-tauri/src/plugins/rules.rs,
// rules::DEFAULT). deny — никогда не спрашивается: строка «⚠ … denied» в ленте.
// Окно по образцу UninstallConfirm/PluginSummary: решение остаётся у владельца.

import type { Plugin } from "../bridge";
import "./PluginConfig.css";

/** Категории прав — те же четыре, что у слоя прав (src-tauri/src/plugins/rules.rs);
 *  копия стерегётся сценарием plugin_config (четыре строки в панели). */
export const CATEGORIES = ["Read", "Write", "Network", "Terminal"] as const;

/** Значения правила категории — тот же порядок, что у rules::VALUES. */
export const VALUES = ["allow", "ask", "deny"] as const;

/** Что говорит каждая кнопка значения — словами продукта, в title. */
export const VALUE_HINT: Record<string, string> = {
  allow: "исполнять молча, без вопроса",
  ask: "спрашивать окном одобрения на каждый вызов",
  deny: "никогда не исполнять: в ленте строка «⚠ … denied»",
};

/** Кнопки значения правила: ряд allow/ask/deny с одним источником подсказок.
 *  Панель Configure и страница настроек — оба потребителя (пункт 12). */
export function RuleButtons({
  category,
  value,
  prefix,
  onSet,
}: {
  category: string;
  value: string;
  /** Начало тестидов кнопок: `config-rule-read` → `config-rule-read-allow`. */
  prefix: string;
  onSet: (value: string) => void;
}) {
  return (
    <span className="plugin-config__values">
      {VALUES.map((one) => (
        <button
          type="button"
          key={one}
          className={`plugin-config__btn${value === one ? " plugin-config__btn--on" : ""}`}
          data-testid={`${prefix}-${one}`}
          title={`${category}: ${VALUE_HINT[one]}`}
          aria-pressed={value === one}
          onClick={() => onSet(one)}
        >
          {one}
        </button>
      ))}
    </span>
  );
}

export type PluginConfigProps = {
  plugin: Plugin;
  /** Смена правила категории: мост пишет правило, список приходит свежий. */
  onSetRule: (category: string, value: string) => void;
  /** Закрыть панель — Esc, клик снаружи или «Готово». */
  onClose: () => void;
};

/** Панель правил у карточки: строка на категорию, три кнопки значения. */
export function PluginConfig({ plugin, onSetRule, onClose }: PluginConfigProps) {
  const name = plugin.name ?? plugin.id;
  return (
    <div
      className="plugin-config"
      data-testid="plugin-config"
      role="dialog"
      aria-label={`Правила плагина ${name}`}
    >
      <div className="plugin-config__title">Configure {name}</div>
      <div className="plugin-config__hint">
        Правило категории действует на следующий вызов команды без перезапуска.
      </div>
      <div className="plugin-config__rows">
        {CATEGORIES.map((category) => {
          const value = plugin.rules?.[category] ?? "ask";
          return (
            <div className="plugin-config__row" key={category} data-testid={`config-row-${category.toLowerCase()}`}>
              <span className="plugin-config__category">{category}</span>
              <RuleButtons
                category={category}
                value={value}
                prefix={`config-rule-${category.toLowerCase()}`}
                onSet={(one) => onSetRule(category, one)}
              />
            </div>
          );
        })}
      </div>
      <div className="plugin-config__actions">
        <button
          type="button"
          className="plugin-config__close"
          data-testid="config-close"
          title="Правила записаны — панель можно закрыть"
          onClick={onClose}
        >
          Готово
        </button>
      </div>
    </div>
  );
}
