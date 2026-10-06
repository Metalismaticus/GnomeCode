// Tool Sets вне окна Tauri: та же форма, что отдаёт мост (src-tauri/src/plugins/
// toolsets.rs), — сохранённые группы плагинов в localStorage по образцу
// fixturePlugins (SCOPE_KEY): страница проверки не пишет на диск, а сет обязан
// пережить перезагрузку (прокси перезапуска окна и «нового чата»).
//
// Подключение сета раскладывается на одиночные подключения (toolset_connect в
// commands.rs): каждый установленный плагин со скоупом, недоступные пропускаются.

import type { Plugin, PluginScope, ToolSet } from "./bridge";
import { connectedIds, connect as connectFixture, plugins as fixturePlugins } from "./fixturePlugins";

const SETS_KEY = "gnomecode-tool-sets";

type Sets = Record<string, string[]>;

/** Задержка перед записью реестра: окно сета живёт по HTTP к движку, и в
 *  фикстуре подключение обязано быть заметно асинхронным — иначе страница
 *  проверки прячет гонку параллельного plugin_list (наследие круга 1). */
const CONNECT_TURNS_MS = 150;

function readSets(): Sets {
  try {
    const raw = localStorage.getItem(SETS_KEY);
    if (raw) {
      const held: unknown = JSON.parse(raw);
      if (held && typeof held === "object") {
        const sets: Sets = {};
        for (const [name, ids] of Object.entries(held as Record<string, unknown>)) {
          if (Array.isArray(ids)) {
            const clean = ids.filter((one): one is string => typeof one === "string");
            if (clean.length) {
              sets[name] = clean;
            }
          }
        }
        return sets;
      }
    }
  } catch {
    // Хранилище страницы не всегда доступно — страница работает и без него.
  }
  return {};
}

function writeSets(sets: Sets): void {
  try {
    localStorage.setItem(SETS_KEY, JSON.stringify(sets));
  } catch {
    // Молча: страница проверки не обязана иметь хранилище.
  }
}

/** Сеты списком имя → id, по имени — как pairs у BTreeMap (plugin_toolsets). */
export function list(): ToolSet[] {
  return Object.entries(readSets()).map(([name, ids]) => ({ name, ids }));
}

/** Сохранить Tool Set из подключённого сейчас к чату: как plugin_toolset_save —
 *  подключённого нет или имя пустое — ошибка, иначе имя в файл. */
export async function save(name: string): Promise<ToolSet[]> {
  const ids = connectedIds();
  if (ids.length === 0) {
    throw new Error("Нечего сохранять: подключите плагин к чату и повторите");
  }
  const clean = name.trim();
  if (!clean) {
    throw new Error("Имя сета пустое: введите название");
  }
  const sets = readSets();
  sets[clean] = ids;
  writeSets(sets);
  return list();
}

/** Подключить Tool Set одним пунктом меню: каждый установленный плагин сета
 *  со скоупом (как connectFixture — «Chat» пишется только в реестр страницы,
 *  «Project» — в localStorage). Недоступные id сета пропускаются. */
export async function connect(name: string, scope?: PluginScope): Promise<Plugin[]> {
  const ids = readSets()[name.trim()] ?? [];
  const known = fixturePlugins().map((one) => one.id);
  // Ходы к движку не мгновенны: в окне plugin_toolset_connect собирает known и
  // подключает по HTTP — параллельный plugin_list вернул бы прежний реестр и
  // кнопки сета не появились бы. Список приходит с ответом самого подключения.
  await new Promise((resolve) => setTimeout(resolve, CONNECT_TURNS_MS));
  let list: Plugin[] = new Array<Plugin>();
  for (const id of ids) {
    if (!known.includes(id)) {
      continue;
    }
    list = connectFixture(fixturePlugins(), id, scope);
  }
  return list;
}

/** Удалить Tool Set: ярлык группы — подключённые плагины и скоупы не трогаются. */
export async function remove(name: string): Promise<ToolSet[]> {
  const sets = readSets();
  delete sets[name.trim()];
  writeSets(sets);
  return list();
}
