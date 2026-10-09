//! Свои провайдеры-endpoint'ы и включённость (docs/BATCH.md, пункт 1 партии).
//!
//! Файл — `providers.json` в папке данных, соседний с [`crate::providers`]
//! (ключи в хранилище ОС): сам providers.rs не переписывается, здесь живёт всё
//! про endpoint'ы и включённость. Секрета в файле нет: ключ endpoint'а лежит в
//! Credential Manager под именем `endpoint:<id>` ([`key_id`]), а движку уходит
//! переменной окружения через [`engine_config`] — конфиг собирается только из
//! включённых endpoint'ов, формат state.json не расширяется.
//!
//! Механизм замерен на живом ядре v2.0.25 (2026-10-09): движок читает конфиг из
//! переменной `OPENCODE_CONFIG_CONTENT`, ключ конфига — `providers` (мн.ч.),
//! endpoint объявляется пакетом [`PACKAGE`] и появляется в `GET /api/provider`
//! (~1,2 с после старта), его модели — в `GET /api/model`.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::plugins::install;

/// Имя файла хранилища в папке данных.
const FILE_NAME: &str = "providers.json";

/// Пакет движка для OpenAI-совместимого endpoint: встроенный в ядро, установки
/// не требует (packages/core/src/provider.ts, map builtins).
pub const PACKAGE: &str = "@opencode/ai/providers/openai-compatible";

/// Свой endpoint: имя владельца, база URL и модели, что отдал его `/models`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Endpoint {
    pub id: String,
    pub name: String,
    pub base_url: String,
    #[serde(default)]
    pub models: Vec<String>,
}

/// Хранилище провайдеров: endpoint'ы и выключенные (включённость — здесь, не в
/// state.json). Потерянный или испорченный файл — всё включено, endpoint'ов нет.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Providers {
    #[serde(default)]
    pub endpoints: Vec<Endpoint>,
    #[serde(default)]
    pub disabled: Vec<String>,
}

/// Файл хранилища в папке данных: узор правил плагинов (rules.json).
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, FILE_NAME)
}

/// Хранилище с диска: нет файла — пустое.
pub fn at(file: &Path) -> Providers {
    fs::read(file)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

/// Записать хранилище; папка данных создаётся на первом сохранении.
pub fn save(file: &Path, held: &Providers) -> Result<(), String> {
    let json = serde_json::to_string_pretty(held)
        .map_err(|e| format!("провайдеры не собрались в JSON: {e}"))?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file, json).map_err(|e| format!("providers.json не записан {}: {e}", file.display()))
}

/// Имя записи ключа endpoint'а в хранилище ОС: префикс отличает его от
/// встроенных провайдеров движка — у тех имя записи совпадает с их id.
pub fn key_id(id: &str) -> String {
    format!("endpoint:{id}")
}

/// Годится ли идентификатор endpoint'а: пара провайдер/модель у движка режется
/// по первому «/», поэтому в идентификаторе — только латиница, цифры и дефис.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !id.starts_with('-')
        && !id.ends_with('-')
        && id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// Идентификатор из базы URL: хост нижним регистром, всё кроме латиницы и цифр —
/// в дефис; занятый растёт вторым номером. Имя владельца идёт в конфиг как имя.
fn id_from(base_url: &str, held: &Providers) -> String {
    let host = base_url.split("://").nth(1).unwrap_or_default();
    let host = host.split(['/', ':']).next().unwrap_or_default();
    let mut slug = String::new();
    let mut dash = false;
    for letter in host.to_lowercase().chars() {
        if letter.is_ascii_lowercase() || letter.is_ascii_digit() {
            slug.push(letter);
            dash = false;
        } else if !dash && !slug.is_empty() {
            slug.push('-');
            dash = true;
        }
    }
    while slug.ends_with('-') {
        slug.pop();
    }
    let slug = if valid_id(&slug) { slug } else { "endpoint".to_string() };
    let mut candidate = slug.clone();
    let mut number = 1;
    while held.endpoints.iter().any(|one| one.id == candidate) {
        number += 1;
        candidate = format!("{slug}-{number}");
    }
    candidate
}

/// Добавить endpoint: имя и база URL обязательны, адрес — http(s). Модели
/// уже спрошены с endpoint'а командой окна ([`crate::plugins::commands`]).
pub fn add_endpoint(file: &Path, name: &str, base_url: &str, models: Vec<String>) -> Result<Endpoint, String> {
    let name = name.trim();
    let base_url = base_url.trim();
    if name.is_empty() {
        return Err("имя endpoint'а пустое: введите название".to_string());
    }
    if base_url.len() <= 8 || !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
        return Err("база URL должна начинаться с http:// или https://".to_string());
    }
    let mut held = at(file);
    let endpoint = Endpoint {
        id: id_from(base_url, &held),
        name: name.to_string(),
        base_url: base_url.to_string(),
        models,
    };
    held.endpoints.push(endpoint.clone());
    save(file, &held)?;
    Ok(endpoint)
}

/// Удалить endpoint: нет записи — уже чисто, как у ключа («Убрать» дважды).
pub fn remove_endpoint(file: &Path, id: &str) -> Result<bool, String> {
    let mut held = at(file);
    let before = held.endpoints.len();
    held.endpoints.retain(|one| one.id != id);
    let removed = held.endpoints.len() != before;
    save(file, &held)?;
    Ok(removed)
}

/// Endpoint по идентификатору, если он есть.
pub fn endpoint<'a>(held: &'a Providers, id: &str) -> Option<&'a Endpoint> {
    held.endpoints.iter().find(|one| one.id == id)
}

/// Включённость провайдера или endpoint'а: выключенный попадает в список,
/// включённый из него уходит. Id может не быть среди endpoint'ов — так
/// выключается и встроенный провайдер движка, тем же списком.
pub fn set_enabled(file: &Path, id: &str, enabled: bool) -> Result<(), String> {
    let mut held = at(file);
    if enabled {
        held.disabled.retain(|known| known != id);
    } else if !held.disabled.iter().any(|known| known == id) {
        held.disabled.push(id.to_string());
    }
    save(file, &held)
}

/// Ключ из хранилища ОС: None — записи нет или она пуста. Тот же крейт keyring,
/// что у providers.rs, но сервис называет вызывающий — проверка ходит в свой.
fn read_secret(service: &str, name: &str) -> Option<String> {
    keyring::Entry::new(service, name)
        .ok()
        .and_then(|entry| entry.get_password().ok())
        .filter(|secret| !secret.is_empty())
}

/// Убрать запись ключа названного сервиса: нет записи — уже чисто.
/// Провайдерам окна и проверке: у окна сервис один, у проверки — свой.
pub fn remove_secret(service: &str, name: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, name)
        .map_err(|e| format!("запись «{name}» недоступна в хранилище Windows: {e}"))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("запись «{name}» не удалена из хранилища Windows: {e}")),
    }
}

/// Конфиг движка из включённых endpoint'ов: JSON для переменной окружения
/// `OPENCODE_CONFIG_CONTENT` — ключ едешь в переменной процесса, не в файле.
/// Нет включённых — None: движку нечего передавать.
pub fn engine_config(service: &str, held: &Providers) -> Option<String> {
    let mut providers = serde_json::Map::new();
    for endpoint in &held.endpoints {
        if held.disabled.iter().any(|id| id == &endpoint.id) {
            continue;
        }
        let mut settings = serde_json::Map::new();
        settings.insert("baseURL".into(), serde_json::Value::String(endpoint.base_url.clone()));
        if let Some(secret) = read_secret(service, &key_id(&endpoint.id)) {
            settings.insert("apiKey".into(), serde_json::Value::String(secret));
        }
        let mut models = serde_json::Map::new();
        for model in &endpoint.models {
            models.insert(model.clone(), serde_json::Value::Object(Default::default()));
        }
        let mut entry = serde_json::Map::new();
        entry.insert("name".into(), serde_json::Value::String(endpoint.name.clone()));
        entry.insert("package".into(), serde_json::Value::String(PACKAGE.to_string()));
        entry.insert("settings".into(), serde_json::Value::Object(settings));
        entry.insert("models".into(), serde_json::Value::Object(models));
        providers.insert(endpoint.id.clone(), serde_json::Value::Object(entry));
    }
    if providers.is_empty() {
        return None;
    }
    let config = serde_json::json!({
        "$schema": "https://opencode.ai/config.json",
        "providers": serde_json::Value::Object(providers),
    });
    Some(config.to_string())
}
