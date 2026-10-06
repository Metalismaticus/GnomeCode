/** Раздел «Плагины» (docs/SPEC/plugins.md, сцена A): открывается из главной левой
 *  навигации, вкладки Installed / Available / Updates / Disabled, карточки плагинов
 *  с полями сцены A и действиями Enable/Disable/Uninstall — с подтверждением удаления.
 *
 *  Available — переход в готовый каталог «Browse plugins…» (пункт 1 партии): тот же
 *  оверлей CatalogPicker и сводка прав установки. Updates — обновления при запуске
 *  (пункт 4 партии): карточки из updates.json и сводка новых прав — PluginUpdates. */

import { useCallback, useEffect, useState } from "react";

import type { CatalogEntry } from "../catalog";
import type { Plugin } from "../bridge";
import { useCatalog } from "../features/plugins/useCatalog";
import { usePlugins } from "../features/plugins/usePlugins";
import { CatalogPicker } from "./CatalogPicker";
import { PluginConfig } from "./PluginConfig";
import { PluginSummary } from "./PluginSummary";
import { PluginUpdates } from "./PluginUpdates";
import { params } from "../viewparams";

import "./PluginsPage.css";
import "./PluginUpdates.css";

type Tab = "installed" | "available" | "updates" | "disabled";

const TITLES: Record<Exclude<Tab, "installed"> | "installed", string> = {
  installed: "Installed",
  available: "Available",
  updates: "Updates",
  disabled: "Disabled",
};

/** Вкладки сцены A с их подписями: порядок как у образца спеки. */

const TABS: Tab[] = ["installed", "available", "updates", "disabled"];

export function PluginsPage() {
  /** Состояние «плагины-обновления» открывает раздел прямо на Updates — карточки
   *  обновлений проверяемый экран; обычный вход — Installed. */
  const [tab, setTab] = useState<Tab>(params.feed === "plugins-updates" ? "updates" : "installed");
  const [catalogOpen, setCatalogOpen] = useState(false);
  /** Карточка каталога, чью сводку прав открыли из вкладки Available. */
  const [pending, setPending] = useState<CatalogEntry | undefined>(undefined);
  /** Запись обновления, чью сводку новых прав открыли с карточки Updates. */
  const [updateSummary, setUpdateSummary] = useState<CatalogEntry | undefined>(undefined);
  const plugins = usePlugins();
  const catalog = useCatalog(catalogOpen);
  /** Окно подтверждения удаления: id карточки, с которой кликнули по Uninstall. */
  const [confirm, setConfirm] = useState<string | undefined>(undefined);
  /** Панель правил Configure: id карточки, с которой кликнули по Configure. */
  const [config, setConfig] = useState<string | undefined>(undefined);

  /** Available открывает каталог оверлеем; после его закрытия владелец снова
   *  видит Installed. */
  const openCatalog = useCallback(() => {
    setTab("available");
    setCatalogOpen(true);
  }, []);
  const closeCatalog = useCallback(() => {
    setCatalogOpen(false);
    setTab("installed");
  }, []);

  /** Esc и клик снаружи закрывают каталог, сводку прав, окно удаления и панель
   *  правил — тот же жест, что у ChatView (useOverlayDismiss), но набор
   *  поверхностей свой: хук ChatView про свои окна ничего не знает, общего
   *  места для него нет. */
  useEffect(() => {
    if (!catalogOpen && !pending && !updateSummary && !confirm && !config) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCatalogOpen(false);
        setPending(undefined);
        setUpdateSummary(undefined);
        setConfirm(undefined);
        setConfig(undefined);
      }
    };
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest(".catalog-picker") ||
        target?.closest(".plugin-summary") ||
        target?.closest(".plugins-confirm") ||
        target?.closest(".plugin-config") ||
        target?.closest(".plugins-page")
      ) {
        return;
      }
      setCatalogOpen(false);
      setPending(undefined);
      setUpdateSummary(undefined);
      setConfirm(undefined);
      setConfig(undefined);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [catalogOpen, pending, updateSummary, confirm, config]);

  /** «Разрешить» сводки прав: установка и подключение — как у каталога в чате;
   *  плагин тут же виден во вкладке Installed. */
  const allowInstall = useCallback(
    (entry: CatalogEntry) => {
      setPending(undefined);
      plugins.install(entry.id);
      setCatalogOpen(false);
      setTab("installed");
    },
    [plugins.install],
  );

  const installFromCatalog = useCallback((entry: CatalogEntry) => setPending(entry), []);

  /** Кнопка сводки на карточке Updates: запись обновления становится сводкой
   *  прав — новые права показываются до включения (сцена K). */
  const openUpdateSummary = useCallback(
    (id: string) => {
      const one = plugins.plugins.find((plugin) => plugin.id === id);
      if (one?.update) {
        setUpdateSummary(entryFromUpdate(one, one.update));
      }
    },
    [plugins.plugins],
  );

  /** «Разрешить» сводки обновления: установка версии `to` и подключение — тем же
   *  путём моста, что у каталога; пометку пересчитает plugin_list (Held → Applied).
   *  Вкладка Updates остаётся открытой — карточка покажет итог. */
  const allowUpdate = useCallback(
    (entry: CatalogEntry) => {
      setUpdateSummary(undefined);
      plugins.install(entry.id);
    },
    [plugins.install],
  );

  /** Плагин открытой панели Configure из свежего списка: после смены правила
   *  список приходит новый, и панель показывает правило нажатой кнопкой. */
  const configured = config ? plugins.plugins.find((one) => one.id === config) : undefined;

  return (
    <main className="plugins-page" data-testid="plugins-page">
      <div className="plugins-page__head">
        <h1 className="plugins-page__title">Плагины</h1>
        <div className="plugins-page__tabs" role="tablist" aria-label="Разделы плагинов">
          {TABS.map((one) => (
            <button
              key={one}
              type="button"
              role="tab"
              aria-selected={tab === one && !catalogOpen}
              className="plugins-page__tab"
              data-testid={`plugin-tab-${one}`}
              onClick={one === "available" ? openCatalog : () => setTab(one)}
            >
              {TITLES[one]}
            </button>
          ))}
        </div>
      </div>
      <div className="plugins-page__body">
        {tab === "installed" ? (
          <>
            {plugins.plugins.filter((one) => !one.disabled).map((one) => (
              <Card
                key={one.id}
                plugin={one}
                onDisable={() => plugins.setEnabled(true, one.id)}
                onUninstall={() => setConfirm(one.id)}
                onConfigure={() => setConfig(one.id)}
              />
            ))}
            {!plugins.plugins.some((one) => !one.disabled) ? (
              <div className="plugins-page__empty" data-testid="plugins-installed-empty">
                Установленных плагинов нет
              </div>
            ) : null}
          </>
        ) : null}
        {tab === "available" ? (
          <div className="plugins-page__empty" data-testid="plugins-available-note">
            Каталог доступных плагинов открывается окном вкладки — Installed вернётся, когда его закроют.
          </div>
        ) : null}
        {tab === "updates" ? (
          <PluginUpdates
            plugins={plugins.plugins}
            note={plugins.updatesNote}
            onAllow={openUpdateSummary}
          />
        ) : null}
        {tab === "disabled" ? (
          <>
            {plugins.plugins.filter((one) => one.disabled).map((one) => (
              <Card
                key={one.id}
                plugin={one}
                onEnable={() => plugins.setEnabled(false, one.id)}
                onUninstall={() => setConfirm(one.id)}
              />
            ))}
            {!plugins.plugins.some((one) => one.disabled) ? (
              <div className="plugins-page__empty" data-testid="plugins-disabled-empty">
                Отключённых плагинов нет
              </div>
            ) : null}
          </>
        ) : null}
        {plugins.error ? (
          <div className="plugins-page__empty" data-testid="plugins-error">
            Список плагинов не читается: {plugins.error}
          </div>
        ) : null}
      </div>
      {confirm ? <UninstallConfirm plugins={plugins.plugins} id={confirm}
        onYes={() => {
          plugins.uninstall(confirm);
          setConfirm(undefined);
        }}
        onNo={() => setConfirm(undefined)}
      /> : null}
      {configured ? (
        <PluginConfig
          plugin={configured}
          onSetRule={(category, value) => config && plugins.setRule(config, category, value)}
          onClose={() => setConfig(undefined)}
        />
      ) : null}
      {catalogOpen ? (
        <CatalogPicker catalog={catalog} onInstall={installFromCatalog} onClose={closeCatalog} />
      ) : null}
      {pending ? <PluginSummary entry={pending} onAllow={allowInstall} onCancel={() => setPending(undefined)} /> : null}
      {updateSummary ? <PluginSummary entry={updateSummary} onAllow={allowUpdate} onCancel={() => setUpdateSummary(undefined)} /> : null}    </main>
  );
}

/** Пометка обновления на форме сводки прав: права вида «Категория: значение»
 *  приходят строками из updates.json — разобрать их бывает нужно один раз. */
function entryFromUpdate(plugin: Plugin, update: NonNullable<Plugin["update"]>): CatalogEntry {
  return {
    id: plugin.id,
    name: plugin.name ?? plugin.id,
    description: plugin.description ?? "",
    author: plugin.author ?? "",
    version: update.to,
    repo: "",
    entry: "",
    permissions:
      update.permissions?.map((line) => {
        const at = line.indexOf(": ");
        return { category: line.slice(0, at), value: line.slice(at + 2) };
      }) ?? [],
    commands: [],
  };
}

/** Статус на карточке словами: выключен / не запустился с причиной / активен. */
function statusOf(plugin: Plugin): string {
  if (plugin.disabled) {
    return "выключен";
  }
  if (plugin.state === "failed") {
    return `не запустился — ${plugin.error}`;
  }
  return "активен";
}

/** Карточка плагина сцены A: иконка-буква, имя, автор, версия, описание, права,
 *  команды и статус; Enable/Disable у всех, Uninstall — только у записанных
 *  во установленный реестр (плагин движка из реестра не известен — кнопка не показывается). */
export function Card({
  plugin,
  onEnable,
  onDisable,
  onUninstall,
  onConfigure,
}: {
  plugin: Plugin;
  /** Enable есть у выключенного плагина, Disable — у включённого. */
  onEnable?: () => void;
  onDisable?: () => void;
  onUninstall?: () => void;
  /** Панель правил категорий (Configure) — у включённого плагина. */
  onConfigure?: () => void;
}) {
  const name = plugin.name ?? plugin.id;
  return (
    <article className="plugin-card" data-testid="plugin-card" data-plugin={plugin.id}>
      <span className="plugin-card__icon" aria-hidden="true">{name.charAt(0).toUpperCase()}</span>
      <div className="plugin-card__body">
        <div className="plugin-card__line">
          <span className="plugin-card__name">{name}</span>
          {plugin.version ? <span className="plugin-card__version">{plugin.version}</span> : null}
          <span className="plugin-card__status">{statusOf(plugin)}</span>
        </div>
        {plugin.author ? <div className="plugin-card__author">{plugin.author}</div> : null}
        <div className="plugin-card__description">{plugin.description ?? plugin.id}</div>
        {plugin.permissions?.length ? (
          <div className="plugin-card__permissions" data-testid="plugin-card-permissions">
            {plugin.permissions.map((one) => (
              <span className="plugin-card__permission" key={one}>{one}</span>
            ))}
          </div>
        ) : null}
        {plugin.commands.length ? (
          <div className="plugin-card__commands" data-testid="plugin-card-commands">
            {plugin.commands.map((command) => (
              <span className="plugin-card__command" key={command.name} title={command.description}>
                {command.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <div className="plugin-card__actions">
        {plugin.disabled ? onEnable && (
          <button
            type="button"
            className="plugin-card__action"
            data-testid="plugin-enable"
            title="Включить плагин: кнопки команд вернутся в чаты"
            onClick={onEnable}
          >
            Enable
          </button>
        ) : onDisable && (
          <button
            type="button"
            className="plugin-card__action"
            data-testid="plugin-disable"
            title="Выключить плагин: кнопки команд уйдут из чатов, сам плагин останется"
            onClick={onDisable}
          >
            Disable
          </button>
        )}
        {onConfigure ? (
          <button
            type="button"
            className="plugin-card__action"
            data-testid="plugin-configure"
            title="Правила категорий: allow / ask / deny"
            onClick={onConfigure}
          >
            Configure
          </button>
        ) : null}
        {plugin.uninstallable && onUninstall ? (
          <button
            type="button"
            className="plugin-card__action plugin-card__action--danger"
            data-testid="plugin-uninstall"
            title={`Удалить ${name}: запись реестра и файл плагина`}
            onClick={onUninstall}
          >
            Uninstall
          </button>
        ) : null}

      </div>
    </article>
  );
}

/** Окно подтверждения удаления (docs/SPEC/plugins.md, сцена A, «Uninstall
 *  с подтверждением»): ответ — Удалить или Отмена, ничего само не решает. */
function UninstallConfirm({
  plugins,
  id,
  onYes,
  onNo,
}: {
  plugins: Plugin[];
  id: string;
  onYes: () => void;
  onNo: () => void;
}) {
  const known = plugins.find((one) => one.id === id);
  const name = known?.name ?? id;
  return (
    <div
      className="plugins-confirm"
      data-testid="plugin-uninstall-confirm"
      role="alertdialog"
      aria-label={`Удаление плагина ${name}`}
    >
      <div className="plugins-confirm__title">Удалить плагин {name}?</div>
      <div className="plugins-confirm__text">
        Запись реестра и файл плагина будут удалены. Поставить его можно заново из каталога.
      </div>
      <div className="plugins-confirm__actions">
        <button
          type="button"
          className="plugins-confirm__btn"
          data-testid="uninstall-no"
          title="Ничего не удалять"
          onClick={onNo}
        >
          Отмена
        </button>
        <button
          type="button"
          className="plugins-confirm__btn plugins-confirm__btn--danger"
          data-testid="uninstall-yes"
          title="Удалить запись и файл плагина"
          onClick={onYes}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
