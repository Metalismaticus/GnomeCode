// Страница настроек (docs/specs/2026-10-06-12-nastrojki.md): четыре вкладки —
// Внешний вид · Модели · Плагины · Папка данных. Главное действие одно: выбрал —
// уже применено, окна «Сохранить» на странице нет. Узор страницы-раздела —
// PluginsPage (третья страница App); вкладки — его же; строки прав и подсказки
// категорий импортированы из PluginConfig.tsx (одно знание — одно место);
// вкладка «Модели» — SettingsModels.tsx, строки — SettingsRows.tsx.

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatModelChoice } from "../bridge";
import { useCompare } from "../features/compare/useCompare";
import { useKeyForm, type KeyFormState } from "../features/settings/useKeyForm";
import { useSettings, type SettingsState } from "../features/settings/useSettings";
import { params, type Theme } from "../viewparams";
import { ModelsSection } from "./SettingsModels";
import { Row } from "./SettingsRows";
import { RuleButtons, VALUE_HINT } from "./PluginConfig";
import { ThemeSwitch } from "./ThemeSwitch";
import { WindowButtons } from "./WindowButtons";

import "./SettingsPage.css";
import "./PluginConfig.css";

type Tab = "вид" | "модели" | "плагины" | "данные";

const TITLES: Record<Tab, string> = {
  вид: "Внешний вид",
  модели: "Модели",
  плагины: "Плагины",
  данные: "Папка данных",
};

const TABS: Tab[] = ["вид", "модели", "плагины", "данные"];

/** Вкладка состояния адреса: «настройки-модели» открывает Модели и т.д. */
const TAB_OF_STATE: Record<string, Tab> = {
  "настройки": "вид",
  "настройки-модели": "модели",
  "настройки-ключ": "модели",
  "настройки-ключ-ошибка": "модели",
  "настройки-плагины": "плагины",
  "настройки-данные": "данные",
  "настройки-движок": "модели",
};

export type SettingsPageProps = {
  theme: Theme;
  onToggleTheme: () => void;
  /** Модель по умолчанию: имя строки и выбор панели (пара имя/идентификатор). */
  defaultModel: string;
  onChooseDefault: (choice: ChatModelChoice) => void;
  /** Esc страницы: возврат в чат с фокусом на шестерёнке сайдбара. */
  onClose: () => void;
};

export function SettingsPage({ theme, onToggleTheme, defaultModel, onChooseDefault, onClose }: SettingsPageProps) {
  const [tab, setTab] = useState<Tab>(TAB_OF_STATE[params.feed] ?? "вид");
  const settings = useSettings();
  /** Панель сравнения в режиме «по умолчанию»: оверлей вкладки «Модели». */
  const [compareOpen, setCompareOpen] = useState(false);
  const compare = useCompare(compareOpen);
  /** Раскрытое поле ключа: одна форма на страницу (useKeyForm). */
  const form = useKeyForm(settings);
  /** «По умолчанию» в панели: дефолт меняется, панель закрывает себя. */
  const chooseDefault = useCallback(
    (choice: ChatModelChoice) => {
      onChooseDefault(choice);
      setCompareOpen(false);
    },
    [onChooseDefault],
  );
  const closeCompare = useCallback(() => setCompareOpen(false), []);

  // Esc и клик снаружи закрывают слои сами — см. usePageDismiss.
  usePageDismiss({ compareOpen, form, closeCompare, onClose });

  return (
    <main className="settings-page" data-testid="settings-page">
      <PageHead tab={tab} onTab={setTab} />
      <div className="settings-page__body">
        {tab === "вид" ? <LookSection theme={theme} onToggleTheme={onToggleTheme} /> : null}
        {tab === "модели" ? (
          <ModelsSection
            defaultModel={defaultModel}
            settings={settings}
            compareOpen={compareOpen}
            compare={compare}
            form={form}
            onOpen={() => setCompareOpen(true)}
            onChooseDefault={chooseDefault}
            onClose={closeCompare}
          />
        ) : null}
        {tab === "плагины" ? <RulesSection settings={settings} /> : null}
        {tab === "данные" ? <DataSection folder={settings.folder} /> : null}
      </div>
    </main>
  );
}

/** Шапка страницы: заголовок и вкладки над скролл-областью; открытие —
 *  фокус на первой вкладке (спека «Клавиатура»). */
function PageHead({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const firstTab = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstTab.current?.focus();
  }, []);
  return (
    <div className="settings-page__head" data-tauri-drag-region>
      <div className="settings-page__topline" data-tauri-drag-region>
        <h1 className="settings-page__title" data-tauri-drag-region>Настройки</h1>
        <WindowButtons />
      </div>
      <div className="settings-page__tabs" role="tablist" aria-label="Разделы настроек">
        {TABS.map((one, index) => (
          <button
            key={one}
            type="button"
            role="tab"
            ref={index === 0 ? firstTab : undefined}
            aria-selected={tab === one}
            className="plugins-page__tab"
            data-testid={`settings-tab-${one}`}
            onClick={() => onTab(one)}
          >
            {TITLES[one]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Слой закрытия страницы (спека «Состояния экрана»): Esc и клик снаружи
 *  снимают сначала панель сравнения, потом поле ключа, потом страницу —
 *  фокус уходит шестерёнке сайдбара. Клик по открытому слою — за ним. */
function usePageDismiss({ compareOpen, form, closeCompare, onClose }: {
  compareOpen: boolean;
  form: KeyFormState;
  closeCompare: () => void;
  onClose: () => void;
}): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (compareOpen) {
        closeCompare();
        return;
      }
      if (form.keyForm) {
        form.close();
        return;
      }
      onClose();
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // Панель сравнения закрывается по клику снаружи, как из бейджа чата;
      // поле ключа — тоже (узор useOverlayDismiss), страница — не закрывается.
      if (compareOpen && !target?.closest(".compare-panel")) {
        closeCompare();
      }
      if (form.keyForm && !target?.closest(".settings-key-form")) {
        form.close();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [compareOpen, form.keyForm, form.close, closeCompare, onClose]);
}

/** Вкладка «Внешний вид»: тема переключателем и честная строка языка. */
function LookSection({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  return (
    <section className="settings-section" data-testid="settings-look">
      <h2 className="settings-section__title">Внешний вид</h2>
      <Row label="Тема" hint="Светлая и тёмная применяются ко всему окну сразу">
        <ThemeSwitch theme={theme} onToggle={onToggleTheme} testid="settings-theme-switch" />
      </Row>
      <Row label="Язык интерфейса" value="Русский">
        <span className="settings-row__sub">Переводы на другие языки появятся позже</span>
      </Row>
    </section>
  );
}

/** Вкладка «Плагины»: умолчания категорий теми же кнопками, что у Configure. */
function RulesSection({ settings }: { settings: SettingsState }) {
  return (
    <section className="settings-section" data-testid="settings-rules">
      <h2 className="settings-section__title">Базовые права для всех плагинов</h2>
      <div className="settings-row__hint settings-rules__hint">
        Действует, пока у плагина нет своего права (раздел «Плагины» → Configure)
      </div>
      {settings.defaults.map((one) => (
        <div
          className="settings-row"
          key={one.category}
          data-testid={`settings-default-rule-${one.category.toLowerCase()}`}
        >
          <span className="settings-row__label" title={VALUE_HINT[one.value]}>
            {one.category}
          </span>
          <span className="settings-row__value settings-row__value--wide">
            <RuleButtons
              category={one.category}
              value={one.value}
              prefix={`settings-rule-${one.category.toLowerCase()}`}
              onSet={(value) => settings.setDefault(one.category, value)}
            />
          </span>
        </div>
      ))}
    </section>
  );
}

/** Вкладка «Папка данных»: полный путь и его копирование; смены пути нет. */
function DataSection({ folder }: { folder: string }) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  /** Копировать путь: «Скопировано» на 2 секунды, затем «Скопировать» обратно. */
  const copyFolder = () => {
    navigator.clipboard?.writeText(folder).catch(() => {
      // Хранилище буфера недоступно — подпись честно не меняется.
      return;
    });
    setCopied(true);
    if (copyTimer.current) {
      window.clearTimeout(copyTimer.current);
    }
    copyTimer.current = window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="settings-section" data-testid="settings-data">
      <h2 className="settings-section__title">Папка данных</h2>
      <Row
        label="Папка"
        value={folder || "—"}
        mono
        testid="settings-folder"
        action={
          <button
            type="button"
            className="settings-row__ghost"
            data-testid="settings-folder-copy"
            title="Скопировать путь папки данных"
            onClick={copyFolder}
          >
            {copied ? "Скопировано" : "Скопировать"}
          </button>
        }
      >
        <span className="settings-row__sub">Папку задаёт запуск приложения — смену пути в окне не делаем</span>
      </Row>
    </section>
  );
}
