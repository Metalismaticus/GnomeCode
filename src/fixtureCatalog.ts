// Каталог «Available» вне окна Tauri: карточки той же формы, что отдаёт живой
// индекс raw.githubusercontent (src-tauri/src/plugins/install.rs), и та же
// установка — файл плагина в папку движка, реестр, подключение к чату. На
// странице данные — память фикстуры, на диск не пишутся (docs/TESTING.md,
// «Данные пользователя»).
//
// Записи — те же, что ждёт сценарий каталога и cargo-тест установщика: «github»
// с двумя правами (Network, Write) и одной командой, «postgres» — сосед по
// каталогу, чтобы поиск показывал отбор, а не весь список подряд.

import type { Plugin } from "./bridge";
import type { CatalogEntry } from "./catalog";
import { adopt, builder, plugins as fixturePlugins, type Card } from "./fixturePlugins";

const GITHUB: CatalogEntry = {
  id: "github",
  name: "GitHub",
  description: "Repository, issues, pull requests",
  author: "Metalismaticus",
  version: "1.4.2",
  repo: "Metalismaticus/github-plugin",
  entry: "index.ts",
  permissions: [
    { category: "Network", value: "api.github.com" },
    { category: "Write", value: "ask" },
  ],
  commands: [{ name: "issues", description: "list issues" }],
};

const POSTGRES: CatalogEntry = {
  id: "postgres",
  name: "PostgreSQL",
  description: "Database tools",
  author: "Metalismaticus",
  version: "0.9.1",
  repo: "Metalismaticus/postgres-plugin",
  entry: "index.ts",
  permissions: [{ category: "Network", value: "localhost:5432" }],
  commands: [{ name: "query", description: "run a read-only query" }],
};

const ENTRIES: CatalogEntry[] = [GITHUB, POSTGRES];

/** Карточки каталога: копии — установка не переписывает сам индекс. */
export function entries(): CatalogEntry[] {
  return ENTRIES.map((one) => ({ ...one, permissions: [...one.permissions], commands: [...one.commands] }));
}

/** Установка по «Разрешить» сводки прав: карточка собирается в плагин с полями
 *  записи каталога (в окне их даёт реестр установленного — installed.json),
 *  принимается в установленные и подключается к текущему чату (adopt) — тем же
 *  путём, что в окне (plugin_install + plugin_connect). */
export function install(id: string): Plugin[] {
  const entry = ENTRIES.find((one) => one.id === id);
  if (!entry) {
    throw new Error(`в каталоге нет плагина «${id}»`);
  }
  const card: Card = {
    name: entry.name,
    author: entry.author,
    version: entry.version,
    description: entry.description,
    permissions: entry.permissions.map((one) => `${one.category}: ${one.value}`),
    uninstallable: true,
  };
  adopt(builder(entry.id, entry.commands, card));
  return fixturePlugins();
}
