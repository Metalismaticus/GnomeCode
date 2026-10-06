//! Каталог «Available»: установка плагина с GitHub (docs/BATCH.md, пункт 1;
//! docs/SPEC/plugins.md, сцена F каталога — сцена C спеки).
//!
//! Источник каталога — JSON-индекс в репозитории владельца на raw.githubusercontent:
//! анонимный лимит api.github.com — 60 запросов в час, raw-файлы лимита не знают.
//! Плагин — OpenCode-формат: один TS-файл, который кладётся в глобальную папку
//! плагинов движка (движок читает плагины только при старте — после установки
//! лента перезапускает его тихо, `Chat::restart`). Декларации прав у формата нет —
//! их объявляет gnomecode.json каталога, а проверяет наш permission-слой
//! (docs/SPEC/plugins.md, решение владельца 2026-10-05).
//!
//! Реестр установленного — `installed.json` в папке данных: id → версия, репозиторий,
//! права и команды. Повторная установка обновляет запись, а не дублирует.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::state::DATA_DIR_VAR;

/// Единственный адрес каталога: индекс в репозитории владельца. Переедет в
/// настройки окна (пункт 12 партии) — вторая копия адреса в коде не нужна.
pub const CATALOG_URL: &str =
    "https://raw.githubusercontent.com/Metalismaticus/gnomecode-catalog/main/index.json";

/// База raw-репозитория: адрес без пути к файлу. Файл плагина собирается как
/// `{база}/{repo}/{ветка}/{entry}`, поэтому для обновлений индекса адрес
/// переезжает с полного адреса индекса на базу одного места.
pub fn raw_base(index_url: &str) -> String {
    index_url.split('/').take(3).collect::<Vec<&str>>().join("/")
}

/// Файл реестра установленного в папке данных.
const REGISTRY_NAME: &str = "installed.json";
const REQUEST_SECONDS: u64 = 30;

/// Право из декларации каталога: категория сцены H и её значение.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Permission {
    pub category: String,
    pub value: String,
}

/// Команда плагина из декларации: до установки видна в карточке, после — кнопкой.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CommandSpec {
    pub name: String,
    pub description: String,
    /// Категория прав команды (`Read`, `Write`, `Network`, `Terminal`) — по ней
    /// слой прав ищет правило; без категории вызов всегда спрашивает (deny к
    /// нему неприменим). Декларации её не знали — читается как None (serde default).
    #[serde(default)]
    pub category: Option<String>,
}

/// Запись каталога: карточка плагина и всё, что нужно для установки.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub description: String,
    pub author: String,
    pub version: String,
    /// Репозиторий плагина `владелец/репозиторий`: файлы качаются raw-ссылками.
    pub repo: String,
    /// Входной файл плагина в репозитории (v1 — однофайловый плагин).
    pub entry: String,
    #[serde(default)]
    pub permissions: Vec<Permission>,
    #[serde(default)]
    pub commands: Vec<CommandSpec>,
    /// Выключен ли плагин владельцем: поле записи, а не отдельный объект — старые
    /// реестры без поля читаются (serde default), повторная установка включает заново.
    #[serde(default)]
    pub disabled: bool,
}

/// Что реестр помнит об установленном плагине: вся запись каталога целиком.
/// Отдельный тип не нужен — форма совпадает с [`CatalogEntry`] один в один.
type Installed = CatalogEntry;

/// Реестр установленного с файла целиком: `id → запись`; испорченный или
/// потерянный — пустой, как у [`installed`].
pub fn records(registry: &Path) -> BTreeMap<String, Installed> {
    fs::read(registry)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write(registry: &Path, records: &BTreeMap<String, Installed>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(records)
        .map_err(|e| format!("реестр установленного не собрался в JSON: {e}"))?;
    if let Some(parent) = registry.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(registry, json)
        .map_err(|e| format!("реестр установленного не записан {}: {e}", registry.display()))
}

/// Индекс каталога по адресу: список записей, ошибки — словами для окна каталога.
pub fn fetch(source: &str) -> Result<Vec<CatalogEntry>, String> {
    let text = get(source)?;
    serde_json::from_str(&text).map_err(|e| format!("индекс каталога не читается: {e}"))
}

/// Установить плагин по id: индекс, запись реестра, файл — в папку плагинов движка.
pub fn install_by_id(id: &str, registry: &Path) -> Result<CatalogEntry, String> {
    let found = fetch(CATALOG_URL)?;
    let entry = found
        .into_iter()
        .find(|one| one.id == id)
        .ok_or_else(|| format!("в каталоге нет плагина «{id}»"))?;
    install(&entry, CATALOG_URL, &plugins_dir(), registry)?;
    Ok(entry)
}

/// Скачать входной файл плагина и записать реестр. Папки создаёт на первом месте.
pub fn install(entry: &CatalogEntry, source: &str, plugins_dir: &Path, registry: &Path) -> Result<(), String> {
    let url = format!("{}/{}/main/{}", source, entry.repo, entry.entry);
    let code = get(&url)?;
    fs::create_dir_all(plugins_dir)
        .map_err(|e| format!("папка плагинов не создалась {}: {e}", plugins_dir.display()))?;
    let file = plugins_dir.join(format!("{}.ts", entry.id));
    fs::write(&file, code).map_err(|e| format!("файл плагина не записан {}: {e}", file.display()))?;
    record(registry, entry)
}

/// Папка глобальных плагинов движка: XDG_CONFIG_HOME уважается (изоляция проверок),
/// иначе `~/.config/opencode/plugins` — движок на Windows читает именно её.
pub fn plugins_dir() -> PathBuf {
    let config = std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|home| PathBuf::from(home).join(".config"))
                .unwrap_or_default()
        });
    config.join("opencode").join("plugins")
}

/// Файл данных по имени: папку данных даёт переменная (проверки и копии), иначе —
/// папка данных приложения. Реестр установленного и правила — оба на ней.
pub fn data_file(fallback: PathBuf, name: &str) -> PathBuf {
    std::env::var_os(DATA_DIR_VAR)
        .map(PathBuf::from)
        .unwrap_or(fallback)
        .join(name)
}

/// Файл реестра установленного в папке данных.
pub fn registry_file(fallback: PathBuf) -> PathBuf {
    data_file(fallback, REGISTRY_NAME)
}

/// Что реестр помнит: записи каталога. Испорченный или потерянный файл — пустой
/// список, как у `Store::at`.
pub fn installed(registry: &Path) -> Vec<CatalogEntry> {
    fs::read(registry)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<BTreeMap<String, Installed>>(&bytes).ok())
        .unwrap_or_default()
        .into_values()
        .collect()
}

fn get(url: &str) -> Result<String, String> {
    ureq::get(url)
        .timeout(Duration::from_secs(REQUEST_SECONDS))
        .call()
        .map_err(|e| format!("репозиторий не отвечает ({url}): {e}"))?
        .into_string()
        .map_err(|e| format!("ответ репозитория не прочитан: {e}"))
}

/// Запись в реестре: чтение, подмена своей, запись — повторная установка обновляет.
fn record(registry: &Path, entry: &CatalogEntry) -> Result<(), String> {
    let mut known = records(registry);
    known.insert(entry.id.clone(), entry.clone());
    write(registry, &known)
}

/// Вернуть версию плагина в реестре на прежнюю — откат сломавшегося обновления
/// (updates.rs): запись остаётся, версия уходит на ту, что была до замены файла.
pub fn revert(registry: &Path, id: &str, version: &str) -> Result<(), String> {
    let mut known = records(registry);
    let Some(entry) = known.get_mut(id) else {
        return Err(format!("в реестре установленного нет записи о плагине «{id}»"));
    };
    entry.version = version.to_string();
    write(registry, &known)
}
