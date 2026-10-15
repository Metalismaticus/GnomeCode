// Сводка прав при первом включении выключенного плагина (сцена H юнита, T1):
// максимум 3 пункта с пояснением «зачем», остальное свёрнуто; сверху источник
// и версия; для импортированных — честная пометка про opencode.json; у плагина
// без деклараций — «права неизвестны». «Разрешить и включить» включает плагина,
// а выбор по объявленным категориям становится правилом allow — он действует
// на первый же вызов (слой прав читает правила без перезапуска).

import { useState } from "react";

import type { Plugin } from "../bridge";
import "./PluginSummary.css";

/** «Зачем» категории прав — карта приложения (F17): реестра с
 *  permission_descriptions ещё нет (T5), пояснение даёт она; незнакомая
 *  категория — честный «проверить вручную», а не выдуманный текст. Экспорт
 *  общий: карта нужна и карточкам diff обновлений (DT3, «Что нового»). */
export const WHY: Record<string, string> = {
  Read: "читать файлы проекта",
  Write: "менять файлы проекта",
  Network: "ходить в сеть",
  Terminal: "запускать команды в системе",
};

/** Сколько пунктов видно без раскрытия (спека сцены H). */
const CAP = 3;

/** Категория из строки декларации «Категория: значение». */
function categoryOf(permission: string): string {
  return permission.split(":")[0]?.trim() ?? permission;
}

export type PluginEnableGateProps = {
  plugin: Plugin;
  /** «Разрешить и включить»: правила по объявленным категориям + включение. */
  onAllow: (plugin: Plugin) => void;
  /** «Отмена»: плагин остаётся выключенным, ничего не пишется. */
  onCancel: () => void;
};

export function PluginEnableGate({ plugin, onAllow, onCancel }: PluginEnableGateProps) {
  const [expanded, setExpanded] = useState(false);
  const permissions = plugin.permissions ?? [];
  const shown = expanded ? permissions : permissions.slice(0, CAP);
  const name = plugin.name ?? plugin.id;
  return (
    <div
      className="plugin-summary"
      data-testid="enable-summary"
      role="alertdialog"
      aria-label={`Права плагина ${name}`}
    >
      <div className="plugin-summary__title">{name} запрашивает права:</div>
      <div className="plugin-summary__meta" data-testid="enable-meta">
        {plugin.version ? <span>версия {plugin.version}</span> : null}
        {plugin.source === "imported" ? (
          <span>источник: ваш opencode.json · целостность не проверена</span>
        ) : null}
        {plugin.source === "external" ? (
          <span>источник: внешний файл · целостность не проверена</span>
        ) : null}
      </div>
      <div className="plugin-summary__list" data-testid="enable-permissions">
        {shown.map((one) => {
          const category = categoryOf(one);
          const why = WHY[category] ?? `неизвестное разрешение: ${category} · проверить вручную`;
          return (
            <div className="plugin-summary__row" key={one}>
              <span className="plugin-summary__mark">✓</span>
              <span className="plugin-summary__category">{one}</span>
              <span className="plugin-summary__value">{why}</span>
            </div>
          );
        })}
        {permissions.length === 0 ? (
          <div className="plugin-summary__row" data-testid="enable-unknown-rights">
            Права неизвестны — каждое действие будет спрашивать
          </div>
        ) : null}
        {permissions.length > CAP && !expanded ? (
          <button
            type="button"
            className="plugin-summary__btn"
            data-testid="enable-more"
            onClick={() => setExpanded(true)}
          >
            Ещё {permissions.length - CAP}
          </button>
        ) : null}
      </div>
      <div className="plugin-summary__actions">
        <button
          type="button"
          className="plugin-summary__btn plugin-summary__btn--main"
          data-testid="enable-allow"
          title="Запомнить права и включить плагин"
          onClick={() => onAllow(plugin)}
        >
          Разрешить и включить
        </button>
        <button
          type="button"
          className="plugin-summary__btn"
          data-testid="enable-cancel"
          title="Плагин остаётся выключенным"
          onClick={onCancel}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}
