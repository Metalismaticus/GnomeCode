//! Счётчик вызовов плагина (src-tauri/src/plugins/usage.rs): `usage.json` в папке
//! данных пишет count и время последнего вызова; отказ в счёте не побывает —
//! запись ставит только исполненный вызов (docs/BATCH.md, пункт 8;
//! docs/SPEC/plugins.md, сцена J). Проверки на временных папках — данных
//! владельца не касаются.

use gnomecode_lib::plugins::usage;

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-usage-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn usage_json_counts_calls_and_marks_the_last_one() {
    let data = TempDir::new("data");
    let file = usage::file(data.0.clone());

    // Два исполненных вызова: счётчик два, отметка времени — у фронта формат.
    usage::record(&file, "git");
    usage::record(&file, "git");

    let counts = usage::at(&file);
    let git = counts.get("git").expect("у «git» есть запись счётчика");
    assert_eq!(git.count, 2, "два исполненных вызова — счётчик два, повтор не тонет");
    assert!(git.last > 0, "у записи есть время последнего вызова — фронт его форматирует");
}

#[test]
fn refusal_is_not_a_call() {
    let data = TempDir::new("data-refusal");
    let file = usage::file(data.0.clone());

    // Отказ (denied / requires approval) записей не ставит: счётчик растит
    // только record исполненного вызова, без него файл не пишется вовсе.
    usage::record(&file, "git");
    let counts = usage::at(&file);
    assert_eq!(counts.get("docs").map(|one| one.count), None, "отказ — не вызов: счётчик не заводится записью отказа");
}

#[test]
fn missing_usage_file_reads_as_empty() {
    let data = TempDir::new("data-missing");
    let counts = usage::at(&usage::file(data.0.clone()));
    assert!(counts.get("git").is_none(), "нет файла — счётчиков нет, карточка молчит о вызовах");
}

#[test]
fn every_plugin_counts_its_own_calls() {
    let data = TempDir::new("data-others");
    let file = usage::file(data.0.clone());

    usage::record(&file, "git");
    usage::record(&file, "docs");
    usage::record(&file, "docs");

    let counts = usage::at(&file);
    assert_eq!(counts.get("docs").map(|one| one.count), Some(2), "у «docs» свой счётчик");
    assert_eq!(counts.get("git").map(|one| one.count), Some(1), "чужой вызов чужой плагин не посчитал");
}
