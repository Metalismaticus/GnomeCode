//! Tool Sets (docs/SPEC/phase2.md, раздел 11): сохранённые группы плагинов —
//! «Godot Dev» = Godot + GitHub + Playlist. Подключение сета одним пунктом
//! меню раскладывается на подключения одиночных плагинов со скоупом
//! ([`super::commands`]); здесь только хранение групп.
//!
//! Файл — `toolsets.json` в папке данных, отдельный от скоупов и реестра
//! (узор rules.rs): сет — личная запись владельца, её не смешивают ни со
//! «снопом подключения» (plugin_scopes.json), ни с установкой (installed.json).
//! Отсутствие файла или имени — норма: сетов нет, создаётся из подключённого.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::install;

const SETS_NAME: &str = "toolsets.json";

/// Что помнит файл: `имя сета → id плагинов в порядке их подключения`.
pub type Sets = BTreeMap<String, Vec<String>>;

/// Имя сета с его плагинами — то, что показывает окно списка.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ToolSet {
    pub name: String,
    pub ids: Vec<String>,
}

/// Файл сетов в папке данных: путь собирает `install::data_file`, имя — одно здесь.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, SETS_NAME)
}

/// Сеты из файла: испорченный или потерянный — пустые, как у скоупов (scopes.rs).
pub fn at(file_path: &Path) -> Sets {
    fs::read(file_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Sets>(&bytes).ok())
        .unwrap_or_default()
}

/// Записать сет (или убрать пустым списком — так его удаляет окно списка):
/// чтение, подмена своего, запись.
pub fn set(file_path: &Path, name: &str, ids: &[String]) -> Result<(), String> {
    let mut sets = at(file_path);
    if ids.is_empty() {
        sets.remove(name);
    } else {
        sets.insert(name.to_string(), ids.to_vec());
    }
    let json = serde_json::to_string_pretty(&sets)
        .map_err(|e| format!("сеты не собрались в JSON: {e}"))?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file_path, json)
        .map_err(|e| format!("сеты не записаны {}: {e}", file_path.display()))
}

/// Сеты списком пар имя → id — так их читает окно списка (порядок имени).
pub fn pairs(sets: &Sets) -> Vec<ToolSet> {
    sets.iter()
        .map(|(name, ids)| ToolSet {
            name: name.clone(),
            ids: ids.clone(),
        })
        .collect()
}
