//! Кэш артефактов версий (CE-3, F5): что скачано при установке и обновлении,
//! то и лежит в папке данных — откат в клик берёт файл версии отсюда, сверяя
//! sha256, зафиксированный при получении. Формат записи: декларация версии
//! целиком (1.3 — откат восстанавливает и права, не только номер) + артефакт
//! + хэш. Ключ — `id@версия`; лимит «последние K версий на плагин» — капы
//! ET10, здесь кэш только копится.
//!
//! Файл — `vcache.json` в папке данных (%APPDATA%/GnomeCode), не в каталогах
//! движка (F5). Испорченный или потерянный — пустой: откат скажет «версии нет
//! в кэше», установка и обновление работают как раньше.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use super::install::{self, CatalogEntry};

const VCACHE_NAME: &str = "vcache.json";

/// Файл кэша в папке данных: путь собирает `install::data_file`, имя — одно здесь.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, VCACHE_NAME)
}

/// Кэшированная версия: декларация той поры (права, команды, автор), артефакт
/// и хэш содержимого, зафиксированный при получении из каталога. `saved_at` —
/// момент записи (unix-мс): эвикция ET10 выкидывает самые старые версии
/// плагина сверх лимита.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Cached {
    pub entry: CatalogEntry,
    pub content: String,
    pub sha256: String,
    #[serde(default)]
    pub saved_at: u64,
}

/// Сколько версий одного плагина держим в кэше (ET10): откат нужен на шаг
/// назад, а не на всю историю. Новая запись вытесняет самые старые.
const KEEP_PER_PLUGIN: usize = 3;

/// Ключ записи: у одного плагина кэш держит несколько версий.
fn key(id: &str, version: &str) -> String {
    format!("{id}@{version}")
}

/// Кэш целиком: `id@версия → запись`; BTreeMap — стабильный порядок в файле.
type Cache = BTreeMap<String, Cached>;

/// Кэш с диска: нет файла или форма чужая — пустой (см. шапку модуля).
pub fn at(file_path: &Path) -> Cache {
    fs::read(file_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Cache>(&bytes).ok())
        .unwrap_or_default()
}

/// Записать кэш; папку данных создаёт на первом сохранении (узор реестра).
pub fn save(file_path: &Path, cache: &Cache) -> Result<(), String> {
    let json = serde_json::to_string_pretty(cache)
        .map_err(|e| format!("кэш версий не собрался в JSON: {e}"))?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file_path, json)
        .map_err(|e| format!("vcache.json не записан {}: {e}", file_path.display()))
}

/// Запомнить версию при установке или обновлении: декларация + артефакт +
/// хэш содержимого. Повторная установка той же версии перезаписывает запись.
/// Эвикция (ET10): у плагина остаются последние K версий, самые старые уходят.
pub fn remember(file_path: &Path, entry: &CatalogEntry, content: &str) -> Result<(), String> {
    let mut cache = at(file_path);
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default();
    let id = entry.id.clone();
    cache.insert(
        key(&id, &entry.version),
        Cached {
            entry: entry.clone(),
            content: content.to_string(),
            sha256: sha256_hex(content.as_bytes()),
            saved_at: now,
        },
    );
    // Эвикция: версии одного плагина, кроме последних K по времени записи.
    let mut versions: Vec<(&String, &Cached)> = cache
        .iter()
        .filter(|(key, _)| key.split('@').next() == Some(id.as_str()))
        .collect();
    versions.sort_by_key(|(_, cached)| cached.saved_at);
    let evict: Vec<String> = versions
        .iter()
        .take(versions.len().saturating_sub(KEEP_PER_PLUGIN))
        .map(|(key, _)| (*key).clone())
        .collect();
    for key in evict {
        cache.remove(&key);
    }
    save(file_path, &cache)
}

/// Кэшированная версия, если она там есть.
pub fn get(file_path: &Path, id: &str, version: &str) -> Option<Cached> {
    at(file_path).remove(&key(id, version))
}

/// Есть ли версия в кэше: активность кнопки отката ровно она (п.3 юнита).
pub fn has(file_path: &Path, id: &str, version: &str) -> bool {
    at(file_path).contains_key(&key(id, version))
}

/// Sha256 строки hex-ом: и при получении пишем, и при откате сверяем.
pub fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    out
}
