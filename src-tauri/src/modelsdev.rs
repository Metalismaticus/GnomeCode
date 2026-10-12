//! Каталог провайдеров и моделей models.dev — тот же источник, из которого живёт
//! сам OpenCode (`https://models.dev/api.json`, замер 2026-10-11: 226 провайдеров,
//! у каждого имя, переменные ключа и полный список моделей с ценами и лимитами).
//!
//! Зачем он здесь: окно настроек должно дать ключ ЛЮБОМУ провайдеру, а не только
//! тем, которых движок уже перечислил (у него в списке лишь подключённые — без
//! ключа Z.AI не видно, и ключ ему не дать; слова владельца 2026-10-10: «мы как в
//! опенкод добавим всю поддержку провайдеров»). Из каталога же взяты имена
//! переменных окружения: движок активирует провайдера по переменной его ключа
//! (`env` записи провайдера), и наш сохранённый ключ доезжает до него ею —
//! измерено на живом ядре v2.0.26 (2026-10-11): с `ZHIPU_API_KEY` движок отдаёт
//! все 7 моделей Z.AI Coding Plan, без неё — ни одной.
//!
//! Кэш — `models-dev.json` в папке данных, узор `compare.json`: сайт не ответил —
//! читаем с диска, сети на каждом запуске нет.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::plugins::install;

/// Каталог провайдеров: тот же файл, что читает движок.
pub const CATALOG_URL: &str = "https://models.dev/api.json";
/// Имя файла кэша в папке данных.
const CACHE_NAME: &str = "models-dev.json";
/// Сколько ждать источник: файл 5 МБ, медленная сеть не должна вешать окно.
const REQUEST_SECONDS: u64 = 30;

/// Модель провайдера каталога: то, что показывает строка списка.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogModel {
    pub id: String,
    pub name: String,
    /// Цена за 1 млн токенов, доллары; нет — столбец «—».
    #[serde(default)]
    pub input: Option<f64>,
    #[serde(default)]
    pub output: Option<f64>,
    /// Контекст модели в токенах.
    #[serde(default)]
    pub context: u64,
    #[serde(default)]
    pub reasoning: bool,
    #[serde(default)]
    pub tool_call: bool,
    #[serde(default)]
    pub release_date: Option<String>,
}

/// Провайдер каталога: имя, переменные ключа и его модели.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogProvider {
    pub id: String,
    pub name: String,
    /// Имена переменных окружения ключа (`env` записи models.dev): пусто —
    ///    провайдер работает без ключа (локальный сервер).
    #[serde(default)]
    pub env: Vec<String>,
    #[serde(default)]
    pub models: Vec<CatalogModel>,
}

/// Снимок каталога с датой загрузки (unix-миллисекунды).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub fetched_at: u64,
    pub providers: Vec<CatalogProvider>,
}

/// Файл кэша в папке данных: переменную задаёт проверка или копия, иначе — папка
/// данных приложения.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, CACHE_NAME)
}

/// Кэш с диска: потерянный или испорченный — нет каталога.
pub fn cached(path: &Path) -> Option<Catalog> {
    fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Catalog>(&bytes).ok())
}

/// Каталог: свежий с models.dev и в кэш; сайт не ответил — кэш; кэша нет — причина.
pub fn load(url: &str, path: &Path) -> Result<Catalog, String> {
    match fresh(url) {
        Ok(catalog) => {
            save(path, &catalog)?;
            Ok(catalog)
        }
        Err(reason) => cached(path).ok_or(reason),
    }
}

/// Свежий каталог без кэша: чтение источника и разбор.
fn fresh(url: &str) -> Result<Catalog, String> {
    let text = ureq::get(url)
        .timeout(Duration::from_secs(REQUEST_SECONDS))
        .call()
        .map_err(|e| format!("источник models.dev не отвечает: {e}"))?
        .into_string()
        .map_err(|e| format!("ответ models.dev не прочитан: {e}"))?;
    let catalog = parse(&text)?;
    if catalog.providers.is_empty() {
        return Err("каталог провайдеров пуст".to_string());
    }
    Ok(catalog)
}

/// Разбор ответа models.dev: ключ записи — id провайдера, внутри — имя, `env`
/// и карта моделей. Форм ответа много (у моделей не всегда все поля), поэтому
/// поля с умолчаниями: неизвестное — нули и «—», а не поломка.
pub fn parse(raw: &str) -> Result<Catalog, String> {
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|e| format!("ответ models.dev не JSON: {e}"))?;
    let Some(map) = value.as_object() else {
        return Err("ответ models.dev не словарь провайдеров".to_string());
    };
    let mut providers: Vec<CatalogProvider>= Vec::new();
    for (id, entry) in map {
        let Some(entry) = entry.as_object() else { continue };
        let name = entry
            .get("name")
            .and_then(serde_json::Value::as_str)
            .unwrap_or(id)
            .to_string();
        let env = entry
            .get("env")
            .and_then(serde_json::Value::as_array)
            .map(|list| {
                list.iter()
                    .filter_map(serde_json::Value::as_str)
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default();
        let models = entry
            .get("models")
            .and_then(serde_json::Value::as_object)
            .map(|models| {
                models
                    .iter()
                    .filter_map(|(mid, one)| catalog_model(mid, one))
                    .collect()
            })
            .unwrap_or_default();
        providers.push(CatalogProvider {
            id: id.clone(),
            name,
            env,
            models,
        });
    }
    providers.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(Catalog {
        fetched_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or_default(),
        providers,
    })
}

/// Одна модель каталога: без имени записи не бывает — пропускаем.
fn catalog_model(id: &str, one: &serde_json::Value) -> Option<CatalogModel> {
    let name = one.get("name").and_then(serde_json::Value::as_str)?.to_string();
    let cost = one.get("cost");
    Some(CatalogModel {
        id: id.to_string(),
        name,
        input: cost
            .and_then(|c| c.get("input"))
            .and_then(serde_json::Value::as_f64),
        output: cost
            .and_then(|c| c.get("output"))
            .and_then(serde_json::Value::as_f64),
        context: one
            .get("limit")
            .and_then(|l| l.get("context"))
            .and_then(serde_json::Value::as_u64)
            .unwrap_or_default(),
        reasoning: one
            .get("reasoning")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        tool_call: one
            .get("tool_call")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        release_date: one
            .get("release_date")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
    })
}

/// Каталог в кэш: папка данных создаётся при первом сохранении. Запись через
/// временный файл и переименование — движок читает кэш при подъёме, и
/// половина файла не должна ему попасться.
pub fn save(path: &Path, catalog: &Catalog) -> Result<(), String> {
    let json = serde_json::to_string_pretty(catalog)
        .map_err(|e| format!("каталог models.dev не собрался в JSON: {e}"))?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    let temp = path.with_extension("part");
    fs::write(&temp, json).map_err(|e| format!("кэш models-dev не записан {}: {e}", temp.display()))?;
    fs::rename(&temp, path)
        .map_err(|e| format!("кэш models-dev не сохранён {}: {e}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Запись провайдера из живого ответа models.dev: имя, переменные ключа,
    /// модели с ценой и лимитом — в типы, а не в строки чужого JSON.
    #[test]
    fn provider_record_parses_env_and_models() {
        let raw = r#"{
            "zai-coding-plan": {
                "name": "Z.AI Coding Plan",
                "env": ["ZHIPU_API_KEY"],
                "api": "https://api.z.ai/api/coding/paas/v4",
                "models": {
                    "glm-5.3-flash": {
                        "name": "GLM-5.3-Flash",
                        "reasoning": true,
                        "tool_call": true,
                        "release_date": "2026-08-26",
                        "limit": {"context": 1000000, "output": 131072 },
                        "cost": {"input": 0, "output": 0, "cache_read": 0, "cache_write": 0 }
                    }
                }
            }
        }"#;
        let catalog = parse(raw).expect("каталог разобрался");
        assert_eq!(catalog.providers.len(), 1, "один провайдер: {:?}", catalog.providers);
        let zai = &catalog.providers[0];
        assert_eq!(zai.id, "zai-coding-plan");
        assert_eq!(zai.name, "Z.AI Coding Plan");
        assert_eq!(zai.env, vec!["ZHIPU_API_KEY".to_string()], "переменная ключа доехала");
        assert_eq!(zai.models.len(), 1, "модель провайдера на месте");
        let glm = &zai.models[0];
        assert_eq!(glm.id, "glm-5.3-flash");
        assert_eq!(glm.name, "GLM-5.3-Flash");
        assert_eq!(glm.context, 1_000_000, "контекст доехал");
        assert!(glm.reasoning && glm.tool_call);
        assert_eq!(glm.input, Some(0.0), "цена нулём — это цена, а не «нет»");
        assert_eq!(glm.release_date.as_deref(), Some("2026-08-26"));
    }

    /// Мусор и не-словарь — честная ошибка, паники нет.
    #[test]
    fn broken_payload_is_named() {
        assert!(parse("[]").is_err(), "массив вместо словаря — ошибка");
        assert!(parse("{broken").is_err(), "не JSON — ошибка");
    }

    /// Кэш круглый: записанный каталог читается тем же разбором.
    #[test]
    fn cache_round_trip() {
        let file = std::env::temp_dir().join(format!("models-dev-{}.json", std::process::id()));
        let catalog = parse(r#"{"local": {"name": "Локальный", "models": {"m1": {"name": "М1"}}}}"#)
            .expect("каталог разобрался");
        save(&file, &catalog).expect("кэш записан");
        let back = cached(&file).expect("кэш читается");
        assert_eq!(back, catalog, "записанное и прочитанное совпали");
        assert_eq!(back.providers[0].env.len(), 0, "провайдер без ключа — переменных нет");
        let _ = std::fs::remove_file(&file);
    }
}
