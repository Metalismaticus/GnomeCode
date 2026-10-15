/** Раздел «Плагины» (docs/SPEC/plugins.md, сцена A): открывается из главной левой
 *  навигации, вкладки Installed / Available / Updates / Disabled, карточки плагинов
 *  с полями сцены A и действиями Enable/Disable/Uninstall — с подтверждением удаления.
 *
 *  Available — переход в готовый каталог «Browse plugins…» (пункт 1 партии): тот же
 *  оверлей CatalogPicker и сводка прав установки. Updates — обновления при запуске
 *  (пункт 4 партии): карточки из updates.json и сводка новых прав — PluginUpdates. */

import { useCallback, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";

import { bridge } from "../bridge";
import type { Plugin, PluginScope } from "../bridge";
import type { CatalogEntry } from "../catalog";
import { useCatalog } from "../features/plugins/useCatalog";
import { useHeldSummary, type PluginsState } from "../features/plugins/usePlugins";
import { CatalogPicker } from "./CatalogPicker";
import { DropZone } from "./DropZone";
import { PluginConfig } from "./PluginConfig";
import { PluginEnableGate } from "./PluginEnableGate";
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

export function PluginsPage({ plugins, cluster }: { plugins: PluginsState; cluster?: ReactNode }) {
  /** Состояние «плагины-обновления» открывает раздел прямо на Updates — карточки
   *  обновлений проверяемый экран; обычный вход — Installed. */
  const [tab, setTab] = useState<Tab>(params.feed === "plugins-updates" ? "updates" : "installed");
  const [catalogOpen, setCatalogOpen] = useState(false);
  /** Карточка каталога, чью сводку прав открыли из вкладки Available. */
  const [pending, setPending] = useState<CatalogEntry | undefined>(undefined);
  /** Сводка обновления: сама при старте (held-записи, сцена K) или по кнопке
   *  «Обновить» карточки — окно одно, его держит useHeldSummary. */
  const { summary: heldSummary, allow: allowHeld, cancel: cancelHeld } =
    useHeldSummary(plugins);
  /** Применить обновление из карточки (DT3): тот же plugin_install, что и
   *  «Разрешить» сводки; отказ летит в стек «Обновить всё» — он считает K. */
  const applyUpdate = useCallback(
    async (id: string) => {
      await bridge().installPlugin(id);
      plugins.refresh();
    },
    [plugins.refresh],
  );
  const catalog = useCatalog(catalogOpen);
  /** Окно подтверждения удаления: id карточки, с которой кликнули по Uninstall. */
  const [confirm, setConfirm] = useState<string | undefined>(undefined);
  /** Панель правил Configure: id карточки, с которой кликнули по Configure. */
  const [config, setConfig] = useState<string | undefined>(undefined);
  /** Сводка прав первого включения (сцена H): плагин из вкладки Disabled,
   *  чей Enable ещё не проходил сводку. */
  const [enableGate, setEnableGate] = useState<Plugin | undefined>(undefined);
  /** Заметка зоны перетаскивания (B6): «добавлен — включите во вкладке
   *  Disabled» или честный отказ; сама уходит через 6 секунд. Таймер держится
   *  в ref — быстрый второй бросок не даёт первому таймеру съесть свою заметку. */
  const [dropNote, setDropNote] = useState<{ ok: boolean; text: string } | null>(null);
  const dropTimer = useRef<number | null>(null);
  /** Над страницей тащат файл: подсветка — бросить можно в любое место раздела,
   *  не только в зону на вкладке Installed (замечание владельца 15.10). */
  const [pageDropHot, setPageDropHot] = useState(false);

  /** Файл .ts брошен в зону: установка внешнего плагина (файл + реестр +
   *  тихий рестарт движка), список перечитывается — плагин во вкладке Disabled. */
  const acceptPluginFile = useCallback(
    (name: string, code: string) => {
      bridge()
        .installPluginFile(name, code)
        .then((id) => {
          plugins.refresh();
          setDropNote({
            ok: true,
            text: `Плагин «${id}» добавлен — включите его во вкладке Disabled`,
          });
        })
        .catch((reason: unknown) => {
          setDropNote({ ok: false, text: `Не добавилось: ${String(reason)}` });
        })
        .finally(() => {
          if (dropTimer.current) {
            window.clearTimeout(dropTimer.current);
          }
          dropTimer.current = window.setTimeout(() => setDropNote(null), 6000);
        });
    },
    [plugins.refresh],
  );

  /** Бросок на любое место раздела: файл .ts из проводника или файл проекта
   *  из дерева (его текст мост читает с guard'ом «внутри папки проекта»). */
  const dropOnPage = useCallback(
    (event: ReactDragEvent) => {
      event.preventDefault();
      setPageDropHot(false);
      const osFile = event.dataTransfer.files?.[0];
      if (osFile) {
        if (!osFile.name.toLowerCase().endsWith(".ts")) {
          setDropNote({ ok: false, text: `Нужен файл .ts — «${osFile.name}» не подходит` });
          return;
        }
        void osFile.text().then((code) => acceptPluginFile(osFile.name, code));
        return;
      }
      const path = event.dataTransfer.getData("text/plain");
      if (path) {
        const name = path.split(/[\\/]/).pop() ?? "plugin.ts";
        if (!name.toLowerCase().endsWith(".ts")) {
          setDropNote({ ok: false, text: `Нужен файл .ts — «${name}» не подходит` });
          return;
        }
        void bridge()
          .readText(path)
          .then((code) => acceptPluginFile(name, code))
          .catch((reason: unknown) => {
            setDropNote({ ok: false, text: `Не добавилось: ${String(reason)}` });
          });
      }
    },
    [acceptPluginFile],
  );

  /** Включение из вкладки Disabled: у плагина уже есть запись правил — сводку
   *  показывали, включаем сразу; нет — первый раз через сцену H (T1). */
  const askEnable = (plugin: Plugin) => {
    if (plugin.rules !== undefined) {
      plugins.setEnabled(false, plugin.id);
      return;
    }
    setEnableGate(plugin);
  };

  /** «Разрешить и включить» (сцена H): выбор действует на первый вызов —
   *  объявленные категории становятся правилами allow (слой прав читает их
   *  без перезапуска); дальше само включение. */
  const allowEnable = (plugin: Plugin) => {
    for (const one of plugin.permissions ?? []) {
      const category = one.split(":")[0]?.trim();
      if (category) {
        plugins.setRule(plugin.id, category, "allow");
      }
    }
    plugins.setEnabled(false, plugin.id);
    setEnableGate(undefined);
  };

  /** Available открывает каталог оверлеем; после его закрытия владелец снова
   *  видит Installed. */
  const openCatalog = useCallback(() => {
    setTab("available");
    setCatalogOpen(true);
  }, []);
  /** Updates по клику вкладки/бейджа (F3): вкладка открывается, первая ждущая
   *  карточка получает фокус — решение видно сразу, искать глазами не надо.
   *  Двойной кадр: фокус ставится после коммита и отрисовки вкладки. */
  const openUpdates = useCallback(() => {
    setTab("updates");
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[data-testid="plugin-update-card"][data-held="true"]')
          ?.focus();
      });
    });
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
    if (!catalogOpen && !pending && !heldSummary && !confirm && !config) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCatalogOpen(false);
        setPending(undefined);
        cancelHeld();
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
      cancelHeld();
      setConfirm(undefined);
      setConfig(undefined);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [catalogOpen, pending, heldSummary, confirm, config, cancelHeld]);

  /** «Разрешить» сводки прав и кнопки скоупа: установка и подключение — как у
   *  каталога в чате; плагин тут же виден во вкладке Installed. */
  const allowInstall = useCallback(
    (entry: CatalogEntry, scope?: PluginScope) => {
      setPending(undefined);
      plugins.install(entry.id, scope);
      setCatalogOpen(false);
      setTab("installed");
    },
    [plugins.install],
  );

  const installFromCatalog = useCallback((entry: CatalogEntry) => setPending(entry), []);

  /** Плагин открытой панели Configure из свежего списка: после смены правила
   *  список приходит новый, и панель показывает правило нажатой кнопкой. */
  const configured = config ? plugins.plugins.find((one) => one.id === config) : undefined;

  return (
    <main
      className={pageDropHot ? "plugins-page plugins-page--drop" : "plugins-page"}
      data-testid="plugins-page"
      onDragOver={(event) => {
        if (
          event.dataTransfer.types.includes("Files") ||
          event.dataTransfer.types.includes("text/plain")
        ) {
          event.preventDefault();
          setPageDropHot(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPageDropHot(false);
        }
      }}
      onDrop={dropOnPage}
    >
      <div className="plugins-page__head" data-tauri-drag-region>
        <h1 className="plugins-page__title" data-tauri-drag-region>Плагины</h1>
        <div className="plugins-page__tabs" role="tablist" aria-label="Разделы плагинов">
          {TABS.map((one) => (
            <button
              key={one}
              type="button"
              role="tab"
              aria-selected={tab === one && !catalogOpen}
              className="plugins-page__tab"
              data-testid={`plugin-tab-${one}`}
              onClick={one === "available" ? openCatalog : one === "updates" ? openUpdates : () => setTab(one)}
            >
              {TITLES[one]}
              {/* Бейдж обновлений (CE-5, 5.1): только ждущие одобрения прав,
                  при нуле скрывается; клик открывает вкладку и фокусирует
                  первую ждущую карточку (F3). */}
              {one === "updates" && plugins.heldUpdates.length ? (
                <span className="plugins-page__tab-badge" data-testid="updates-badge">
                  {plugins.heldUpdates.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {cluster}
      </div>
      <div className="plugins-page__body">
        {tab === "installed" ? (
          <>
            {dropNote ? (
              <div
                className={dropNote.ok ? "plugins-page__toast" : "plugins-page__toast plugins-page__toast--bad"}
                data-testid="plugins-drop-note"
              >
                {dropNote.text}
              </div>
            ) : null}
            <DropZone
              ext="ts"
              hint="Перетащите внешний плагин"
              onFile={acceptPluginFile}
              testid="plugins-drop"
            />
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
            onApply={applyUpdate}
            onDecline={plugins.declineUpdate}
          />
        ) : null}
        {tab === "disabled" ? (
          <>
            {plugins.plugins.filter((one) => one.disabled).map((one) => (
              <Card
                key={one.id}
                plugin={one}
                onEnable={() => askEnable(one)}
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
        <CatalogPicker catalog={catalog} onInstall={installFromCatalog} onClose={closeCatalog}  />
      ) : null}
      {pending ? <PluginSummary entry={pending} onAllow={allowInstall} onCancel={() => setPending(undefined)} /> : null}
      {heldSummary ? <PluginSummary entry={heldSummary} onAllow={allowHeld} onCancel={cancelHeld}  /> : null}
      {enableGate ? (
        <PluginEnableGate
          plugin={enableGate}
          onAllow={allowEnable}
          onCancel={() => setEnableGate(undefined)}
        />
      ) : null}
    </main>
  );
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
        {plugin.usage ? (
          <div className="plugin-card__usage" data-testid="plugin-card-usage">
            Вызовов: {plugin.usage.count}
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
