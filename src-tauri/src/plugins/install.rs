//! Каталог «Available»: установка плагина с GitHub.
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
    /// Откуда запись: каталог или импорт opencode.json (F11). Импортированные
    /// движок грузит сам — файла и репозитория у нас нет, автообновление их
    /// не трогает (1.1). Старые реестры без поля — записи каталога.
    #[serde(default)]
    pub source: Source,
}

/// Источник записи реестра (F11): каталог — наши установка и обновление;
/// импорт — пакет из opencode.json владельца, жизненным циклом ведёт движок;
/// внешний файл — плагин, добавленный перетаскиванием .ts в окно (B6): файл
/// наш, а обновлений у записи нет — репозитория в декларации нет.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    #[default]
    Registry,
    Imported,
    External,
}

impl Source {
    /// Вне каталога: автообновление и обновления индекса запись не трогают.
    pub fn outside_catalog(self) -> bool {
        matches!(self, Source::Imported | Source::External)
    }
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

/// Записать реестр установленного: установщик и импорт ходят в один файл.
pub fn save_records(registry: &Path, records: &BTreeMap<String, Installed>) -> Result<(), String> {
    write(registry, records)
}

fn write(registry: &Path, records: &BTreeMap<String, Installed>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(records)
        .map_err(|e| format!("реестр установленного не собрался в JSON: {e}"))?;
    atomically(registry, &json)
}

/// Атомарная запись данных владельца (F6, ET6): JSON собирается целиком, кладётся
/// во временный файл рядом и переименовывается — прерванная запись не оставляет
/// половину файла, читатель видит либо прежнюю версию, либо новую. Прежнее
/// содержимое остаётся `.bak`: чтение-модификация-запись переживает сбой между
/// ними — испорченный основной файл восстанавливается из `.bak` руками владельца.
/// Для installed.json и updates.json; providers.json и rules.json — отдельные
/// условия, их не трогает.
pub fn atomically(target: &Path, json: &str) -> Result<(), String> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    let mut tmp = target.as_os_str().to_owned();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, json)
        .map_err(|e| format!("временный файл не записан {}: {e}", tmp.display()))?;
    if target.exists() {
        let mut bak = target.as_os_str().to_owned();
        bak.push(".bak");
        let bak = PathBuf::from(bak);
        fs::copy(target, &bak)
            .map_err(|e| format!("запасная копия не снята {}: {e}", bak.display()))?;
    }
    fs::rename(&tmp, target)
        .map_err(|e| format!("запись не встала на место {tmp:?} → {target:?}: {e}"))
}

/// Индекс каталога по адресу: список записей, ошибки — словами для окна каталога.
pub fn fetch(source: &str) -> Result<Vec<CatalogEntry>, String> {
    let text = get(source)?;
    parse_index(&text)
}

/// Сырой текст индекса: снимку каталога (DT7) нужен он — кэш хранит текст как есть.
pub fn get_index(source: &str) -> Result<String, String> {
    get(source)
}

/// Разбор сырого текста индекса — тот же разбор, что у fetch.
pub fn parse_index(text: &str) -> Result<Vec<CatalogEntry>, String> {
    serde_json::from_str(text).map_err(|e| format!("индекс каталога не читается: {e}"))
}

/// Файл кэша индекса в папке данных (DT7): «данные от <дата>» при оффлайне.
pub fn index_cache_file(fallback: PathBuf) -> PathBuf {
    data_file(fallback, "catalog-cache.json")
}

/// Кэш индекса: сырой текст с диска и дата файла (unix-мс) — откуда окно берёт
/// «данные от <дата>». Нет файла — None.
pub fn cached_index(cache: &Path) -> Option<(String, u64)> {
    let text = fs::read_to_string(cache).ok()?;
    let date = fs::metadata(cache).ok()?.modified().ok()?;
    let ms = date
        .duration_since(std::time::UNIX_EPOCH)
        .ok()?
        .as_millis() as u64;
    Some((text, ms))
}

/// Записать кэш индекса: сырой текст как есть, папку создаёт.
pub fn save_index_cache(cache: &Path, text: &str) -> Result<(), String> {
    if let Some(parent) = cache.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(cache, text).map_err(|e| format!("кэш индекса не записан {}: {e}", cache.display()))
}

/// Установить плагин по id: индекс, запись реестра, файл — в папку плагинов движка.
pub fn install_by_id(id: &str, registry: &Path, cache: &Path) -> Result<CatalogEntry, String> {
    let found = fetch(CATALOG_URL)?;
    let entry = found
        .into_iter()
        .find(|one| one.id == id)
        .ok_or_else(|| format!("в каталоге нет плагина «{id}»"))?;
    install(&entry, CATALOG_URL, &plugins_dir(), registry, cache)?;
    Ok(entry)
}

/// Имя записи для внешнего файла (B6): транслитерация + латиница-цифры-дефисы
/// (F10), как slug скилла — одно знание о правилах имени; пустое — отказ.
/// Имя файла владельца может быть любым — «Мой Плагин.ts» становится «moy-plugin».
fn external_id(file_name: &str) -> Option<String> {
    let stem = file_name.strip_suffix(".ts").unwrap_or(file_name);
    crate::skills::slug(stem)
}

/// Установить внешний плагин из файла (B6, перетаскивание .ts): содержимое —
/// в папку плагинов движка, запись — в реестр выключенной (включение — через
/// сводку прав сцены H, «права неизвестны», как у импорта). Источник External —
/// автообновление запись не трогает (репозитория нет). Повторный бросок того же
/// имени перезаписывает файл, а не дублирует запись. Ответ — id записи.
pub fn install_from_file(
    file_name: &str,
    code: &str,
    plugins_dir: &Path,
    registry: &Path,
) -> Result<String, String> {
    let id = external_id(file_name)
        .ok_or_else(|| "имя файла — латиница, цифры и дефис (до 64 знаков)".to_string())?;
    fs::create_dir_all(plugins_dir)
        .map_err(|e| format!("папка плагинов не создалась {}: {e}", plugins_dir.display()))?;
    fs::write(plugins_dir.join(format!("{id}.ts")), code)
        .map_err(|e| format!("файл плагина не записан: {e}"))?;
    let entry = CatalogEntry {
        id: id.clone(),
        name: file_name.trim_end_matches(".ts").to_string(),
        description: "внешний плагин — добавлен файлом".to_string(),
        author: String::new(),
        version: String::new(),
        repo: String::new(),
        entry: file_name.to_string(),
        permissions: vec![],
        commands: vec![],
        disabled: true,
        source: Source::External,
    };
    let mut known = records(registry);
    known.insert(id.clone(), entry);
    save_records(registry, &known)?;
    Ok(id)
}

/// Скачать входной файл плагина и записать реестр. Папки создаёт на первом месте.
/// Кэш версий (F5): скачанный артефакт с декларацией запоминается для отката —
/// сбой кэша установку не ломает, откат лишь скажет «версии нет в кэше».
pub fn install(entry: &CatalogEntry, source: &str, plugins_dir: &Path, registry: &Path, cache: &Path) -> Result<(), String> {
    let url = format!("{}/{}/main/{}", source, entry.repo, entry.entry);
    let code = get(&url)?;
    fs::create_dir_all(plugins_dir)
        .map_err(|e| format!("папка плагинов не создалась {}: {e}", plugins_dir.display()))?;
    let file = plugins_dir.join(format!("{}.ts", entry.id));
    fs::write(&file, &code).map_err(|e| format!("файл плагина не записан {}: {e}", file.display()))?;
    let _ = super::vcache::remember(cache, entry, &code);
    record(registry, entry)
}

/// Вернуть запись реестра целиком на прежнюю (откат, 1.3): версия, права и
/// команды той версии — декларацию артефакта несёт кэш (vcache::Cached).
pub fn restore(registry: &Path, entry: &CatalogEntry) -> Result<(), String> {
    let mut known = records(registry);
    known.insert(entry.id.clone(), entry.clone());
    write(registry, &known)
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

#[cfg(test)]
mod tests {
    use super::{external_id, install_from_file, records, Source};

    struct TempDir(std::path::PathBuf);

    impl TempDir {
        fn fresh(name: &str) -> TempDir {
            let base = std::env::temp_dir().join(format!(
                "gnomecode-install-{}-{name}",
                std::process::id()
            ));
            let _ = std::fs::remove_dir_all(&base);
            std::fs::create_dir_all(&base).expect("временная папка создана");
            TempDir(base)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Имя записи из имени файла: транслитерация и дефисы; пустое и длинное — None.
    #[test]
    fn external_id_is_safe() {
        assert_eq!(external_id("Мой Плагин.ts").as_deref(), Some("moi-plagin"));
        assert_eq!(external_id("my_plug-2.ts").as_deref(), Some("my-plug-2"));
        assert_eq!(external_id(".ts").as_deref(), None);
        assert_eq!(external_id("   .ts").as_deref(), None);
        let long = "a".repeat(65);
        assert_eq!(external_id(&long).as_deref(), None);
    }

    /// Установка из файла: файл в папке плагинов, запись выключенная с источником
    /// external; повторный бросок перезаписывает, а не дублирует.
    #[test]
    fn install_from_file_records_disabled_external() {
        let dir = TempDir::fresh("file");
        let plugins = dir.0.join("plugins");
        let registry = dir.0.join("installed.json");

        let id = install_from_file("Own Tool.ts", "export const x = 1;", &plugins, &registry)
            .expect("файл установлен");
        assert_eq!(id, "own-tool");
        assert!(plugins.join("own-tool.ts").is_file(), "файл плагина на месте");

        let known = records(&registry);
        let entry = known.get("own-tool").expect("запись в реестре");
        assert!(entry.disabled, "запись выключенная — включение через сцену H");
        assert_eq!(entry.source, Source::External);
        assert!(entry.source.outside_catalog(), "автообновление запись не трогает");

        install_from_file("own tool.ts", "export const y = 2;", &plugins, &registry)
            .expect("повторная установка");
        let known = records(&registry);
        assert_eq!(known.len(), 1, "запись одна — перезаписана, не продублирована");
        assert!(
            std::fs::read_to_string(plugins.join("own-tool.ts"))
                .expect("файл прочитан")
                .contains("y = 2"),
            "файл перезаписан новым содержимым"
        );
    }

    /// Кривое имя файла — честный отказ, ничего не пишется.
    #[test]
    fn install_from_file_rejects_bad_name() {
        let dir = TempDir::fresh("bad");
        let registry = dir.0.join("installed.json");
        let result = install_from_file("   .ts", "x", &dir.0.join("p"), &registry);
        assert!(result.is_err(), "пустое имя отвергнуто");
        assert!(
            records(&registry).is_empty(),
            "отказ ничего не записал в реестр"
        );
    }
}
