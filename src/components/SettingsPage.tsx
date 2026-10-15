// Страница настроек (docs/specs/2026-10-06-12-nastrojki.md): четыре вкладки —
// Внешний вид · Модели · Плагины · Папка данных. Главное действие одно: выбрал —
// уже применено, окна «Сохранить» на странице нет. Узор страницы-раздела —
// PluginsPage (третья страница App); вкладки — его же; строки прав и подсказки
// категорий импортированы из PluginConfig.tsx (одно знание — одно место);
// вкладка «Модели» — SettingsModels.tsx, строки — SettingsRows.tsx.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { bridge } from "../bridge";
import type { ChatModelChoice, McpServer, Skill } from "../bridge";
import { useCompare } from "../features/compare/useCompare";
import { useKeyForm, type KeyFormState } from "../features/settings/useKeyForm";
import { useSettings, type SettingsState } from "../features/settings/useSettings";
import { params, type Theme } from "../viewparams";
import { DropZone } from "./DropZone";
import { ModelsSection } from "./SettingsModels";
import { Row } from "./SettingsRows";
import { RuleButtons, VALUE_HINT } from "./PluginConfig";
import { ThemeSwitch } from "./ThemeSwitch";

import "./SettingsPage.css";
import "./PluginConfig.css";

type Tab = "вид" | "модели" | "плагины" | "скиллы" | "данные";

const TITLES: Record<Tab, string> = {
  вид: "Внешний вид",
  модели: "Модели",
  плагины: "Плагины",
  скиллы: "Скиллы",
  данные: "Папка данных",
};

const TABS: Tab[] = ["вид", "модели", "плагины", "скиллы", "данные"];

/** Вкладка состояния адреса: «настройки-модели» открывает Модели и т.д. */
const TAB_OF_STATE: Record<string, Tab> = {
  "настройки": "вид",
  "настройки-модели": "модели",
  "настройки-ключ": "модели",
  "настройки-ключ-ошибка": "модели",
  "настройки-плагины": "плагины",
  "настройки-скиллы": "скиллы",
  "настройки-данные": "данные",
  "настройки-движок": "модели",
  "настройки-ollama": "модели",
  "настройки-lmstudio": "модели",
  "настройки-локальные": "модели",
};

export type SettingsPageProps = {
  theme: Theme;
  onToggleTheme: () => void;
  /** Модель по умолчанию: имя строки и выбор панели (пара имя/идентификатор). */
  defaultModel: string;
  onChooseDefault: (choice: ChatModelChoice) => void;
  /** Вкладка открытия из меню «+» («MCP-серверы» ведёт на «Плагины»):
   *  без неё — вкладка состояния адреса или «Внешний вид». */
  initialTab?: string;
  /** Esc страницы: возврат в чат с фокусом на шестерёнке сайдбара. */
  onClose: () => void;
  /** Кластер кнопок окна (тема + свернуть/развернуть/закрыть): свой набор в
   *  голове страницы — окно без рамки, кнопки нужны на любой странице
   *  (замечание владельца 2026-10-10: в настройках управление окном пропадало). */
  cluster?: ReactNode;
};

export function SettingsPage({ theme, onToggleTheme, defaultModel, onChooseDefault, initialTab, onClose, cluster }: SettingsPageProps) {
  const [tab, setTab] = useState<Tab>(
    TABS.includes(initialTab as Tab) ? (initialTab as Tab) : TAB_OF_STATE[params.feed] ?? "вид",
  );
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
      <PageHead tab={tab} onTab={setTab} cluster={cluster}  />
      <div className="settings-page__body">
        {tab === "вид" ? <LookSection theme={theme} onToggleTheme={onToggleTheme}  /> : null}
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
        {tab === "плагины" ? <RulesSection settings={settings}  /> : null}
        {tab === "скиллы" ? <SkillsSection /> : null}
        {tab === "данные" ? <DataSection folder={settings.folder}  /> : null}
      </div>
    </main>
  );
}

/** Шапка страницы: заголовок и вкладки над скролл-областью; открытие —
 *  фокус на первой вкладке (спека «Клавиатура»). Кластер кнопок окна живёт
 *  в строке заголовка у правого края — он есть на любой странице. */
function PageHead({ tab, onTab, cluster }: { tab: Tab; onTab: (tab: Tab) => void; cluster?: ReactNode }) {
  const firstTab = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstTab.current?.focus();
  }, []);
  return (
    <div className="settings-page__head" data-tauri-drag-region>
      <div className="settings-page__top" data-tauri-drag-region>
        <h1 className="settings-page__title" data-tauri-drag-region>Настройки</h1>
        {cluster}
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

/** Вкладка «Плагины»: умолчания категорий теми же кнопками, что у Configure,
 *  и событийный счётчик (П-3) — opt-in тумблером. */
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
      <EventsCounter />
      <McpSection />
    </section>
  );
}

/** Событийный счётчик (П-3, T6/T8): opt-in тумблером — локальный JSONL в папке
 *  данных, без сети. Данные для проверки предпосылки №1: жизненный цикл
 *  плагинов против чат-сессий. Выключен — строк не пишет вовсе. */
function EventsCounter() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    bridge()
      .eventsStatus()
      .then((held) => {
        if (alive) {
          setOn(held);
        }
      })
      .catch(() => {
        if (alive) {
          setOn(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  const toggle = () => {
    const next = !(on ?? false);
    setOn(next);
    void bridge().eventsOptIn(next);
  };
  return (
    <div className="settings-row" data-testid="settings-events">
      <span className="settings-row__label">Счётчик событий</span>
      <span className="settings-row__value">
        <label className="settings-events" data-testid="settings-events-toggle">
          <input type="checkbox" checked={on ?? false} onChange={toggle} />
          <span>{on ? "включён" : "выключен"}</span>
        </label>
        <span className="settings-row__sub">
          Локальный файл событий в папке данных — установки, обновления, откаты,
          вызовы команд, чат-сессии. Без сети: данные никуда не уходят, помогают
          считать, чем вы пользуетесь.
        </span>
      </span>
    </div>
  );
}

/** MCP-серверы конфигурации движка (B6, владелец 14.10: «поддержка mcp
 *  обязательна»): список из opencode.json с тумблерами, добавление local/
 *  remote и удаление. Правка перезапускает движок — MCP читается при старте. */
function McpSection() {
  const [servers, setServers] = useState<McpServer[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"local" | "remote">("local");
  const [detail, setDetail] = useState("");

  const load = useCallback(() => {
    bridge()
      .mcpList()
      .then((list) => {
        setServers(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (name: string, enabled: boolean) => {
    bridge()
      .mcpSetEnabled(name, enabled)
      .then(load)
      .catch((reason: unknown) => setError(String(reason)));
  };
  const remove = (name: string) => {
    bridge()
      .mcpRemove(name)
      .then(load)
      .catch((reason: unknown) => setError(String(reason)));
  };
  const add = () => {
    bridge()
      .mcpAdd(name, kind, detail)
      .then(() => {
        setName("");
        setDetail("");
        setAdding(false);
        load();
      })
      .catch((reason: unknown) => setError(String(reason)));
  };

  return (
    <div className="settings-row settings-mcp" data-testid="settings-mcp">
      <span className="settings-row__label">MCP-серверы</span>
      <span className="settings-row__value">
        {error ? (
          <span className="settings-row__sub" data-testid="settings-mcp-error">
            {error}
          </span>
        ) : null}
        {servers === null && !error ? (
          <span className="settings-row__sub">Читаю серверы…</span>
        ) : null}
        {servers?.length ? (
          servers.map((one) => (
            <span className="settings-mcp__row" key={one.name} data-testid="settings-mcp-row">
              <span className="settings-mcp__name">
                {one.name} · {one.kind}
              </span>
              <span className="settings-row__sub">{one.detail}</span>
              <span className="settings-row__actions">
                <button
                  type="button"
                  className="settings-row__ghost"
                  data-testid="settings-mcp-toggle"
                  title={one.enabled ? "Выключить сервер" : "Включить сервер"}
                  onClick={() => toggle(one.name, !one.enabled)}
                >
                  {one.enabled ? "Выключить" : "Включить"}
                </button>
                <button
                  type="button"
                  className="settings-row__ghost"
                  data-testid="settings-mcp-remove"
                  title="Удалить сервер из конфигурации"
                  onClick={() => remove(one.name)}
                >
                  Удалить
                </button>
              </span>
            </span>
          ))
        ) : servers !== null ? (
          <span className="settings-row__sub" data-testid="settings-mcp-empty">
            MCP-серверов нет — добавьте первый кнопкой ниже
          </span>
        ) : null}
        {adding ? (
          <span className="settings-mcp__add" data-testid="settings-mcp-add-form">
            <input
              className="settings-key-form__input"
              data-testid="settings-mcp-name"
              placeholder="Имя сервера"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <select
              className="settings-mcp__kind"
              data-testid="settings-mcp-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as "local" | "remote")}
            >
              <option value="local">local — команда</option>
              <option value="remote">remote — адрес</option>
            </select>
            <input
              className="settings-key-form__input"
              data-testid="settings-mcp-detail"
              placeholder={kind === "remote" ? "https://…" : "команда через пробел"}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
            <button
              type="button"
              className="settings-key-form__save"
              data-testid="settings-mcp-save"
              onClick={add}
            >
              Добавить
            </button>
            <button
              type="button"
              className="settings-row__ghost"
              data-testid="settings-mcp-add-cancel"
              onClick={() => setAdding(false)}
            >
              Отмена
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="settings-row__ghost"
            data-testid="settings-mcp-add"
            onClick={() => setAdding(true)}
          >
            Добавить MCP-сервер
          </button>
        )}
        <span className="settings-row__sub">
          Конфиг пишется каноническим JSON — комментарии в opencode.json не
          сохранятся. Правка перезапускает движок.
        </span>
      </span>
    </div>
  );
}

/** Вкладка «Скиллы» (B7, правка владельца 15.10): скилл приходит файлом —
 *  зона перетаскивания .md вместо выбора вручную, создания формой нет.
 *  Скилл = markdown-файл команды движка (command/*.md): имя — из имени файла,
 *  описание — из frontmatter, текст — инструкция; правка перезапускает движок,
 *  кнопка скилла появляется в шапке чата. */
function SkillsSection() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState("");
  /** Редактируемый скилл: null — список, иначе — правка по имени. */
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [text, setText] = useState("");

  const load = useCallback(() => {
    bridge()
      .skillsList()
      .then((list) => {
        setSkills(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Файл .md брошен в зону: имя — из имени файла (его.slug-ит мост),
   *  описание — имя файла, текст — содержимое; скилл появляется в списке. */
  const acceptFile = (file: string, content: string) => {
    const title = file.replace(/\.md$/i, "");
    bridge()
      .skillsSave(title, title, content)
      .then((list) => {
        setSkills(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  };

  const startEdit = (skill: Skill) => {
    setName(skill.name);
    setDescription(skill.description);
    setText(skill.text);
    setEditing(skill.name);
  };
  const save = () => {
    bridge()
      .skillsSave(name, description, text)
      .then((list) => {
        setSkills(list);
        setError("");
        setEditing(null);
      })
      .catch((reason: unknown) => setError(String(reason)));
  };
  const remove = (skill: string) => {
    bridge()
      .skillsRemove(skill)
      .then((list) => {
        setSkills(list);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  };

  return (
    <section className="settings-section" data-testid="settings-skills">
      <h2 className="settings-section__title">Скиллы — свои команды для чата</h2>
      <div className="settings-row__hint settings-rules__hint">
        Инструкция, которой следует модель: «научить конвертировать картинку в
        3D», «собирать доклад по проекту». Скилл появляется кнопкой в шапке чата.
      </div>
      {error ? (
        <div className="settings-row__sub" data-testid="skills-error">
          {error}
        </div>
      ) : null}
      <DropZone
        ext="md"
        hint="Перетащите файл скилла"
        onFile={acceptFile}
        testid="skills-drop"
      />
      {skills === null ? (
        <div className="settings-row__sub">Читаю скиллы…</div>
      ) : null}
      {skills?.map((skill) =>
        editing === skill.name ? null : (
          <div className="settings-row" key={skill.name} data-testid="skills-row">
            <span className="settings-row__label">{skill.name}</span>
            <span className="settings-row__value">
              <span className="settings-row__sub">{skill.description}</span>
            </span>
            <span className="settings-row__actions">
              <button
                type="button"
                className="settings-row__ghost"
                data-testid="skills-edit"
                onClick={() => startEdit(skill)}
              >
                Редактировать
              </button>
              <button
                type="button"
                className="settings-row__ghost"
                data-testid="skills-remove"
                onClick={() => remove(skill.name)}
              >
                Удалить
              </button>
            </span>
          </div>
        ),
      )}
      {skills !== null && !skills.length ? (
        <div className="settings-row__sub" data-testid="skills-empty">
          Скиллов нет — бросьте первый .md файл в зону выше.
        </div>
      ) : null}
      {editing !== null ? (
        <div className="settings-mcp__add" data-testid="skills-form">
          <div className="settings-row__sub" data-testid="skills-form-title">
            Правка скилла «{editing}»
          </div>
          <input
            className="settings-key-form__input"
            data-testid="skills-description"
            placeholder="Описание для списка"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <textarea
            className="settings-key-form__input settings-skills__text"
            data-testid="skills-text"
            placeholder="Инструкция модели: что делать и как"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <button
            type="button"
            className="settings-key-form__save"
            data-testid="skills-save"
            onClick={save}
          >
            Сохранить
          </button>
          <button
            type="button"
            className="settings-row__ghost"
            data-testid="skills-cancel"
            onClick={() => setEditing(null)}
          >
            Отмена
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Вкладка «Папка данных»: полный путь и его копирование; смены пути нет. */function DataSection({ folder }: { folder: string }) {
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
