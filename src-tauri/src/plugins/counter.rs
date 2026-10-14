//! Событийный счётчик (П-3, 3.2): локальный JSONL в папке данных — данные для
//! проверки предпосылки №1 (plugin-lifecycle против chat-сессий). Opt-in в
//! Настройках, без сети: файл пишет только это окно, наружу ничего не уходит.
//!
//! События: install, update, rollback, enable, disable, command (исполненные
//! вызовы), chat-session (старт окна с чатом). Формат строки: JSON с ts и
//! именем события, у жизненного цикла — id плагина. Выключен — record тихий
//! ноль: ни файла, ни строк.

use std::fs;
use std::path::{Path, PathBuf};

use serde_json::json;

use super::install;

/// Имя файла счётчика и маркера согласия: оба в папке данных.
const FILE_NAME: &str = "events.jsonl";
const OPTIN_NAME: &str = "events.optin";

/// Файл счётчика в папке данных.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, FILE_NAME)
}

/// Файл-маркер согласия: есть — счётчик пишет, нет — молчит.
fn optin_file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, OPTIN_NAME)
}

/// Включить счётчик (opt-in в Настройках): пустой маркер-файл.
pub fn opt_in(fallback: PathBuf) -> Result<(), String> {
    let marker = optin_file(fallback);
    if let Some(parent) = marker.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(&marker, "").map_err(|e| format!("маркер согласия не записан {}: {e}", marker.display()))
}

/// Выключить счётчик: маркер уходит, строки больше не пишутся (файл событий
/// остаётся — данные владельца, удалять их без просьбы не будем).
pub fn opt_out(fallback: PathBuf) -> Result<(), String> {
    let marker = optin_file(fallback);
    match fs::remove_file(&marker) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("маркер согласия не убран {}: {e}", marker.display())),
    }
}

/// Включён ли счётчик: состояние тумблера Настроек.
pub fn is_opted_in(fallback: PathBuf) -> bool {
    optin_file(fallback).is_file()
}

/// Записать событие, если счётчик включён: одна строка JSON в конец файла
/// (append — прежние события не читаем и не переписываем). Сбой — тихий:
/// счётчик не должен ломать жизненный цикл плагинов.
pub fn record(file_path: &Path, event: &str, plugin: Option<&str>) {
    if !is_opted_in(
        file_path
            .parent()
            .map(|parent| parent.to_path_buf())
            .unwrap_or_default(),
    ) {
        return;
    }
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default();
    let line = match plugin {
        Some(id) => json!({ "ts": ts, "event": event, "plugin": id }),
        None => json!({ "ts": ts, "event": event }),
    };
    let Ok(line) = serde_json::to_string(&line) else {
        return;
    };
    if let Some(parent) = file_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut held) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(file_path)
    {
        use std::io::Write;
        let _ = writeln!(held, "{line}");
    }
}

#[cfg(test)]
mod tests {
    use super::{file, is_opted_in, opt_in, opt_out, record};
    use std::path::PathBuf;

    struct TempDir(std::path::PathBuf);

    impl TempDir {
        fn new(name: &str) -> TempDir {
            let path = std::env::temp_dir().join(format!("gnomecode-counter-{}-{name}", std::process::id()));
            std::fs::create_dir_all(&path).expect("временная папка создана");
            TempDir(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Opt-in выключен — записи нет; включили — строки пишутся с именем события
    /// и плагином; выключили — снова тишина (3.2: opt-in в Настройках).
    #[test]
    fn records_only_after_opt_in() {
        let data = TempDir::new("counter");
        let events = file(data.0.clone());

        record(&events, "install", Some("github"));
        assert!(!events.is_file(), "без opt-in файла событий нет");

        opt_in(data.0.clone()).expect("opt-in включён");
        assert!(is_opted_in(data.0.clone()), "маркер согласия на месте");
        record(&events, "install", Some("github"));
        record(&events, "chat-session", None);

        let text = std::fs::read_to_string(&events).expect("файл событий записан");
        let lines: Vec<&str> = text.lines().collect();
        assert_eq!(lines.len(), 2, "два события — две строки: {text}");
        assert!(lines[0].contains("\"install\"") && lines[0].contains("\"github\""));
        assert!(lines[1].contains("\"chat-session\""), "событие без плагина — тоже строка");

        opt_out(data.0.clone()).expect("opt-out сработал");
        assert!(!is_opted_in(data.0.clone()), "маркер снят");
        record(&events, "enable", Some("docs"));
        let text = std::fs::read_to_string(&events).expect("файл на месте");
        assert_eq!(text.lines().count(), 2, "после opt-out новых строк нет");

        // Повторный opt-out — не ошибка («Убрать» дважды).
        opt_out(data.0.clone()).expect("повторный opt-out спокоен");
    }
}
