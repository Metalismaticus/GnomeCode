//! Каталог моделей для панели «Сравнение моделей» (docs/BATCH.md, пункт 10;
//! docs/specs/2026-10-06-10-compare.md).
//!
//! Сайт opencode.ai/ru/data/compare отдаёт каталог в разметке страницы, но сам
//! он собран из двух чистых JSON (packages/stats/app/src/routes/model-catalog.ts
//! репозитория sst/opencode): `catalog.json` — модели и бенчмарки, `api.json` —
//! цены. Отдаём тот же каталог без рендера: записи те же, что видит сайт
//! (замер 2026-10-06 — имена, цены, бенчмарки спецификации совпадают).
//!
//! Свежий каталог пишется в кэш `compare.json` в папке данных с датой загрузки;
//! сайт недоступен — таблица из кэша, а пометкой о недоступности ведёт `stale`
//! (узор `updatesNote` автообновления). Разбор — в типизированные записи
//! (ADR-0001): наружу уходят [`Snapshot`] и [`Model`], не JSON источника.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::opencode::client::{Api, Endpoint};
use crate::plugins::install;

/// Каталог моделей и бенчмарков: тот же payload, что у сравнения сайта.
pub const CATALOG_URL: &str = "https://models.opencode.ai/catalog.json";
/// Цены за 1 млн токенов: каталог их не несёт, цены приходят отдельным файлом.
pub const PRICES_URL: &str = "https://models.opencode.ai/api.json";
const CACHE_NAME: &str = "compare.json";
const REQUEST_SECONDS: u64 = 30;

/// Бенчмарк модели: имя, число и метрика («%» или «Elo») — формат для человека
/// собирает интерфейс, одним форматтером на всё.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Benchmark {
    pub name: String,
    pub score: f64,
    /// Метрика сайта: `score`, `resolved`, `pass@1`, `accuracy` — проценты;
    /// `Elo` — число рейтинга. Неизвестная — «score».
    #[serde(default)]
    pub metric: String,
}

/// Строка каталога моделей: то, что показывает таблица и раскрытие строки.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Model {
    /// Идентификатор `лаборатория/модель` (например `cohere/north-mini-code-1-0`):
    /// им он уходит движку в запрос («Выбрать»).
    pub id: String,
    /// Лаба модели — подпись под именем.
    pub lab: String,
    pub name: String,
    pub description: String,
    pub context: u64,
    /// Цена за 1 млн токенов, доллары; нет — столбец «—».
    pub input: Option<f64>,
    pub output: Option<f64>,
    /// Цена чтения из кэша; нет — в раскрытии части «Из кэша» не будет.
    pub cache_read: Option<f64>,
    pub release_date: Option<String>,
    pub reasoning: bool,
    pub tool_call: bool,
    pub open_weights: bool,
    /// Модель выводит картинки: в таблице её показывать можно, но «Выбрать»
    /// она остаётся моделью чата — решение против неё не записано, пометка
    /// остаётся honestой частью каталога.
    pub image_output: bool,
    pub benchmarks: Vec<Benchmark>,
    /// Нет у провайдера: модель не названа среди моделей подключённых
    /// провайдеров движка — «Выбрать» выключена. Не узнали (движок поднят?
    /// ответил?) — считается доступной: не знать — не запрещать.
    #[serde(default = "yes")]
    pub available: bool,
    /// Модель движка вне каталога: строка секции «Модели движка» переключателя,
    /// цена «—». В кэш не пишется: поле ставится при сборке снимка, старые кэши
    /// без поля читаются (serde default).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub engine: bool,
}

/// Снимок каталога: строки и дата загрузки (unix-миллисекунды) — «Обновлено …»
/// панели. `stale` — таблица читалась из кэша, сайт не ответил; в файл не пишется.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub fetched_at: u64,
    pub models: Vec<Model>,
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub stale: bool,
}

/// Ответ `available = true` для serde default: старый кэш без поля читается.
fn yes() -> bool {
    true
}

/// Файл кэша в папке данных: переменную задаёт проверка или копия, иначе — папка данных приложения.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, CACHE_NAME)
}

/// Кэш с диска без пометки «сайт недоступен»: кэш-первый запуск панели — сайт
/// ещё не спрашивали, честнее показать дату снимка («Обновлено …»), чем
/// обвинять канал. Потерянный или испорченный — нет кэша.
pub fn fresh_cache(file_path: &Path) -> Option<Snapshot> {
    fs::read(file_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Snapshot>(&bytes).ok())
}

/// Кэш с диска с пометкой `stale`: сайт не ответил (узор fallback `load`) —
/// панель говорит «Сайт недоступен — данные от …». Потерянный или испорченный —
/// нет кэша, панель скажет об ошибке.
pub fn cached(file_path: &Path) -> Option<Snapshot> {
    fresh_cache(file_path).map(|mut snapshot| {
        snapshot.stale = true;
        snapshot
    })
}

/// Каталог с сайта: свежий снимок, кэш обновляется. Сайт или цены не ответили —
/// таблица из кэша с пометкой; кэша нет — причина словами для панели.
pub fn load(catalog_url: &str, prices_url: &str, file_path: &Path) -> Result<Snapshot, String> {
    match fresh(catalog_url, prices_url) {
        Ok(snapshot) => {
            save(file_path, &snapshot)?;
            Ok(snapshot)
        }
        Err(reason) => {
            cached(file_path).ok_or(reason)
        }
    }
}

/// Свежий каталог без кэша: обе части источника, разбор и слияние.
fn fresh(catalog_url: &str, prices_url: &str) -> Result<Snapshot, String> {
    let raw = get(catalog_url)?;
    let prices = get(prices_url)?;
    let mut models = parse(&raw, &prices);
    if models.is_empty() {
        return Err("каталог моделей не читается".to_string());
    }
    sort(&mut models);
    Ok(Snapshot {
        fetched_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or_default(),
        models,
        stale: false,
    })
}

/// Каталог в кэш: дата уже внутри снимка — панель показывает её в «Обновлено …».
pub fn save(file_path: &Path, snapshot: &Snapshot) -> Result<(), String> {
    let json = serde_json::to_string_pretty(snapshot)
        .map_err(|e| format!("каталог моделей не собрался в JSON: {e}"))?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file_path, json)
        .map_err(|e| format!("кэш каталога не записан {}: {e}", file_path.display()))
}

/// Ответ источника: ошибки — словами для панели, без технического адреса.
fn get(url: &str) -> Result<serde_json::Value, String> {
    let text = ureq::get(url)
        .timeout(Duration::from_secs(REQUEST_SECONDS))
        .call()
        .map_err(|e| format!("источник каталога opencode.ai не отвечает: {e}"))?
        .into_string()
        .map_err(|e| format!("ответ opencode.ai не прочитан: {e}"))?;
    serde_json::from_str(&text).map_err(|e| format!("ответ opencode.ai не JSON: {e}"))
}

/// Каталог + цены → строки таблицы. Обе части уже прочитаны.
fn parse(catalog: &serde_json::Value, prices: &serde_json::Value) -> Vec<Model> {
    let costs = prices_of(prices);
    let Some(dict) = catalog.get("models").and_then(|m| m.as_object()) else {
        return Vec::new();
    };
    dict.iter()
        .filter_map(|(id, entry)| model(id, entry, &costs))
        .collect()
}

/// Цена из api.json: `{input, output, cache_read}` — за 1 млн токенов, доллары.
type Cost = (Option<f64>, Option<f64>, Option<f64>);

/// Цены по ключам вида `лаба/модель`: как ищет сайт — точный ид, оба части в
/// слаге, пара и один слаг (лаборатория называет модели не одинаково).
fn prices_of(raw: &serde_json::Value) -> HashMap<String, Cost> {
    let mut map = HashMap::new();
    let Some(providers) = raw.as_object() else {
        return map;
    };
    for provider in providers.values() {
        let Some(models) = provider.get("models").and_then(|m| m.as_object()) else {
            continue;
        };
        for (mid, entry) in models {
            let Some(cost) = entry.get("cost") else { continue };
            let one = (
                cost.get("input").and_then(serde_json::Value::as_f64),
                cost.get("output").and_then(serde_json::Value::as_f64),
                cost.get("cache_read").and_then(serde_json::Value::as_f64),
            );
            if one.0.is_none() && one.1.is_none() {
                continue;
            }
            map.insert(slug(mid), one);
        }
    }
    map
}

fn price_of(costs: &HashMap<String, Cost>, lab: &str, slug_part: &str) -> Cost {
    costs
        .get(&slug(&format!("{lab}/{slug_part}")))
        .or_else(|| costs.get(slug_part))
        .copied()
        .unwrap_or((None, None, None))
}

/// Одна строка каталога из записи: форму записи знает только это место.
fn model(id: &str, entry: &serde_json::Value, costs: &HashMap<String, Cost>) -> Option<Model> {
    let name = entry.get("name").and_then(|n| n.as_str())?.to_string();
    if name.is_empty() {
        return None;
    }
    let (lab, slug_part) = match id.split_once('/') {
        Some((lab, slug)) => (lab.to_string(), slug.to_string()),
        None => return None,
    };
    let (input, output, cache_read) = price_of(costs, &lab, &slug_part);
    Some(Model {
        id: id.to_string(),
        lab,
        name,
        description: entry
            .get("description")
            .and_then(|d| d.as_str())
            .unwrap_or_default()
            .to_string(),
        context: entry
            .get("limit")
            .and_then(|l| l.get("context"))
            .and_then(|c| c.as_u64())
            .unwrap_or_default(),
        input,
        output,
        cache_read,
        release_date: entry
            .get("release_date")
            .and_then(|d| d.as_str())
            .map(str::to_string),
        reasoning: entry.get("reasoning").and_then(|r| r.as_bool()).unwrap_or(false),
        tool_call: entry.get("tool_call").and_then(|t| t.as_bool()).unwrap_or(false),
        open_weights: entry.get("open_weights").and_then(|o| o.as_bool()).unwrap_or(false),
        image_output: entry
            .get("modalities")
            .and_then(|m| m.get("output"))
            .and_then(|o| o.as_array())
            .is_some_and(|list| list.iter().any(|kind| kind.as_str() == Some("image"))),
        benchmarks: entry
            .get("benchmarks")
            .and_then(|b| b.as_array())
            .map(|list| {
                list.iter()
                    .filter_map(|b| {
                        Some(Benchmark {
                            name: b.get("name")?.as_str()?.to_string(),
                            score: b.get("score")?.as_f64()?,
                            metric: b.get("metric").and_then(|m| m.as_str()).unwrap_or("score").to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default(),
        available: true,
        engine: false,
    })
}

/// Порядок сайта: по лабе, внутри — свежие сверху.
fn sort(models: &mut [Model]) {
    models.sort_by(|a, b| {
        a.lab
            .cmp(&b.lab)
            .then(b.release_date.as_deref().cmp(&a.release_date.as_deref()))
            .then(a.name.cmp(&b.name))
    });
}

/// Слаг сайта: нижний регистр, всё кроме букв и цифр — в дефис (packages/stats
/// app/src/routes/model-catalog.ts, `catalogSlug`) — по нему цены и ищутся.
/// Общее место: по тем же слагам статистика сводит расход строк с ценами кэша
/// (src-tauri/src/stats.rs) — второй слаг-функции в проекте нет.
pub fn slug(value: &str) -> String {
    let mut out = String::new();
    let mut dash = false;
    for letter in value.trim().to_lowercase().chars() {
        if letter.is_ascii_alphanumeric() {
            out.push(letter);
            dash = false;
        } else if !dash {
            out.push('-');
            dash = true;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    out
}

/// Модели движка из `GET /api/model` (v2.0.25: `(providerID, modelID, name,
/// context)` включённых моделей доступных провайдеров). Провайдер, выключенный
/// в providers.json, из набора убирается — его модели не помечаются доступными
/// и в секцию движка не попадают.
fn engine_models(raw: &serde_json::Value, disabled: &[String]) -> Vec<(String, String, String, u64)> {
    let Some(list) = raw.as_array() else { return Vec::new() };
    list.iter()
        .filter_map(|one| {
            let provider = one.get("providerID").and_then(|p| p.as_str())?;
            if disabled.iter().any(|id| id == provider) {
                return None;
            }
            let model = one
                .get("modelID")
                .and_then(|m| m.as_str())
                .or_else(|| one.get("id").and_then(|m| m.as_str()))?;
            let enabled = one.get("enabled").and_then(|e| e.as_bool()).unwrap_or(true);
            if !enabled {
                return None;
            }
            let name = one.get("name").and_then(|n| n.as_str()).unwrap_or_default().to_string();
            let context = one
                .get("limit")
                .and_then(|l| l.get("context"))
                .and_then(|c| c.as_u64())
                .unwrap_or_default();
            Some((provider.to_string(), model.to_string(), name, context))
        })
        .collect()
}

/// Имена провайдеров из `GET /api/provider` (v2.0.25 — список активированных):
/// подпись лабы строк секции движка.
fn provider_names(raw: &serde_json::Value) -> HashMap<String, String> {
    let Some(list) = raw.as_array() else { return HashMap::new() };
    list.iter()
        .filter_map(|one| {
            let id = one.get("id").and_then(|i| i.as_str())?;
            let name = one.get("name").and_then(|n| n.as_str()).unwrap_or(id);
            Some((id.to_string(), name.to_string()))
        })
        .collect()
}

/// Модели движка: что доступно у провайдера. `raw` — `data` ответа
/// `GET /api/model` (список `{providerID, modelID, enabled…}`, v2.0.25;
/// старая форма `{all, connected}` из /api/provider ядром больше не отдаётся).
/// Модель каталога доступна, если у включённого провайдера есть модель с тем же
/// именем после «/». Движка нет или он не ответил — снимок не помечается:
/// не знать — не запрещать. Ответ есть — пометки пересчитываются целиком,
/// даже когда выключенные провайдеры оставили список пустым: иначе
/// выключение не прячет модели (пометка оставалась бы прежней).
pub fn with_engine_providers(models: &mut [Model], raw_models: &serde_json::Value, disabled: &[String]) {
    if !raw_models.is_array() {
        return;
    }
    let served: HashSet<String> = engine_models(raw_models, disabled)
        .into_iter()
        .map(|(_, model, _, _)| model)
        .collect();
    for one in models {
        let Some((_, mid)) = one.id.split_once('/') else { continue };
        one.available = served.contains(mid);
    }
}

/// Модели движка вне каталога — секция переключателя: строка на модель
/// включённого провайдера, чьё имя после «/» в каталоге не названо (свои
/// endpoint'ы, локальные серверы). Выключенный провайдер мимо, известная
/// каталогу модель не дублируется. Цена у секции «—», «Выбрать» живая.
pub fn with_engine_models(
    models: &mut Vec<Model>,
    raw_models: &serde_json::Value,
    raw_providers: &serde_json::Value,
    disabled: &[String],
) {
    let known: HashSet<String> = models
        .iter()
        .filter_map(|one| one.id.split_once('/').map(|(_, mid)| mid.to_string()))
        .collect();
    let names = provider_names(raw_providers);
    for (provider, model, name, context) in engine_models(raw_models, disabled) {
        if known.contains(&model) {
            continue;
        }
        models.push(Model {
            id: format!("{provider}/{model}"),
            lab: names.get(&provider).cloned().unwrap_or_else(|| provider.clone()),
            name: if name.is_empty() { model.clone() } else { name },
            description: "Модель движка вне каталога opencode.ai".to_string(),
            context,
            input: None,
            output: None,
            cache_read: None,
            release_date: None,
            reasoning: false,
            tool_call: true,
            open_weights: false,
            image_output: false,
            benchmarks: Vec::new(),
            available: true,
            engine: true,
        });
    }
}

/// Модели движка к снимку: движок поднят — модели помечаются и секция
/// собирается, нет — как есть. Выключенные провайдеры (providers.json) их
/// модели прячут и из пометок, и из секции.
pub fn availability(chat_endpoint: Option<Endpoint>, snapshot: &mut Snapshot, disabled: &[String]) {
    let Some(endpoint) = chat_endpoint else { return };
    let api = Api::new(&endpoint);
    let Ok(raw_models) = api.models() else { return };
    with_engine_providers(&mut snapshot.models, &raw_models, disabled);
    let raw_providers = api.providers().unwrap_or(serde_json::Value::Null);
    with_engine_models(&mut snapshot.models, &raw_models, &raw_providers, disabled);
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Записи из «Настоящих данных» спеки: имена, цены, контекст и Elo-метрика
    /// разбираются в типы, не в строки чужого JSON.
    #[test]
    fn catalog_and_prices_parse_into_records() {
        let catalog = serde_json::json!({
            "models": {
                "anthropic/claude-sonnet-5-5": {
                    "name": "Claude Sonnet 5.5",
                    "description": "Fast Claude model",
                    "release_date": "2026-09-28",
                    "reasoning": true,
                    "tool_call": true,
                    "open_weights": false,
                    "limit": { "context": 1000000 },
                    "modalities": { "input": ["text"], "output": ["text"] },
                    "benchmarks": [
                        { "name": "Terminal-Bench", "score": 70.6, "metric": "score" },
                        { "name": "GDPval-AA", "score": 1844, "metric": "Elo" }
                    ]
                },
                "alibaba/qwen-image-2.1": {
                    "name": "Qwen-Image-2.1",
                    "limit": { "context": 8192 },
                    "modalities": { "input": ["text", "image"], "output": ["image"] },
                    "benchmarks": []
                }
            }
        });
        let prices = serde_json::json!({
            "anthropic": {
                "models": {
                    "claude-sonnet-5-5": { "cost": { "input": 2.0, "output": 10.0, "cache_read": 0.2 } }
                }
            }
        });
        let models = parse(&catalog, &prices);
        assert_eq!(models.len(), 2, "обе модели каталога разобрались: {models:?}");
        let claude = models.iter().find(|m| m.id == "anthropic/claude-sonnet-5-5").expect("Claude на месте");
        assert_eq!(claude.input, Some(2.0), "цена ввода пришла от api.json");
        assert_eq!(claude.output, Some(10.0));
        assert_eq!(claude.cache_read, Some(0.2), "цена из кэша не потерялась");
        assert_eq!(claude.context, 1_000_000);
        assert_eq!(claude.benchmarks[1].metric, "Elo", "метрика Elo дошла до интерфейса");
        assert!(claude.reasoning && claude.tool_call && !claude.open_weights);
        let qwen = models.iter().find(|m| m.id == "alibaba/qwen-image-2.1").expect("Qwen на месте");
        assert_eq!(qwen.input, None, "у модели без цены столбец пуст — «—»");
        assert!(qwen.image_output, "вывод картинок разобран из модальностей");
        assert!(qwen.benchmarks.is_empty(), "у модели без бенчмарков список пуст — «—»");
    }

    /// Кэш-первый: обычный запуск панели читает кэш без пометки «недоступен»
    /// (сайт ещё не спрашивали), а fallback после сетевого провала — со `stale`.
    #[test]
    fn cache_read_is_stale_only_after_the_site_failed() {
        let file = std::env::temp_dir().join(format!("compare-cache-{}.json", std::process::id()));
        let snapshot = Snapshot {
            fetched_at: 1_765_000_000_000,
            models: Vec::new(),
            stale: false,
        };
        save(&file, &snapshot).expect("кэш записан");
        let plain = fresh_cache(&file).expect("кэш читается");
        assert!(
            !plain.stale,
            "кэш-первый запуск не зовёт сеть — «Сайт недоступен» не положено"
        );
        assert_eq!(plain.fetched_at, 1_765_000_000_000, "дата снимка дошла");
        let marked = cached(&file).expect("кэш читается");
        assert!(
            marked.stale,
            "fallback после сетевого провала помечен — панель говорит о канале"
        );
        let _ = std::fs::remove_file(&file);
    }

    /// Провайдеры движка: модель чужой лабы, чьё имя есть у включённого
    /// провайдера, доступна; у неподключённого провайдера — «Нет у провайдера».
    /// Форма `/api/model` v2.0.25: плоский список с providerID/modelID.
    #[test]
    fn engine_providers_mark_availability() {
        let catalog = serde_json::json!({
            "models": {
                "zhipuai/glm-5.3-flash": { "name": "GLM-5.3 Flash", "limit": { "context": 200000 } },
                "deepseek/deepseek-v4-1-flash": { "name": "DeepSeek V4.1 Flash", "limit": { "context": 128000 } }
            }
        });
        let mut models = parse(&catalog, &serde_json::json!({}));
        with_engine_providers(
            &mut models,
            &serde_json::json!([
                { "providerID": "zai-coding-plan", "modelID": "glm-5.3-flash", "enabled": true },
                { "providerID": "groq", "modelID": "compound", "enabled": true },
                { "providerID": "broken", "modelID": "off", "enabled": false }
            ]),
            &[],
        );
        let glm = models.iter().find(|m| m.id == "zhipuai/glm-5.3-flash").expect("GLM на месте");
        assert!(glm.available, "имя модели есть у включённого провайдера — доступна");
        let deepseek = models.iter().find(|m| m.id == "deepseek/deepseek-v4-1-flash").expect("DeepSeek на месте");
        assert!(!deepseek.available, "провайдер не подключён — «Нет у провайдера»");
    }

    /// Выключенный провайдер (providers.json) прячет свои модели: пометка
    /// «Нет у провайдера» возвращается, в секцию движка модель не попадает.
    #[test]
    fn disabled_provider_hides_its_models() {
        let catalog = serde_json::json!({
            "models": { "zhipuai/glm-5.3-flash": { "name": "GLM-5.3 Flash", "limit": { "context": 200000 } } }
        });
        let mut models = parse(&catalog, &serde_json::json!({}));
        let served = serde_json::json!([
            { "providerID": "zai-coding-plan", "modelID": "glm-5.3-flash", "enabled": true }
        ]);
        with_engine_providers(&mut models, &served, &[]);
        assert!(models[0].available, "включён — доступна");
        with_engine_providers(&mut models, &served, &["zai-coding-plan".to_string()]);
        assert!(!models[0].available, "выключен — «Нет у провайдера»");
    }

    /// Секция «Модели движка»: модель своего endpoint'а, которой в каталоге нет,
    /// добавляется с ценой «—» и пометкой движка; имя после «/», известное
    /// каталогу, не дублируется; у выключенного провайдера модели нет.
    #[test]
    fn engine_models_outside_the_catalog_become_a_section() {
        let providers = serde_json::json!([
            { "id": "llm-corp", "name": "Корпоративный прокси" },
            { "id": "zai-coding-plan", "name": "Z.AI Coding Plan" }
        ]);
        let served = serde_json::json!([
            { "providerID": "llm-corp", "modelID": "corp-model-a", "name": "Corp Model A", "limit": { "context": 8192 }, "enabled": true },
            { "providerID": "llm-corp", "modelID": "corp-off", "name": "Off", "enabled": false },
            { "providerID": "zai-coding-plan", "modelID": "glm-5.3-flash", "name": "GLM-5.3 Flash", "enabled": true }
        ]);
        let catalog = serde_json::json!({
            "models": { "zhipuai/glm-5.3-flash": { "name": "GLM-5.3 Flash", "limit": { "context": 200000 } } }
        });
        let mut models = parse(&catalog, &serde_json::json!({}));
        with_engine_models(&mut models, &served, &providers, &[]);
        assert_eq!(models.len(), 2, "добавлена одна модель движка, известная каталогу не дублировалась: {models:?}");
        let section = models.last().expect("модель движка в конце снимка");
        assert_eq!(section.id, "llm-corp/corp-model-a");
        assert!(section.engine, "строка помечена моделью движка");
        assert_eq!(section.lab, "Корпоративный прокси", "лаба — имя провайдера");
        assert_eq!(section.name, "Corp Model A");
        assert_eq!(section.context, 8192);
        assert_eq!(section.input, None, "цены у модели движка нет — «—»");
        assert_eq!(section.output, None);
        assert!(section.available, "модель движка выбирается");

        with_engine_models(&mut models, &served, &providers, &["llm-corp".to_string()]);
        assert_eq!(models.len(), 2, "выключенный endpoint секцию не пополнил");
    }
}
