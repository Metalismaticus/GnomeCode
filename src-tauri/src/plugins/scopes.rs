//! Скоупы подключения плагинов (docs/SPEC/plugins.md, сцена E): Once, этот чат,
//! этот проект, глобально.
//!
//! Файл — `plugin_scopes.json` в папке данных, отдельно от реестра установленного
//! (узор rules.rs): «этот чат» живёт в реестре окна и перезапуск его теряет — так
//! и должно быть, прокси «нового чата» здесь перезапуск; повышающие скоупы
//! («проект», «глобально») обязаны вернуть кнопки во всех новых чатах — их помнит
//! файл. «Once» файла не заслуживает: снимается после следующего вопроса.
//!
//! Отсутствие файла — норма: скоупов нет, подключает только реестр чата.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use super::install;

const SCOPES_NAME: &str = "plugin_scopes.json";

/// Повышающие скоупы, которые помнятся на диске: проектные — по папке проекта,
/// глобальные — без папки.
#[derive(Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Scopes {
    #[serde(default)]
    pub project: BTreeMap<String, Vec<String>>,
    #[serde(default)]
    pub global: Vec<String>,
}

/// Файл скоупов в папке данных: путь собирает `install::data_file`, имя — одно здесь.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, SCOPES_NAME)
}

/// Скоупы из файла: испорченный или потерянный — пустые, как у реестра установленного.
pub fn at(file: &Path) -> Scopes {
    fs::read(file)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Scopes>(&bytes).ok())
        .unwrap_or_default()
}

/// Записать скоуп подключения: kind — «project» (для корня root) или «global»
/// сохраняют в файл; «chat» и «once» файл не касаются, но повышенный скоуп
/// снимают — выбор строки в полосе скоупов это откат, а не ещё одна запись.
pub fn set(file: &Path, kind: &str, root: Option<&str>, id: &str) -> Result<(), String> {
    let mut held = at(file);
    match kind {
        "project" => {
            let root = root.ok_or("папки проекта нет — скоуп проекта не помнится")?;
            let list = held.project.entry(root.to_string()).or_default();
            if !list.iter().any(|known| known == id) {
                list.push(id.to_string());
            }
        }
        "global" => {
            if !held.global.iter().any(|known| known == id) {
                held.global.push(id.to_string());
            }
        }
        // «Этот чат» и «Once» — скоупы памяти окна: в файле только снять.
        _ => {
            for list in held.project.values_mut() {
                list.retain(|known| known != id);
            }
            held.project.retain(|_, list| !list.is_empty());
            held.global.retain(|known| known != id);
        }
    }
    let json = serde_json::to_string_pretty(&held)
        .map_err(|e| format!("скоупы не собрались в JSON: {e}"))?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file, json).map_err(|e| format!("скоупы не записаны {}: {e}", file.display()))
}

/// Список подключения чата: реестр окна плюс скоупы, минус снятые с чата
/// (opt-out — память окна: скоуп не возвращает кнопки снятому плагину, пока
/// окно не перезапустилось). Порядок — как подключали: реестр, потом скоупы.
pub fn connected_for(connected: &[String], opt_out: &[String], scoped: &[String]) -> Vec<String> {
    let mut list: Vec<String> = Vec::new();
    for id in connected.iter().chain(scoped.iter()) {
        if opt_out.iter().any(|known| known == id) || list.iter().any(|known| known == id) {
            continue;
        }
        list.push(id.clone());
    }
    list
}

/// Скоуп подключения плагина к этому чату: Once — до конца запроса, «chat» —
/// реестр окна, «project» и «global» — из файла. Один плагин — один скоуп, поэтому
/// порядок приоритета: once, chat, project, global.
pub fn scope_of(
    once: &[String],
    chat: &[String],
    project: &[String],
    global: &[String],
    id: &str,
) -> Option<String> {
    if once.iter().any(|known| known == id) {
        Some("once".to_string())
    } else if chat.iter().any(|known| known == id) {
        Some("chat".to_string())
    } else if project.iter().any(|known| known == id) {
        Some("project".to_string())
    } else if global.iter().any(|known| known == id) {
        Some("global".to_string())
    } else {
        None
    }
}
