//! Правила категорий плагина (src-tauri/src/plugins/rules.rs): `rules.json` в папке
//! данных пишется и читается, решение по вызову — deny старше гранта чата, нет
//! правила — ask (docs/BATCH.md, пункт 3; docs/SPEC/plugins.md, «Утверждённый UX
//! одобрения» — denied-категории не спрашиваются никогда). Проверки на временных
//! папках — данных владельца не касаются.

use gnomecode_lib::plugins::rules::{self, Decision};

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-rules-{}-{name}", std::process::id()));
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
fn rules_json_writes_and_reads_back() {
    let data = TempDir::new("data");
    let file = rules::file(data.0.clone());

    rules::set(&file, "git", "Write", "deny").expect("правило записано");
    rules::set(&file, "git", "Network", "allow").expect("второе правило записано");
    rules::set(&file, "git", "Write", "allow").expect("правило переписано");

    let read = rules::at(&file);
    assert_eq!(rules::value_of(&read, "git", "Write"), Some("allow"), "последняя правка правила побеждает");
    assert_eq!(rules::value_of(&read, "git", "Network"), Some("allow"), "второе правило на месте");
    assert_eq!(rules::value_of(&read, "docs", "Write"), None, "правило чужого плагина не завелось");
}

#[test]
fn missing_rules_file_reads_as_empty() {
    let data = TempDir::new("data-missing");
    let read = rules::at(&rules::file(data.0.clone()));
    assert_eq!(rules::value_of(&read, "git", "Write"), None, "нет файла — правил нет, умолчание ask");
}

#[test]
fn deny_beats_the_chat_grant() {
    assert_eq!(rules::decide(Some("deny"), true), Decision::Deny, "denied-категории не спрашиваются никогда — грант чата не спасает");
    assert_eq!(rules::decide(Some("deny"), false), Decision::Deny);
}

#[test]
fn no_rule_asks_by_default() {
    assert_eq!(rules::decide(None, false), Decision::Ask, "правила нет — умолчание ask");
    assert_eq!(rules::decide(Some("ask"), false), Decision::Ask, "правило ask — окно одобрения");
}

#[test]
fn allow_and_the_chat_grant_run_silently() {
    assert_eq!(rules::decide(Some("allow"), false), Decision::Run, "allow исполняет молча");
    assert_eq!(rules::decide(None, true), Decision::Run, "грант чата исполняет молча");
}
