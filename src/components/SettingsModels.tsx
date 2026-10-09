// Вкладка «Модели» страницы настроек (docs/specs/2026-10-06-12-nastrojki.md,
// «Раскладка»): строка модели по умолчанию, провайдеры и ключи, оверлей панели
// сравнения в режиме «по умолчанию». Оверлей позиционируется страницей
// (SettingsPage.css) и остаётся внутри области страницы; «✕» и Esc возвращают
// к настройкам — слой закрытия держит SettingsPage (usePageDismiss).

import { useEffect } from "react";
import type { ReactNode } from "react";

import { DEFAULT_MODEL } from "../appstate";
import type { ChatModelChoice } from "../bridge";
import type { CompareState } from "../features/compare/useCompare";
import { ENDPOINT_WAITING, useEndpointForm } from "../features/settings/useEndpointForm";
import { WAITING, type KeyFormState } from "../features/settings/useKeyForm";
import type { SettingsState } from "../features/settings/useSettings";
import { ComparePanel } from "./ComparePanel";
import { Row, ProviderRowLine } from "./SettingsRows";

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
  const endpointForm = useEndpointForm(settings);

  // Форма endpoint'а закрывается сама: Esc и клик снаружи — тот же жест,
  // что у раскрытого поля ключа (SettingsPage закрывает его для ключа).
  useEffect(() => {
    if (!endpointForm.open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        endpointForm.close();
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest(".settings-key-form")) {
        endpointForm.close();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [endpointForm.open, endpointForm.close]);

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
        {providersBody(compareOpen, settings, form, endpointForm)}
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

/** Форма своего endpoint'а: имя, база URL и ключ — тот же узор классов, что у
 *  раскрытого поля ключа; приём закрывает форму, отказ оставляет введённое. */
function EndpointForm({ form }: { form: ReturnType<typeof useEndpointForm> }): ReactNode {
  const canSave = form.name.trim() !== "" && form.baseUrl.trim() !== "";
  return (
    <div className="settings-key-form" data-testid="settings-endpoint-form">
      <label className="settings-key-form__label" htmlFor="settings-endpoint-name">
        Имя
      </label>
      <div className="settings-key-form__line">
        <input
          id="settings-endpoint-name"
          className="settings-key-form__input"
          data-testid="settings-endpoint-name"
          type="text"
          placeholder="Например: Корпоративный прокси"
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
        />
      </div>
      <label className="settings-key-form__label" htmlFor="settings-endpoint-url">
        База URL
      </label>
      <div className="settings-key-form__line">
        <input
          id="settings-endpoint-url"
          className="settings-key-form__input"
          data-testid="settings-endpoint-url"
          type="text"
          placeholder="http://localhost:11434/v1"
          value={form.baseUrl}
          onChange={(event) => form.setBaseUrl(event.target.value)}
        />
      </div>
      <label className="settings-key-form__label" htmlFor="settings-endpoint-key">
        Ключ (необязательно)
      </label>
      <div className="settings-key-form__line">
        <input
          id="settings-endpoint-key"
          className="settings-key-form__input"
          data-testid="settings-endpoint-key"
          type="password"
          placeholder="Вставьте ключ, если endpoint его требует"
          value={form.key}
          onChange={(event) => form.setKey(event.target.value)}
        />
      </div>
      <div className="settings-key-form__actions">
        <button
          type="button"
          className="settings-key-form__save"
          data-testid="settings-endpoint-save"
          title={canSave ? "Сохранить endpoint и спросить его модели" : "Введите имя и базу URL"}
          disabled={!canSave || form.status === ENDPOINT_WAITING}
          onClick={() => void form.save()}
        >
          Сохранить
        </button>
        <button
          type="button"
          className="settings-row__ghost"
          data-testid="settings-endpoint-cancel"
          title="Закрыть форму без сохранения"
          onClick={form.close}
        >
          Отмена
        </button>
      </div>
      {form.status ? (
        <div
          className={`settings-key-form__status settings-key-form__status--${form.tone}`}
          data-testid="settings-endpoint-status"
        >
          {form.status}
        </div>
      ) : null}
    </div>
  );
}

/** Строки провайдеров или их состояния: едут, недоступный движок, список. */
function providersBody(
  compareOpen: boolean,
  settings: SettingsState,
  form: KeyFormState,
  endpointForm: ReturnType<typeof useEndpointForm>,
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
          isEndpoint={provider.endpoint}
          enabled={provider.enabled}
          onOpenForm={() => form.open(provider.id)}
          onDraft={form.setDraft}
          onSave={() => void form.save()}
          onCancel={form.close}
          onRemove={() => void form.remove(provider.id)}
          onToggle={() => void settings.setEnabled(provider.id, !provider.enabled)}
          onRemoveEndpoint={() => void settings.removeEndpoint(provider.id)}
        />
      ))}
      <div className="settings-row">
        <span className="settings-row__label">Свой endpoint</span>
        <span className="settings-row__value">
          <span className="settings-row__sub">
            OpenAI-совместимый сервер — корпоративный прокси или self-hosted (Ollama, LM Studio)
          </span>
        </span>
        <span className="settings-row__actions">
          <button
            type="button"
            className="settings-row__ghost"
            data-testid="settings-endpoint-add"
            title="Добавить OpenAI-совместимый endpoint: его модели появятся в переключателе чата"
            onClick={endpointForm.openForm}
          >
            Добавить endpoint
          </button>
        </span>
      </div>
      {endpointForm.open ? <EndpointForm form={endpointForm} /> : null}
      <div className="settings-row__hint settings-providers__hint">
        Ключи хранит Windows (Диспетчер учётных данных) — в файлах проекта их нет
      </div>
    </>
  );
}
