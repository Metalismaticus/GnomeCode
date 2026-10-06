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

import type { Plugin, PluginScope } from "./bridge";
import { params } from "./viewparams";
import { rulesMap, usageOf } from "./fixtureApprovals";

/** Подключённые к чату плагины: то же, что держит реестр чата в окне Tauri. */
const connected = new Set<string>();
/** Отключённые плагины: то же, что поле `disabled` записи реестра в окне. */
const disabled = new Set<string>();
/** Подключённые «Once»: следующий вопрос снимает их с чата. */
const once = new Set<string>();
/** Снятые с чата в этой странице: скоуп не возвращает их кнопки до перезагрузки. */
const optOut = new Set<string>();

/** Повышающие скоупы (сцена E): перезагрузка страницы — прокси «нового чата» и
 *  перезапуска окна, поэтому «проект» и «глобально» обязаны пережить её — их
 *  помнит localStorage по образцу fixtureState (свежий chromium память теряет,
 *  reload в том же контексте — нет). */
const SCOPE_KEY = "gnomecode-plugin-scopes";

type PersistedScopes = { project: string[]; global: string[] };

function readPersisted(): PersistedScopes {
  try {
    const raw = localStorage.getItem(SCOPE_KEY);
    if (raw) {
      const held: unknown = JSON.parse(raw);
      if (held && typeof held === "object") {
        const own = held as Record<string, unknown>;
        const list = (value: unknown) =>
          Array.isArray(value) ? value.filter((one): one is string => typeof one === "string") : [];
        return { project: list(own.project), global: list(own.global) };
      }
    }
  } catch {
    // Хранилище страницы не всегда доступно — страница работает и без него.
  }
  return { project: [], global: [] };
}

function writePersisted(scopes: PersistedScopes): void {
  try {
    localStorage.setItem(SCOPE_KEY, JSON.stringify(scopes));
  } catch {
    // Молча: страница проверки не обязана иметь хранилище.
  }
}

/** Скоупы страницы: перезагрузка читает их заново — прокси перезапуска окна. */
let scopes: PersistedScopes = readPersisted();

/** Кнопки плагина в этом окне: реестр чата плюс скоупы, минус снятые с чата —
 *  как scopes::connected_for (src-tauri/src/plugins/scopes.rs). */
function isConnected(id: string): boolean {
  return (
    (connected.has(id) || scopes.project.includes(id) || scopes.global.includes(id)) &&
    !optOut.has(id)
  );
}

/** Скоуп подключения строки: once, затем чат, затем скоупы файла — как scope_of. */
function scopeOf(id: string): PluginScope | undefined {
  if (once.has(id)) {
    return "once";
  }
  if (connected.has(id)) {
    return "chat";
  }
  if (scopes.project.includes(id)) {
    return "project";
  }
  if (scopes.global.includes(id)) {
    return "global";
  }
  return undefined;
}

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
 *  «Плагины» — сами карточки; в состоянии «проект» — тоже: в окне у владельца
 *  проект и установленные плагины живут вместе (источники ответа называются
 *  рядом с деревом). */
export function plugins(): Plugin[] {
  if (
    params.feed !== "plugins" &&
    params.feed !== "approval" &&
    params.feed !== "catalog" &&
    params.feed !== "plugins-section" &&
    params.feed !== "plugins-updates" &&
    params.feed !== "project"
  ) {
    return [];
  }
  const updates = params.feed === "plugins-updates";
  return PLUGINS.map((one) => {
    const rules = rulesMap(one.id);
    const update = updates ? UPDATE_FIXTURE[one.id] : undefined;
    const scope = scopeOf(one.id);
    const usage = usageOf(one.id);
    return {
      ...one,
      connected: isConnected(one.id),
      disabled: disabled.has(one.id),
      ...(scope ? { scope } : {}),
      ...(Object.keys(rules).length ? { rules } : {}),
      // Обновление молча сдаёт реестр на новую версию — карточка ждёт прав стоит
      // на прежней (файл не тронут до сводки).
      ...(update ? { update, version: update.status === "applied" ? update.to : one.version } : {}),
      ...(usage ? { usage } : {}),
    };
  });
}

/** Id подключённых к чату в реестре страницы: «Save as Tool Set» берёт их из
 *  подключённого сейчас, без скоупов файла — как registry.connected (plugin_toolset_save). */
export function connectedIds(): string[] {
  return [...connected];
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

/** Подключение к чату со скоупом (сцена E): без скоупа — «этот чат», уже
 *  подключённая строка не трогается (у неё полоса скоупов). «Проект» и
 *  «глобально» пишутся в localStorage — вернут кнопки после перезагрузки;
 *  «Этот чат» и «Once» повышенный скоуп снимают, как scopes::set. */
export function connect(list: Plugin[], id: string, scope?: PluginScope): Plugin[] {
  const kind = scope ?? "chat";
  if (!scope && isConnected(id)) {
    return list;
  }
  connected.add(id);
  optOut.delete(id);
  if (kind === "once") {
    once.add(id);
  } else {
    once.delete(id);
  }
  if (kind === "project" || kind === "global") {
    if (!scopes[kind].includes(id)) {
      scopes[kind].push(id);
    }
  } else if (scope !== undefined) {
    // Откат повышенного скоупа выбором «Этот чат»/«Once» в полосе.
    scopes.project = scopes.project.filter((one) => one !== id);
    scopes.global = scopes.global.filter((one) => one !== id);
  }
  writePersisted(scopes);
  // Свежий список, а не сняток до мутации: у переданного поля `scope` старые —
  // полоса скоупов строки показала бы предвыбранным прежний скоуп.
  return plugins();
}

/** Снять плагин с чата без деинсталляции: кнопки уходят из этого окна, скоупы
 *  файла остаются — снятие держится до перезагрузки, как opt-out реестра. */
export function detach(id: string): Plugin[] {
  connected.delete(id);
  once.delete(id);
  optOut.add(id);
  return plugins();
}

/** После вопроса: подключённые «Once» уходят с чата — как registry.take_once. */
export function takeOnce(): void {
  for (const id of once) {
    connected.delete(id);
  }
  once.clear();
}

/** Disable силы: плагин остаётся установленным, кнопки команд из чатов уходят.
 *  Запись — по форме поля `disabled` реестра (src-tauri/src/plugins/manage.rs). */
export function disable(id: string): Plugin[] {
  disabled.add(id);
  return plugins();
}

/** Enable: карточка возвращается во вкладку Installed и кнопки в шапки чатов. */
export function enable(id: string): Plugin[] {
  disabled.delete(id);
  return plugins();
}

/** Uninstall: запись реестра и файл плагина уходят — карточка исчезает из раздела. */
export function uninstall(id: string): Plugin[] {
  const gone = PLUGINS.findIndex((one) => one.id === id);
  if (gone === -1) {
    throw new Error(`в реестре нет записи о плагине «${id}»`);
  }
  PLUGINS.splice(gone, 1);
  connected.delete(id);
  disabled.delete(id);
  once.delete(id);
  optOut.delete(id);
  scopes.project = scopes.project.filter((one) => one !== id);
  scopes.global = scopes.global.filter((one) => one !== id);
  writePersisted(scopes);
  writeInstalled(readInstalled().filter((record) => record.id !== id));
  return plugins();
}

/** Установленные из каталога плагины (прокси installed.json): страница проверки
 *  не пишет на диск, а «Keep enabled for this project» обязан вернуть кнопки
 *  после перезагрузки — значит, сам установленный плагин тоже должен пережить её
 *  (в окне его помнит реестр установленного). Помнит localStorage рядом со скоупами. */
const INSTALLED_KEY = "gnomecode-plugin-installed";

type PersistedPlugin = {
  id: string;
  commands: { name: string; description: string; category?: string }[];
  card: Card;
};

function readInstalled(): PersistedPlugin[] {
  try {
    const raw = localStorage.getItem(INSTALLED_KEY);
    if (raw) {
      const held: unknown = JSON.parse(raw);
      return Array.isArray(held) ? (held as PersistedPlugin[]) : [];
    }
  } catch {
    // Хранилище страницы не всегда доступно — страница работает и без него.
  }
  return [];
}

function writeInstalled(records: PersistedPlugin[]): void {
  try {
    localStorage.setItem(INSTALLED_KEY, JSON.stringify(records));
  } catch {
    // Молча: страница проверки не обязана иметь хранилище.
  }
}

for (const record of readInstalled()) {
  PLUGINS.push(plugin(record.id, record.commands, record.card ?? {}));
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
 *  установленных и сразу подключается к чату — «Allow» сводки прав делает оба шага;
 *  скоуп из сводки («Keep enabled for this project»/«Enable by default») пишется
 *  в localStorage — кнопки вернутся в новых чатах. Новый для страницы плагин
 *  запоминается рядом — после перезагрузки он по-прежнему установлен. */
export function adopt(one: Plugin, scope?: PluginScope): void {
  if (!PLUGINS.some((known) => known.id === one.id)) {
    PLUGINS.push(one);
    const records = readInstalled().filter((record) => record.id !== one.id);
    records.push({
      id: one.id,
      commands: one.commands.map((command) => ({
        name: command.label,
        description: command.description,
        ...(command.category ? { category: command.category } : {}),
      })),
      card: {
        ...(one.name ? { name: one.name } : {}),
        ...(one.author ? { author: one.author } : {}),
        ...(one.version ? { version: one.version } : {}),
        ...(one.description ? { description: one.description } : {}),
        ...(one.permissions ? { permissions: one.permissions } : {}),
        ...(one.uninstallable ? { uninstallable: one.uninstallable } : {}),
      },
    });
    writeInstalled(records);
  }
  connected.add(one.id);
  optOut.delete(one.id);
  if (scope === "project" || scope === "global") {
    if (!scopes[scope].includes(one.id)) {
      scopes[scope].push(one.id);
    }
    writePersisted(scopes);
  }
}
