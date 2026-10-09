//! Сбор расхода в `stats.jsonl` (docs/BATCH.md, пункт 2, шаг «сбор»): каждый
//! завершённый шаг модели (`session.step.ended`) — одна строка JSON в файле
//! папки данных: время, сессия, провайдер/модель, токены (ввод/вывод/кэш),
//! стоимость, длительность, проект.
//!
//! Статистика — отдельный потребитель тех же событий, что и лента: строки
//! ленты не меняются, ленту запись не рвёт (ошибки записи глотаются, узор
//! `plugins/usage.rs`). Файл — append: уже записанное переживает обрыв потока
//! и рестарт движка; повтор события того же шага строку не дублирует.
//!
//! Длительность — от времени отправки шага (`session.step.started.started`,
//! часы движка) до записи строки (локальные часы): движок живёт на той же
//! машине. Провайдер/модель шаг remembered с `step.started`; шаг, чей
//! `started` не видели (обрыв до конца ответа), пишется с последней известной
//! моделью сессии и нулевой длительностью — расход не теряется.
//!
//! Формат строк — контракт шага «экран» (волна 3): после этого шага не меняется.

use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::opencode::client::ServerEvent;
use crate::compare;
use crate::plugins::install;
use crate::state::Store;

/// Имя файла расхода в папке данных.
const FILE_NAME: &str = "stats.jsonl";

/// Папка данных для `file`: задаёт setup окна один раз, как
/// `engine::set_config_folder`. У проверок своя папка — через переменную
/// окружения (`install::data_file`), у прямых вызовов — свой путь.
static FOLDER: std::sync::OnceLock<PathBuf> = std::sync::OnceLock::new();

/// Задать папку данных: зовёт setup окна рядом с `set_config_folder`.
pub fn set_folder(folder: PathBuf) {
    let _ = FOLDER.set(folder);
}

/// Файл расхода в папке данных: переменная окружения сильнее заданной папки —
/// проверки и копии изолированы даже без `set_folder`.
pub fn file() -> PathBuf {
    install::data_file(
        FOLDER
            .get()
            .cloned()
            .unwrap_or_else(|| std::env::temp_dir().join("GnomeCode")),
        FILE_NAME,
    )
}

/// Строка расхода. Плоские поля: файл читает шаг «экран» и человек — без
/// вложенности. Секретов здесь нет: идентификаторы, числа и путь проекта.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Row {
    /// Завершение шага (unix-миллисекунды).
    pub time: u64,
    /// Сессия движка.
    pub session: String,
    /// Провайдер и модель шага, как их назвал движок.
    pub provider: String,
    pub model: String,
    /// Токены шага: ввод, вывод, рассуждения, кэш (чтение/запись).
    pub input: f64,
    pub output: f64,
    pub reasoning: f64,
    pub cache_read: f64,
    pub cache_write: f64,
    /// Стоимость шага в долларах, как её посчитал движок.
    pub cost: f64,
    /// От отправки шага до завершения; отправку не видели — 0.
    pub duration_ms: u64,
    /// Папка проекта окна на момент записи; проекта нет — пусто.
    pub project: String,
}

/// Писатель расхода: живёт в потоке ленты дольше одного соединения — обрыв
/// потока и рестарт движка его не пересоздают, уже записанное не теряется.
/// Отдельный потребитель событий: лента про него ничего не знает.
pub struct Recorder {
    file: PathBuf,
    store: Option<Arc<Store>>,
    /// Шаги, строка по которым записана: (сессия, сообщение) — повтор события
    /// (обрыв и возврат того же шага) строку не дублирует.
    seen: BTreeSet<(String, String)>,
    /// (сессия, сообщение) → (отправка мс, провайдер, модель): модель шаг
    /// называет раньше расхода.
    steps: BTreeMap<(String, String), (u64, String, String)>,
    /// Сессия → последняя известная модель: шаг без увиденного `started`
    /// (обрыв до конца ответа) всё равно записывается.
    models: BTreeMap<String, (String, String)>,
}

impl Recorder {
    /// Писатель в названный файл; хранилище окна даёт проект записи.
    pub fn at(file: PathBuf, store: Option<Arc<Store>>) -> Recorder {
        Recorder {
            file,
            store,
            seen: BTreeSet::new(),
            steps: BTreeMap::new(),
            models: BTreeMap::new(),
        }
    }

    /// Событие потока → строка расхода. Чужие сессии и события не про расход —
    /// пусто. Запись ошибок не возвращает: расход — заметка о работе, лента и
    /// ответ модели из-за него не страдают (узор `plugins/usage.rs`).
    pub fn observe(&mut self, event: &ServerEvent, session: &str) {
        match event {
            ServerEvent::StepStarted { data } if data.session == session => {
                let Some(model) = &data.model else {
                    return;
                };
                self.models.insert(
                    data.session.clone(),
                    (model.provider.clone(), model.id.clone()),
                );
                self.steps.insert(
                    (data.session.clone(), data.message.clone()),
                    (data.started, model.provider.clone(), model.id.clone()),
                );
            }
            ServerEvent::StepEnded { data } if data.session == session => {
                let key = (data.session.clone(), data.message.clone());
                if self.seen.contains(&key) {
                    return;
                }
                self.seen.insert(key.clone());
                let (started, provider, model) = match self.steps.remove(&key) {
                    Some(found) => found,
                    None => {
                        let (provider, model) = self
                            .models
                            .get(&data.session)
                            .cloned()
                            .unwrap_or_default();
                        (0, provider, model)
                    }
                };
                let now = unix_ms();
                let duration = if started > 0 && now > started {
                    now - started
                } else {
                    0
                };
                self.write(Row {
                    time: now,
                    session: data.session.clone(),
                    provider,
                    model,
                    input: data.tokens.input,
                    output: data.tokens.output,
                    reasoning: data.tokens.reasoning,
                    cache_read: data.tokens.cache.read,
                    cache_write: data.tokens.cache.write,
                    cost: data.cost,
                    duration_ms: duration,
                    project: self.project(),
                });
            }
            _ => {}
        }
    }

    /// Папка проекта окна: текущая из state, если хранилище есть.
    fn project(&self) -> String {
        self.store
            .as_ref()
            .map(|store| store.load().project.unwrap_or_default())
            .unwrap_or_default()
    }

    /// Одна строка JSON в конец файла: папка создаётся, ошибки глотаются —
    /// испорченный или потерянный файл расходу сообщения не мешает.
    fn write(&self, row: Row) {
        let Ok(json) = serde_json::to_string(&row) else {
            return;
        };
        if let Some(parent) = self.file.parent() {
            let _ = fs::create_dir_all(parent);
        }
        if let Ok(mut file) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.file)
        {
            let _ = writeln!(file, "{json}");
        }
    }
}

fn unix_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|span| span.as_millis() as u64)
        .unwrap_or(0)
}

/// Период сводки: последние 7 дней, 30 или всё.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Period {
    Days7,
    Days30,
    All,
}

impl Period {
    /// Из строки моста: «7», «30» или «all».
    pub fn parse(value: &str) -> Result<Period, String> {
        match value {
            "7" => Ok(Period::Days7),
            "30" => Ok(Period::Days30),
            "all" => Ok(Period::All),
            other => Err(format!("неизвестный период «{other}»: 7, 30 или all")),
        }
    }

    /// Граница периода: строки со временем раньше неё не считаются.
    fn cutoff(self, now: u64) -> Option<u64> {
        const DAY_MS: u64 = 24 * 60 * 60 * 1000;
        match self {
            Period::Days7 => Some(now.saturating_sub(7 * DAY_MS)),
            Period::Days30 => Some(now.saturating_sub(30 * DAY_MS)),
            Period::All => None,
        }
    }
}

/// Сумма расхода группы: токены по частям, деньги известной части, время.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub input: f64,
    pub output: f64,
    pub reasoning: f64,
    pub cache_read: f64,
    pub cache_write: f64,
    /// Деньги по ценам кэша compare; None — в группе нет оценённых строк.
    pub cost: Option<f64>,
    /// Есть и оценённые, и неоценённые строки: сумма — известная часть.
    pub cost_partial: bool,
    pub duration_ms: u64,
}

/// Расход одной модели: ид движка и имя из кэша, если модель там нашлась.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelUsage {
    pub provider: String,
    pub model: String,
    pub name: Option<String>,
    pub usage: Usage,
}

/// Расход одного проекта: путь папки, как он записан в строках.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectUsage {
    pub path: String,
    pub usage: Usage,
}

/// Ответ `stats_summary`: итог и деления, сверху — самые прожорливые группы.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub totals: Usage,
    pub projects: Vec<ProjectUsage>,
    pub models: Vec<ModelUsage>,
    /// Дата применённого кэша цен (compare fetched_at); кэша нет — None.
    pub priced_at: Option<u64>,
}

/// Накопитель группы: токены и время складываются, деньги — только по
/// оценённым строкам; доля оценённых решает, что показать в деньгах.
#[derive(Default)]
struct Acc {
    input: f64,
    output: f64,
    reasoning: f64,
    cache_read: f64,
    cache_write: f64,
    cost: f64,
    priced: u64,
    unpriced: u64,
    duration_ms: u64,
}

impl Acc {
    fn add(&mut self, row: &Row, cost: Option<f64>) {
        self.input += row.input;
        self.output += row.output;
        self.reasoning += row.reasoning;
        self.cache_read += row.cache_read;
        self.cache_write += row.cache_write;
        self.duration_ms += row.duration_ms;
        match cost {
            Some(money) => {
                self.cost += money;
                self.priced += 1;
            }
            None => self.unpriced += 1,
        }
    }

    fn finish(self) -> Usage {
        Usage {
            input: self.input,
            output: self.output,
            reasoning: self.reasoning,
            cache_read: self.cache_read,
            cache_write: self.cache_write,
            cost: (self.priced > 0).then_some(self.cost),
            cost_partial: self.priced > 0 && self.unpriced > 0,
            duration_ms: self.duration_ms,
        }
    }
}

/// Совпадение строки расхода с моделью кэша compare: цены и имя для показа.
struct Match {
    input: f64,
    output: f64,
    cache_read: Option<f64>,
    name: String,
}

impl Match {
    fn same_prices(&self, other: &Match) -> bool {
        self.input == other.input && self.output == other.output && self.cache_read == other.cache_read
    }
}

/// Цены модели каталога: обе основные должны быть названы — половины цен не
/// бывает, «—» в таблице сравнения значит «стоимость неизвестна».
fn prices_of(one: &compare::Model) -> Option<(f64, f64, Option<f64>)> {
    Some((one.input?, one.output?, one.cache_read))
}

/// Совпадение строки расхода с кэшем compare по точным слагам: сначала полный
/// ид движка `провайдер/модель` против ид каталога, иначе — слаг имени модели,
/// как ищет цены сам сайт (compare::price_of). Разные цены у одинаковых имён —
/// «стоимость неизвестна», не угадывать.
fn match_of(models: &[compare::Model], provider: &str, model: &str) -> Option<Match> {
    let full = compare::slug(&format!("{provider}/{model}"));
    if let Some(one) = models.iter().find(|one| compare::slug(&one.id) == full) {
        return prices_of(one).map(|(input, output, cache_read)| Match {
            input,
            output,
            cache_read,
            name: one.name.clone(),
        });
    }
    let tail = compare::slug(model);
    let mut found: Option<Match> = None;
    for one in models {
        let Some((_, part)) = one.id.split_once('/') else {
            continue;
        };
        if compare::slug(part) != tail {
            continue;
        }
        let Some((input, output, cache_read)) = prices_of(one) else {
            continue;
        };
        let next = Match {
            input,
            output,
            cache_read,
            name: one.name.clone(),
        };
        match &found {
            Some(held) if held.same_prices(&next) => {}
            Some(_) => return None,
            None => found = Some(next),
        }
    }
    found
}

/// Деньги строки по ценам кэша: рассуждения выставляются по цене вывода
/// (провайдеры считают их выводом), неназванная цена чтения кэша — бесплатная.
fn row_cost(row: &Row, found: &Match) -> f64 {
    (row.input * found.input
        + (row.output + row.reasoning) * found.output
        + row.cache_read * found.cache_read.unwrap_or(0.0))
        / 1_000_000.0
}

/// Сводка расхода для раздела «Статистика»: одна команда читает stats.jsonl
/// целиком и считает суммы по проектам и моделям — экран тысяч строк не видит.
/// Цены — только из кэша compare (сеть не зовётся): строки хранят токены, деньги
/// каждый раз пересчитываются по актуальным ценам; `priced_at` — дата кэша.
pub fn summary(file: &Path, period: &str, prices: Option<&compare::Snapshot>) -> Result<Summary, String> {
    let period = Period::parse(period)?;
    let cutoff = period.cutoff(unix_ms());
    let mut totals = Acc::default();
    let mut models_acc: BTreeMap<(String, String), Acc> = BTreeMap::new();
    let mut projects_acc: BTreeMap<String, Acc> = BTreeMap::new();
    // Цена каждой пары провайдер/модель ищется в кэше один раз на сводку.
    let mut priced: BTreeMap<(String, String), Option<Match>> = BTreeMap::new();
    if let Ok(text) = fs::read_to_string(file) {
        for line in text.lines() {
            // Мусор и оборванная строка — норма: сводка считает то, что прочиталось.
            let Ok(row) = serde_json::from_str::<Row>(line) else {
                continue;
            };
            if cutoff.is_some_and(|limit| row.time < limit) {
                continue;
            }
            let key = (row.provider.clone(), row.model.clone());
            let found = priced.entry(key.clone()).or_insert_with(|| {
                prices.and_then(|snapshot| match_of(&snapshot.models, &key.0, &key.1))
            });
            let money = found.as_ref().map(|one| row_cost(&row, one));
            totals.add(&row, money);
            models_acc.entry(key).or_default().add(&row, money);
            projects_acc.entry(row.project.clone()).or_default().add(&row, money);
        }
    }
    let billed = |usage: &Usage| usage.input + usage.output + usage.reasoning;
    let mut models: Vec<ModelUsage> = models_acc
        .into_iter()
        .map(|((provider, model), acc)| ModelUsage {
            name: priced
                .get(&(provider.clone(), model.clone()))
                .and_then(|found| found.as_ref())
                .map(|found| found.name.clone()),
            provider,
            model,
            usage: acc.finish(),
        })
        .collect();
    models.sort_by(|a, b| {
        billed(&b.usage)
            .total_cmp(&billed(&a.usage))
            .then_with(|| a.provider.cmp(&b.provider))
            .then_with(|| a.model.cmp(&b.model))
    });
    let mut projects: Vec<ProjectUsage> = projects_acc
        .into_iter()
        .map(|(path, acc)| ProjectUsage { path, usage: acc.finish() })
        .collect();
    projects.sort_by(|a, b| billed(&b.usage).total_cmp(&billed(&a.usage)).then_with(|| a.path.cmp(&b.path)));
    let mut totals = totals.finish();
    if models.is_empty() && projects.is_empty() {
        // Пустые данные — честный ноль, а не «стоимость неизвестна».
        totals.cost = Some(0.0);
    }
    Ok(Summary {
        totals,
        projects,
        models,
        priced_at: prices.map(|one| one.fetched_at),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::compare::{Model, Snapshot};

    /// Временный файл сводки: своя папка на тест, данные владельца не касаются.
    fn temp_file(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("gnomecode-summary-{}-{name}.jsonl", std::process::id()))
    }

    fn row_at(
        time: u64,
        project: &str,
        provider: &str,
        model: &str,
        input: f64,
        output: f64,
        reasoning: f64,
        cache_read: f64,
        duration_ms: u64,
    ) -> Row {
        Row {
            time,
            session: "ses".to_string(),
            provider: provider.to_string(),
            model: model.to_string(),
            input,
            output,
            reasoning,
            cache_read,
            cache_write: 0.0,
            cost: 0.0,
            duration_ms,
            project: project.to_string(),
        }
    }

    /// Строки пишутся тем же serde, что и живой Recorder: формат один.
    fn write_rows(path: &Path, rows: &[Row]) {
        let text = rows
            .iter()
            .map(|one| serde_json::to_string(one).expect("строка расхода серализуется"))
            .collect::<Vec<_>>()
            .join("\n");
        fs::write(path, text + "\n").expect("файл расхода записан");
    }

    fn catalog_model(id: &str, input: Option<f64>, output: Option<f64>, cache_read: Option<f64>) -> Model {
        Model {
            id: id.to_string(),
            lab: id.split_once('/').unwrap_or(("", "")).0.to_string(),
            name: format!("Имя {id}"),
            description: String::new(),
            context: 0,
            input,
            output,
            cache_read,
            release_date: None,
            reasoning: false,
            tool_call: false,
            open_weights: false,
            image_output: false,
            benchmarks: Vec::new(),
            available: true,
            engine: false,
        }
    }

    /// Цены, как в фикстуре интерфейса (src/fixtureCompare.ts): GLM и Claude.
    fn prices(fetched_at: u64, glm_input: f64) -> Snapshot {
        Snapshot {
            fetched_at,
            models: vec![
                catalog_model("zhipuai/glm-5.3-flash", Some(glm_input), Some(0.56), Some(0.02)),
                catalog_model("anthropic/claude-sonnet-5-5", Some(2.0), Some(10.0), Some(0.2)),
                catalog_model("free/zero", Some(0.0), Some(0.0), None),
            ],
            stale: false,
        }
    }

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 1e-9
    }

    /// Сводка складывает строки по проектам и моделям, деньги — по ценам кэша;
    /// у группы со смешанными ценами помечена известная часть.
    #[test]
    fn summary_aggregates_projects_models_and_money() {
        let file = temp_file("aggregate");
        let day: u64 = 24 * 60 * 60 * 1000;
        let now = unix_ms();
        write_rows(
            &file,
            &[
                row_at(now - 2 * day, "C:\\пр\\GnomeCode", "zai-coding-plan", "glm-5.3-flash", 500_000.0, 250_000.0, 0.0, 0.0, 12_000),
                row_at(now - 5 * day, "C:\\пр\\GnomeCode", "anthropic", "claude-sonnet-5-5", 100_000.0, 50_000.0, 50_000.0, 1_000_000.0, 48_000),
                row_at(now - 20 * day, "C:\\пр\\GnomeCode", "llm-corp", "corp-model-a", 40_000.0, 10_000.0, 0.0, 0.0, 30_000),
                row_at(now - 10 * day, "C:\\пр\\Nord", "zai-coding-plan", "glm-5.3-flash", 1_000_000.0, 500_000.0, 0.0, 500_000.0, 60_000),
                row_at(now - 45 * day, "C:\\пр\\Nord", "zai-coding-plan", "glm-5.3-flash", 2_000_000.0, 0.0, 0.0, 0.0, 15_000),
            ],
        );
        let snapshot = prices(1_765_000_000_000, 0.14);
        let all = summary(&file, "all", Some(&snapshot)).expect("сводка посчиталась");

        assert_eq!(all.models.len(), 3, "деление по моделям: {all:?}");
        let glm = all
            .models
            .iter()
            .find(|one| one.model == "glm-5.3-flash")
            .expect("glm в делении");
        assert_eq!(glm.provider, "zai-coding-plan");
        assert_eq!(
            glm.name.as_deref(),
            Some("Имя zhipuai/glm-5.3-flash"),
            "имя модели — из кэша compare"
        );
        assert!(close(glm.usage.input, 3_500_000.0), "ввод glm: {}", glm.usage.input);
        assert!(
            close(glm.usage.cost.unwrap_or_default(), 0.21 + 0.43 + 0.28),
            "деньги glm по ценам кэша: {:?}",
            glm.usage.cost
        );
        assert_eq!(glm.usage.duration_ms, 12_000 + 60_000 + 15_000);
        let corp = all
            .models
            .iter()
            .find(|one| one.model == "corp-model-a")
            .expect("модель вне каталога в делении");
        assert!(corp.usage.cost.is_none(), "модель без цен — стоимость неизвестна");
        assert!(close(corp.usage.input + corp.usage.output, 50_000.0), "токены без цен считаются");

        let gnome = all
            .projects
            .iter()
            .find(|one| one.path.ends_with("GnomeCode"))
            .expect("проект в делении");
        assert!(gnome.usage.cost_partial, "часть моделей без цен помечена");
        assert!(close(gnome.usage.cost.unwrap_or_default(), 0.21 + 1.40), "известная часть: {:?}", gnome.usage.cost);
        assert_eq!(gnome.usage.duration_ms, 12_000 + 48_000 + 30_000);

        assert!(close(all.totals.input, 3_640_000.0), "итог по вводу: {}", all.totals.input);
        assert!(
            close(all.totals.cost.unwrap_or_default(), 0.21 + 1.40 + 0.43 + 0.28),
            "итог — сумма известных денег: {:?}",
            all.totals.cost
        );
        assert!(all.totals.cost_partial);
        assert_eq!(all.totals.duration_ms, 12_000 + 48_000 + 30_000 + 60_000 + 15_000);
        assert_eq!(all.priced_at, Some(1_765_000_000_000), "дата применённого кэша");
        // Порядок деления: сверху самые прожорливые.
        assert_eq!(all.models[0].model, "glm-5.3-flash");
        let _ = fs::remove_file(&file);
    }

    /// Точное совпадение слагов: полный ид движка, имя модели при другом
    /// провайдере, неоднозначность — «неизвестна», не угадывать.
    #[test]
    fn summary_matches_prices_by_exact_slug() {
        let snapshot = prices(1, 0.14);
        let claude = match_of(&snapshot.models, "anthropic", "claude-sonnet-5-5").expect("полный ид нашёлся");
        assert!(close(claude.input, 2.0));
        let bare = match_of(&snapshot.models, "zai-coding-plan", "glm-5.3-flash")
            .expect("провайдер не равен лабе — цены по имени модели");
        assert!(close(bare.input, 0.14));
        let zero = match_of(&snapshot.models, "openai", "zero").expect("бесплатная модель — цены нулевые");
        assert!(close(zero.input, 0.0) && close(zero.output, 0.0), "ноль — цена, а не «неизвестна»");
        // Не обе цены названы — денег нет, даже если совпадение по имени есть.
        let half = Snapshot {
            fetched_at: 1,
            models: vec![catalog_model("paid/partial", Some(1.0), None, None)],
            stale: false,
        };
        assert!(match_of(&half.models, "openai", "partial").is_none(), "вывод не назван — стоимость неизвестна");
        assert!(match_of(&snapshot.models, "llm-corp", "corp-model-a").is_none(), "модели нет в каталоге");
        assert!(match_of(&snapshot.models, "x", "").is_none(), "пустая модель строки — неизвестна");

        let different = Snapshot {
            fetched_at: 1,
            models: vec![
                catalog_model("lab-a/dual", Some(1.0), Some(2.0), None),
                catalog_model("lab-b/dual", Some(3.0), Some(4.0), None),
            ],
            stale: false,
        };
        assert!(
            match_of(&different.models, "prov", "dual").is_none(),
            "разные цены одинаковых имён — не угадывать"
        );
        let same = Snapshot {
            fetched_at: 1,
            models: vec![
                catalog_model("lab-a/dual", Some(1.0), Some(2.0), None),
                catalog_model("lab-b/dual", Some(1.0), Some(2.0), None),
            ],
            stale: false,
        };
        assert!(
            match_of(&same.models, "prov", "dual").is_some(),
            "одинаковые цены одинаковых имён считаются"
        );
    }

    /// Периоды режут строки по времени; неизвестный период — ошибка команды.
    #[test]
    fn summary_periods_filter_rows() {
        let file = temp_file("periods");
        let day: u64 = 24 * 60 * 60 * 1000;
        let now = unix_ms();
        write_rows(
            &file,
            &[
                row_at(now - 2 * day, "C:\\пр", "lab", "m", 1.0, 0.0, 0.0, 0.0, 0),
                row_at(now - 20 * day, "C:\\пр", "lab", "m", 2.0, 0.0, 0.0, 0.0, 0),
                row_at(now - 45 * day, "C:\\пр", "lab", "m", 4.0, 0.0, 0.0, 0.0, 0),
            ],
        );
        let snapshot = prices(1, 0.0);
        let of = |period: &str| summary(&file, period, Some(&snapshot)).expect("сводка").totals.input;
        assert!(close(of("7"), 1.0), "7 дней: {}", of("7"));
        assert!(close(of("30"), 3.0), "30 дней: {}", of("30"));
        assert!(close(of("all"), 7.0), "всё: {}", of("all"));
        assert!(summary(&file, "вчера", Some(&snapshot)).is_err(), "неизвестный период — ошибка");
        let _ = fs::remove_file(&file);
    }

    /// Пустые и испорченные данные — честный ноль, а не ошибка и не «неизвестно».
    #[test]
    fn summary_empty_and_garbage_is_honest_zero() {
        let missing = temp_file("missing");
        let _ = fs::remove_file(&missing);
        let empty = summary(&missing, "all", None).expect("сводка без файла — ноль");
        assert_eq!(empty.models.len(), 0);
        assert_eq!(empty.projects.len(), 0);
        assert_eq!(empty.totals.input, 0.0);
        assert_eq!(empty.totals.cost, Some(0.0), "пустые данные — честный ноль");
        assert!(!empty.totals.cost_partial);
        assert_eq!(empty.priced_at, None);

        let file = temp_file("garbage");
        fs::write(&file, "мусор без формата\n{\"битый\": json}\n").expect("мусор записан");
        let snapshot = prices(7, 0.14);
        let garbage = summary(&file, "all", Some(&snapshot)).expect("испорченный файл — норма");
        assert_eq!(garbage.totals.cost, Some(0.0));
        assert_eq!(garbage.priced_at, Some(7), "кэш передан — дата известна, строк нет");
        let _ = fs::remove_file(&file);
    }

    /// Свежий кэш цен пересчитывает старые строки: в записи только токены.
    #[test]
    fn summary_fresh_price_cache_recomputes_old_rows() {
        let file = temp_file("recompute");
        write_rows(
            &file,
            &[row_at(unix_ms(), "C:\\пр", "zai-coding-plan", "glm-5.3-flash", 1_000_000.0, 0.0, 0.0, 0.0, 0)],
        );
        let old = summary(&file, "all", Some(&prices(1, 0.14))).expect("старые цены");
        assert!(close(old.totals.cost.unwrap_or_default(), 0.14), "по 0.14: {:?}", old.totals.cost);
        let fresh = summary(&file, "all", Some(&prices(2, 0.28))).expect("свежие цены");
        assert!(close(fresh.totals.cost.unwrap_or_default(), 0.28), "по 0.28: {:?}", fresh.totals.cost);
        assert_eq!(fresh.priced_at, Some(2), "дата цен — дата свежего кэша");
        let _ = fs::remove_file(&file);
    }

    /// Длинная история: тысячи строк сводятся одним вызовом, деления не растут.
    #[test]
    fn summary_counts_thousands_of_rows_in_one_call() {
        let file = temp_file("thousands");
        let now = unix_ms();
        let rows: Vec<Row> = (0..10_000)
            .map(|index| {
                let project = if index % 2 == 0 { "C:\\пр\\Один" } else { "C:\\пр\\Два" };
                row_at(now - index as u64 * 1_000, project, "lab", "m", 100.0, 10.0, 1.0, 5.0, 20)
            })
            .collect();
        write_rows(&file, &rows);
        let all = summary(&file, "all", Some(&prices(1, 0.14))).expect("сводка тысяч строк");
        assert!(close(all.totals.input, 10_000.0 * 100.0), "итог по вводу: {}", all.totals.input);
        assert_eq!(all.models.len(), 1, "одна модель — одна строка деления");
        assert_eq!(all.projects.len(), 2, "два проекта — две строки деления");
        assert_eq!(all.totals.duration_ms, 10_000 * 20);
        let _ = fs::remove_file(&file);
    }
}
