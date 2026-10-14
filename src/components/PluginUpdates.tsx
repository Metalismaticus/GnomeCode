// Вкладка Updates раздела «Плагины» (пункт 4 партии + DT3): что updates.json
// помнит об обновлениях — источник правды фоновая проверка при запуске
// (src-tauri/src/plugins/updates.rs). Карточка ждущего прав показывает diff —
// «Что нового» человеческими формулировками: добавленное added-цветом,
// убранное приглушённо; максимум 3 пункта, «Ещё N» раскрывается инлайн, кнопка
// «Обновить» неактивна до первого раскрытия (F15). «Обновить всё» прогоняет
// стек карточек и отчитывается тостом «Обновлено N · ждёт M · ошибок K» (F7).
// Тела карточек те же классы, что у карточек сцены A (PluginsPage.css).

import { useState } from "react";

import type { Plugin } from "../bridge";
import { WHY } from "./PluginEnableGate";

import "./PluginUpdates.css";

/** Пометка обновления словами: enum моста → слова вкладки. */
const STATUS: Record<NonNullable<Plugin["update"]>["status"], string> = {
  applied: "обновлено",
  held: "ждёт прав",
  outside: "вне каталога",
  broken: "сломано",
  declined: "отклонено",
};

/** «Зачем» категории словами: карта приложения (F17), fallback — честный
 *  «проверить вручную». */
const whyOf = (permission: string): string => {
  const category = permission.split(":")[0]?.trim() ?? permission;
  return WHY[category] ?? `неизвестное разрешение: ${category} · проверить вручную`;
};

/** Сколько пунктов diff видно без раскрытия (спека карточки diff). */
const DIFF_CAP = 3;

export type PluginUpdatesProps = {
  plugins: Plugin[];
  /** Пометка последней проверки каталога: не ответил — работаем на текущих. */
  note: string | null;
  /** «Обновить» карточки: применить обновление (установить версию `to`). */
  onApply: (id: string) => Promise<void>;
  /** «Оставить текущую»: обновление до этой версии больше не предлагается. */
  onDecline: (id: string) => void;
};

/** Тело вкладки Updates: «Обновить всё», карточки diff, тихий ченджлог
 *  применённых, пометка каталога, честная пустота. */
export function PluginUpdates({ plugins, note, onApply, onDecline }: PluginUpdatesProps) {
  const updates = plugins.filter((one) => one.update);
  const held = updates.filter((one) => one.update?.status === "held");
  /** Статусы стека «Обновить всё»: id → «скачивается» | «ошибка». */
  const [busy, setBusy] = useState<Record<string, "downloading" | "error">>({});
  const [running, setRunning] = useState(false);
  /** Итог стека — тост «Обновлено N · ждёт M · ошибок K» (F7), уходит сам. */
  const [toast, setToast] = useState<string | null>(null);

  /** Стек «Обновить всё»: карточки по очереди — скачивание, применённая версия,
   *  отказ не прерывает остальных (CE-2: плагины обрабатываются независимо).
   *  Ждущие после прохода — те, чьё применение не состоялось (M в тосте). */
  const applyAll = async () => {
    setRunning(true);
    let applied = 0;
    let errors = 0;
    for (const one of held) {
      setBusy((state) => ({ ...state, [one.id]: "downloading" }));
      try {
        await onApply(one.id);
        applied += 1;
        setBusy((state) => {
          const next = { ...state };
          delete next[one.id];
          return next;
        });
      } catch {
        errors += 1;
        setBusy((state) => ({ ...state, [one.id]: "error" }));
      }
    }
    setRunning(false);
    const waiting = held.length - applied - errors;
    setToast(`Обновлено ${applied} · ждёт ${waiting} · ошибок ${errors}`);
    window.setTimeout(() => setToast(null), 6000);
  };

  return (
    <>
      {held.length > 1 ? (
        <div className="plugin-updates__all">
          <button
            type="button"
            className="plugin-updates__all-btn"
            data-testid="plugin-updates-apply-all"
            title="Применить все ждущие обновления по очереди"
            disabled={running}
            onClick={() => void applyAll()}
          >
            {running ? "Обновляю…" : "Обновить всё"}
          </button>
        </div>
      ) : null}
      {toast ? (
        <div className="plugin-updates__toast" data-testid="plugin-updates-toast">
          {toast}
        </div>
      ) : null}
      {note ? (
        <div className="plugin-updates__note" data-testid="plugin-updates-note">{note}</div>
      ) : null}
      {updates.map((one) => (
        <UpdateCard
          key={one.id}
          plugin={one}
          busy={busy[one.id]}
          onApply={onApply}
          onDecline={onDecline}
        />
      ))}
      {updates.length === 0 && !note ? (
        <div className="plugins-page__empty" data-testid="plugin-updates-empty">
          Обновлений нет — все плагины на своих версиях
        </div>
      ) : null}
    </>
  );
}

/** Карточка diff обновления (DT3): «Что нового» — добавленное added-цветом с
 *  «зачем», убранное приглушённо; максимум 3 пункта до раскрытия; «Обновить»
 *  неактивна, пока diff не раскрыт (F15); «Оставить текущая» отклоняет. */
function UpdateCard({
  plugin,
  busy,
  onApply,
  onDecline,
}: {
  plugin: Plugin;
  busy?: "downloading" | "error";
  onApply: (id: string) => Promise<void>;
  onDecline: (id: string) => void;
}) {
  const update = plugin.update;
  const [expanded, setExpanded] = useState(false);
  if (!update) {
    return null;
  }
  const name = plugin.name ?? plugin.id;
  const added = update.permissions ?? [];
  const removed = update.removed ?? [];
  const diffCount = added.length + removed.length;
  const needsReveal = diffCount > DIFF_CAP;
  const shownAdded = expanded ? added : added.slice(0, DIFF_CAP);
  const shownRemoved = expanded ? removed : removed.slice(0, Math.max(0, DIFF_CAP - added.length));
  const hiddenCount = diffCount - shownAdded.length - shownRemoved.length;
  const held = update.status === "held";
  return (
    <article
      className="plugin-card plugin-update"
      data-testid="plugin-update-card"
      data-plugin={plugin.id}
      {...(held ? { "data-held": "true", tabIndex: -1 } : {})}
    >
      <span className="plugin-card__icon" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <div className="plugin-card__body">
        <div className="plugin-card__line">
          <span className="plugin-card__name">{name}</span>
          <span className="plugin-update__versions" data-testid="plugin-update-versions">
            {update.from}  → {update.to}
          </span>
          <span className="plugin-update__status" data-testid="plugin-update-status">
            {busy === "downloading" ? "скачивается…" : busy === "error" ? "ошибка" : STATUS[update.status]}
          </span>
        </div>
        <div className="plugin-card__version" data-testid="plugin-update-version">
          версия {plugin.version ?? plugin.id}
        </div>
        {held && (added.length || removed.length) ? (
          <div className="plugin-update__diff" data-testid="plugin-update-diff">
            <div className="plugin-update__diff-title">Что нового</div>
            {shownAdded.map((one) => (
              <div className="plugin-update__diff-row plugin-update__diff-row--added" key={one}>
                + {one} — {whyOf(one)}
              </div>
            ))}
            {shownRemoved.map((one) => (
              <div className="plugin-update__diff-row plugin-update__diff-row--removed" key={one}>
                − {one}
              </div>
            ))}
            {needsReveal && !expanded ? (
              <button
                type="button"
                className="plugin-update__diff-more"
                data-testid="plugin-update-more"
                onClick={() => setExpanded(true)}
              >
                Ещё {hiddenCount}
              </button>
            ) : null}
          </div>
        ) : null}
        {held && !added.length && !removed.length ? (
          <div className="plugin-update__diff" data-testid="plugin-update-diff">
            Права не объявлены — каждое действие будет спрашивать
          </div>
        ) : null}
      </div>
      <div className="plugin-card__actions">
        {held ? (
          <>
            <button
              type="button"
              className="plugin-card__action"
              data-testid="plugin-update-allow"
              title={
                needsReveal && !expanded
                  ? "Сначала раскройте список прав — кнопка станет активной"
                  : `Обновить до версии ${update.to}`
              }
              disabled={needsReveal && !expanded || busy === "downloading"}
              onClick={() => void onApply(plugin.id)}
            >
              Обновить
            </button>
            <button
              type="button"
              className="plugin-card__action plugin-update__decline"
              data-testid="plugin-update-decline"
              title="Оставить текущую версию — обновление до этой больше не предлагается"
              onClick={() => onDecline(plugin.id)}
            >
              Оставить текущую
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
