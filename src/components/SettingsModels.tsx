// Вкладка «Модели» страницы настроек (docs/specs/2026-10-06-12-nastrojki.md,
// «Раскладка»): строка модели по умолчанию, провайдеры и ключи, оверлей панели
// сравнения в режиме «по умолчанию». Оверлей позиционируется страницей
// (SettingsPage.css) и остаётся внутри области страницы; «✕» и Esc возвращают
// к настройкам — слой закрытия держит SettingsPage (usePageDismiss).

import { DEFAULT_MODEL } from "../appstate";
import type { ChatModelChoice } from "../bridge";
import type { CompareState } from "../features/compare/useCompare";
import { WAITING, type KeyFormState } from "../features/settings/useKeyForm";
import type { SettingsState } from "../features/settings/useSettings";
import { ComparePanel } from "./ComparePanel";
import { Row, ProviderRowLine } from "./SettingsRows";
import type { ReactNode } from "react";

export type ModelsSectionProps = {
  /** Модель по умолчанию: имя строки и выбор панели (пара имя/идентификатор). */
  defaultModel: string;
  settings: SettingsState;
  /** Оверлей панели сравнения держит страница — вкладка его рисует. */
  compareOpen: boolean;
  compare: CompareState;
  /** Раскрытое поле ключа: одна форма на страницу (useKeyForm). */
  form: KeyFormState;
  /** «Изменить →»: открыть панель сравнения в режиме «по умолчанию». */
  onOpen: () => void;
  /** «По умолчанию» в панели: дефолт меняется, панель закрывает себя. */
  onChooseDefault: (choice: ChatModelChoice) => void;
  onClose: () => void;
};

export function ModelsSection({ defaultModel, settings, compareOpen, compare, form, onOpen, onChooseDefault, onClose }: ModelsSectionProps) {
  const current = defaultModel || DEFAULT_MODEL;
  return (
    <>
      <section className="settings-section" data-testid="settings-models">
        <h2 className="settings-section__title">Модели</h2>
        <Row
          label="Модель по умолчанию"
          value={current}
          testid="settings-default-model"
          hint="Модель, с которой открываются новые чаты"
          action={
            <button
              type="button"
              className="settings-row__ghost"
              data-testid="settings-open-compare"
              title="Открыть панель сравнения"
              onClick={onOpen}
            >
              Изменить →
            </button>
          }
        />
      </section>
      <section className="settings-section" data-testid="settings-providers">
        <h2 className="settings-section__title">Провайдеры и ключи</h2>
        {providersBody(compareOpen, settings, form)}
      </section>
      {compareOpen ? (
        <ComparePanel
          compare={compare}
          currentModel={current}
          mode="default"
          onChoose={(model) => onChooseDefault({ name: model.name, id: model.id })}
          onClose={onClose}
        />
      ) : null}
    </>
  );
}

/** Строки провайдеров или их состояния: едут, недоступный движок, список. */
function providersBody(
  compareOpen: boolean,
  settings: SettingsState,
  form: KeyFormState,
): ReactNode {
  if (compareOpen) {
    return null;
  }
  if (settings.providers === null && !settings.error) {
    return (
      <div className="settings-row__hint" data-testid="settings-providers-loading">
        Узнаём провайдеров…
      </div>
    );
  }
  if (settings.error) {
    return (
      <div className="settings-providers__down" data-testid="settings-providers-down">
        <span className="settings-providers__note">
          Движок недоступен — список провайдеров не читается
        </span>
        <button
          type="button"
          className="settings-row__ghost"
          data-testid="settings-providers-retry"
          title="Прочитать список провайдеров заново"
          onClick={settings.retry}
        >
          Повторить
        </button>
      </div>
    );
  }
  return (
    <>
      {settings.providers!.map((provider) => (
        <ProviderRowLine
          key={provider.id}
          id={provider.id}
          name={provider.name}
          keySet={settings.keys[provider.id] ?? false}
          formOpen={form.keyForm === provider.id}
          saving={form.keyForm === provider.id && form.status === WAITING}
          draft={form.keyForm === provider.id ? form.draft : ""}
          status={form.keyForm === provider.id ? form.status : ""}
          tone={form.tone}
          onOpenForm={() => form.open(provider.id)}
          onDraft={form.setDraft}
          onSave={() => void form.save()}
          onCancel={form.close}
          onRemove={() => void form.remove(provider.id)}
        />
      ))}
      <div className="settings-row__hint settings-providers__hint">
        Ключи хранит Windows (Диспетчер учётных данных) — в файлах проекта их нет
      </div>
    </>
  );
}
