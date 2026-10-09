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
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

use crate::opencode::client::ServerEvent;
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
#[derive(Debug, Clone, PartialEq, Serialize)]
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
