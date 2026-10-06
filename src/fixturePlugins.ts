// Плагины вне окна Tauri: та же форма, что отдаёт мост (src-tauri/src/plugins), —
// список установленных, команды и отметка «подключён к чату». Источник правды на
// живой движок — `GET /api/plugin` и `GET /api/command`; здесь та же форма на
// странице vite, чтобы сценарий проверки видел то же, что продукт
// (docs/specs/2026-10-05-4-glavnoe-okno.md, «Настоящие данные»).
//
// Список бывает пустым — это законное состояние движка, а не поломка: пустой
// список отдаёт `?состояние=плагины-пусто`.
//
// Подключение — наша запись (реестр чата), а не вызов сервера: `POST /api/plugin`
// у движка не существует. Здесь оно живёт в состоянии страницы, на диск не пишется
// (docs/TESTING.md, «Данные пользователя»).
//
// Отключение, включение и удаление — действия раздела «Плагины» (docs/SPEC/plugins.md,
// сцена A): поля карточки — из реестра установленного ([`install.rs`], у плагина
// движка их нет), а отметка выгрузки — у записи реестра установленного.

import type { Plugin } from "./bridge";
import { params } from "./viewparams";
import { rulesMap } from "./fixtureApprovals";

/** Подключённые к чату плагины: то же, что держит реестр чата в окне Tauri. */
const connected = new Set<string>();
/** Отключённые плагины: то же, что поле `disabled` записи реестра в окне. */
const disabled = new Set<string>();

/** Форма карточки, которой у плагина движка нет: имя, автор, версия, описание,
 *  права и отметка записи в реестре. У плагина движка — все пусто. */
export type Card = {
  name?: string;
  author?: string;
  version?: string;
  description?: string;
  /** Права в виде «Категория: значение» — так их знает сводка установки. */
  permissions?: string[];
  /** Плагин из реестра установленного: карточке доступен Uninstall. */
  uninstallable?: boolean;
};

/** Плагин с карточными полями: команды с префиксом `плагин:`, как у движка. */
const plugin = (
  id: string,
  commands: { name: string; description: string; category?: string }[],
  card: Card = {},
  state: Plugin["state"] = "active",
  error = "",
): Plugin => ({
  commands: commands.map((one) => ({
    name: `${id}:${one.name}`,
    label: one.name,
    description: one.description,
    category: one.category,
  })),
  error,
  id,
  state,
  connected: false,
  ...card,
});

/** Настоящие имена плагинов, а не «Lorem ipsum»: один с одной командой
 *  (одна команда — одна кнопка, docs/ROADMAP.md, «Крайние случаи»), один с двумя
 *  и записью реестра, один не запустился — в строке видна причина, он движка
 *  и без записи: Uninstall у него не показывается. */
const PLUGINS: Plugin[] = [
  plugin(
    "git",
    [
      { name: "diff", description: "показать изменения рабочей папки", category: "Network" },
      { name: "commit", description: "собрать коммит с описанием", category: "Write" },
    ],
    {
      name: "Git",
      author: "Metalismaticus",
      version: "1.0.0",
      description: "Изменения рабочей папки: diff и коммит с описанием",
      permissions: ["Network: git provider", "Write: ask"],
      uninstallable: true,
    },
  ),
  plugin(
    "docs",
    [{ name: "search", description: "поиск по документации проекта", category: "Read" }],
    {
      name: "Docs",
      author: "Metalismaticus",
      version: "0.9.0",
      description: "Поиск по документации проекта",
      permissions: ["Read: файлы документации"],
      uninstallable: true,
    },
  ),
  plugin(
    "browser",
    [
      { name: "open", description: "открыть страницу и показать её текст", category: "Network" },
      { name: "shot", description: "снять страницу картинкой", category: "Network" },
    ],
    {
      name: "Browser",
      author: "OpenCode",
      version: "0.6.3",
      description: "Открытие страниц и снимки для проверки",
      permissions: ["Network: http"],
    },
    "failed",
    "модуль браузера не установлен: playwright install chromium",
  ),
];

/** Обновления из updates.json в состоянии «плагины-обновления»: git обновился
 *  молча (права те же — реестр стоит на новой версии), docs ждёт прав (новая
 *  категория Write — файл прежней версии), browser уже обновился — история.
 *  Та же форма, что у записи updates.json (src-tauri/src/plugins/updates.rs). */
const UPDATE_FIXTURE: Record<string, NonNullable<Plugin["update"]>> = {
  git: { from: "1.0.0", to: "1.1.0", status: "applied" },
  docs: {
    from: "0.9.0",
    to: "1.0.0",
    status: "held",
    permissions: ["Read: файлы документации", "Write: ask"],
  },
  browser: { from: "0.6.2", to: "0.6.3", status: "applied" },
};

/** Список установленных плагинов по состоянию страницы: с плагинами или пустой.
 *  Состояние «одобрение» — тот же список: слой прав не меняет, что установлено;
 *  в состоянии «каталог» список нужен — оттуда и начинается установка; в разделе
 *  «Плагины» — сами карточки. */
export function plugins(): Plugin[] {
  if (
    params.feed !== "plugins" &&
    params.feed !== "approval" &&
    params.feed !== "catalog" &&
    params.feed !== "plugins-section" &&
    params.feed !== "plugins-updates"
  ) {
    return [];
  }
  const updates = params.feed === "plugins-updates";
  return PLUGINS.map((one) => {
    const rules = rulesMap(one.id);
    const update = updates ? UPDATE_FIXTURE[one.id] : undefined;
    return {
      ...one,
      connected: connected.has(one.id),
      disabled: disabled.has(one.id),
      ...(Object.keys(rules).length ? { rules } : {}),
      // Обновление молча сдаёт реестр на новую версию — карточка ждёт прав стоит
      // на прежней (файл не тронут до сводки).
      ...(update ? { update, version: update.status === "applied" ? update.to : one.version } : {}),
    };
  });
}

/** «Разрешить» сводки новых прав на вкладке Updates: принять обновленную версию —
 *  статус «ждёт прав» уходит в «обновлено», права приняты, карточка показывает
 *  версию `to` (то же, что plugin_install + refresh в окне). Память страницы —
 *  перезагрузка страницы снова ставит все обновления по местам. */
export function applyUpdate(id: string): Plugin[] {
  const update = UPDATE_FIXTURE[id];
  if (!update || update.status !== "held") {
    throw new Error(`по плагину «${id}» нет обновления, ждущего прав`);
  }
  update.status = "applied";
  update.permissions = [];
  return plugins();
}

/** Подключение к чату: отмечаем плагин и отдаём список заново — как это делает мост. */
export function connect(list: Plugin[], id: string): Plugin[] {
  connected.add(id);
  return list.map((one) => (one.id === id ? { ...one, connected: true } : one));
}

/** Disable силы: плагин остаётся установленным, кнопки команд из чатов уходят.
 *  Запись — по форме поля `disabled` реестра (src-tauri/src/plugins/manage.rs). */
export function disable(list: Plugin[], id: string): Plugin[] {
  disabled.add(id);
  return list.map((one) => (one.id === id ? { ...one, disabled: true } : one));
}

/** Enable: карточка возвращается во вкладку Installed и кнопки в шапки чатов. */
export function enable(list: Plugin[], id: string): Plugin[] {
  disabled.delete(id);
  return list.map((one) => (one.id === id ? { ...one, disabled: false } : one));
}

/** Uninstall: запись реестра и файл плагина уходят — карточка исчезает из раздела. */
export function uninstall(list: Plugin[], id: string): Plugin[] {
  const gone = PLUGINS.findIndex((one) => one.id === id);
  if (gone === -1) {
    throw new Error(`в реестре нет записи о плагине «${id}»`);
  }
  PLUGINS.splice(gone, 1);
  connected.delete(id);
  disabled.delete(id);
  return list.filter((one) => one.id !== id);
}

/** Собрать плагин из карточки каталога: команды получают префикс `плагин:`,
 *  как их приписывает движок (src-tauri/src/plugins/catalog.rs); поля карточки
 *  — от записи каталога, после установки они видны в разделе «Плагины». */
export function builder(
  id: string,
  commands: { name: string; description: string }[],
  card: Card = {},
): Plugin {
  return plugin(id, commands, card);
}

/** Принять установленный из каталога плагин: карточка становится строкой списка
 *  установленных и сразу подключается к чату — «Allow» сводки прав делает оба шага. */
export function adopt(one: Plugin): void {
  if (!PLUGINS.some((known) => known.id === one.id)) {
    PLUGINS.push(one);
  }
  connected.add(one.id);
}
