// Типы каталога «Available»: та же форма, что отдаёт Rust-команда `catalog_list`
// (src-tauri/src/plugins/install.rs — ADR-0001: интерфейс знает свои типы, а не
// JSON движка). Запись каталога — карточка плагина и всё, что нужно установке.

/** Право из декларации: категория сцены H спеки плагинов и её значение. */
export type CatalogPermission = { category: string; value: string };

/** Команда плагина из декларации: до установки видна в карточке, после — кнопкой. */
export type CatalogCommand = { name: string; description: string };

/** Запись каталога: карточка и адрес установки (репозиторий + входной файл). */
export type CatalogEntry = {
  id: string;
  name: string;
  description: string;
  author: string;
  version: string;
  /** Репозиторий плагина `владелец/репозиторий` — файлы качаются raw-ссылками. */
  repo: string;
  /** Входной файл плагина в репозитории. */
  entry: string;
  permissions: CatalogPermission[];
  commands: CatalogCommand[];
};
