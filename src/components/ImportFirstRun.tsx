// Экран первого запуска (DT1): «В вашей конфигурации OpenCode найдено N
// плагинов». Чекбоксы по умолчанию сняты — «обработано» только явное действие;
// строка разворачивается инлайн в сводку прав (сцена H: у импортированных
// деклараций нет — права неизвестны), мастер-кнопка «Включить выбранные» —
// единое комбинированное одобрение без каскада диалогов; «Пропустить» —
// обработано без включения. Нераспознанные записи конфига — честное
// «Распознано N из M» с причинами (F-DX-10).

import { useState } from "react";

import type { ImportScan } from "../bridge";
import "./PluginSummary.css";
import "./ImportFirstRun.css";

export type ImportFirstRunProps = {
  scan: ImportScan;
  /** «Включить выбранные»: включение каждой отмеченной записи. */
  onEnable: (ids: string[]) => void;
  /** «Пропустить»: обработано без включения, экран уходит. */
  onSkip: () => void;
};

export function ImportFirstRun({ scan, onEnable, onSkip }: ImportFirstRunProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | undefined>(undefined);
  const toggle = (id: string) =>
    setPicked((held) => (held.includes(id) ? held.filter((one) => one !== id) : [...held, id]));
  return (
    <div
      className="plugin-summary import-first"
      data-testid="import-first"
      role="dialog"
      aria-label="Импорт конфигурации OpenCode"
    >
      <div className="plugin-summary__title">
        В вашей конфигурации OpenCode найдено плагинов: {scan.disabled.length}
      </div>
      {scan.recognized !== scan.total ? (
        <div className="plugin-summary__meta" data-testid="import-partial">
          <span>
            Распознано {scan.recognized} из {scan.total}
          </span>
          {scan.skipped.map((one) => (
            <span key={one.raw} title={one.reason}>
              {one.raw} — {one.reason}
            </span>
          ))}
        </div>
      ) : null}
      <div className="plugin-summary__list" data-testid="import-list">
        {scan.disabled.map((id) => (
          <div className="import-first__row" key={id}>
            <label className="import-first__line">
              <input
                type="checkbox"
                data-testid="import-check"
                checked={picked.includes(id)}
                onChange={() => toggle(id)}
              />
              <span className="plugin-summary__category">{id}</span>
              <span className="plugin-summary__value">источник: ваш opencode.json</span>
            </label>
            {expanded === id ? (
              <div className="plugin-summary__row" data-testid="import-rights">
                Права неизвестны — каждое действие будет спрашивать
              </div>
            ) : (
              <button
                type="button"
                className="settings-row__ghost import-first__more"
                data-testid="import-expand"
                onClick={() => setExpanded(id)}
              >
                подробнее
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="plugin-summary__actions">
        <button
          type="button"
          className="plugin-summary__btn plugin-summary__btn--main"
          data-testid="import-allow"
          title="Включить отмеченные плагины одним одобрением"
          disabled={picked.length === 0}
          onClick={() => onEnable(picked)}
        >
          Включить выбранные
        </button>
        <button
          type="button"
          className="plugin-summary__btn"
          data-testid="import-skip"
          title="Ничего не включать; записи останутся в разделе «Плагины» выключенными"
          onClick={onSkip}
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
