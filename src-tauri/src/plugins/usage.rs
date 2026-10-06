//! Usage плагинов (docs/BATCH.md, пункт 8; docs/SPEC/plugins.md, сцена J —
//! «Системы Usage и Audit фиксируют, какой плагин сгенерировал каждый вызов»):
//! `usage.json` в папке данных помнит `id → {count, last}` — сколько исполненных
//! вызовов было у плагина и когда был последний (unix-миллисекунды; формат для
//! человека делает фронт). Отказ («denied», «requires approval») вызовом не был
//! — счётчик его не увеличивает, а строку отказа в ленте считают не отсюда;
//! атрибут «плагин» у неё остаётся — детали отказа открываются (plugin_decide,
//! plugin_run: запись ставится только после ухода команды движку).
//!
//! Файл — себе отдельный, не поле installed.json: переустановка перетёрла бы
//! счёт (тот же порядок, что rules.json и updates.json). Экспорт аудита — Этап
//! 2 дальше («Не входит» docs/BATCH.md): пока Usage — счётчик карточки.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::install;
use super::model::Usage;

const USAGE_NAME: &str = "usage.json";

/// Файл счётчиков в папке данных: путь собирает `install::data_file`, имя — одно здесь.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, USAGE_NAME)
}

/// Что usage.json помнит: `id плагина → счётчик`.
pub type Counts = BTreeMap<String, Usage>;

/// Счётчики из файла: испорченный или потерянный — пустые, как у правил (rules.rs).
pub fn at(file_path: &Path) -> Counts {
    fs::read(file_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Counts>(&bytes).ok())
        .unwrap_or_default()
}

/// Отметить исполненный вызов плагина: чтение, прибавка, запись. Ошибки записи
/// здесь не возвращаются: счётчик — заметка о работе, а не политика, и не
/// состоявшийся из-за него вызов был бы хуже; места вызова (commands.rs) это
/// знают и держат по одной строке.
pub fn record(file_path: &Path, plugin: &str) {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|span| span.as_millis() as u64)
        .unwrap_or(0);
    let mut counts = at(file_path);
    let entry = counts
        .entry(plugin.to_string())
        .or_insert(Usage { count: 0, last: 0 });
    entry.count += 1;
    entry.last = now;
    let json = match serde_json::to_string_pretty(&counts) {
        Ok(json) => json,
        Err(_) => return, // счётчик не собрался в JSON — исполненному вызову не мешает
    };
    if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::write(file_path, json);
}
