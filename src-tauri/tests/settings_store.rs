//! Хранилище окна настроек (docs/specs/2026-10-06-12-nastrojki.md, «Где снимать»):
//! ключ провайдера в Credential Manager на временной записи сервиса
//! `GnomeCodeTest`, модель по умолчанию переживает переподъём хранилища,
//! секция умолчаний прав пишется и читается, правило плагина старше умолчания.
//!
//! Credential Manager — реальное хранилище ОС: имена записей свои у проверки,
//! данные владельца не трогаются (docs/TESTING.md, «Данные пользователя»).
//! Гоняет `tests/checks/settings_store.py`.

use gnomecode_lib::plugins::rules;
use gnomecode_lib::state::{ChatModel, Store, StatePatch};

/// Сервис записей проверки: окно ходит в `GnomeCode`, проверка — в свой.
const TEST_SERVICE: &str = "GnomeCodeTest";

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-settings-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Имя записи ключа на тест: своё у каждого прогона, чтобы не встречать чужой.
fn scratch_name(name: &str) -> String {
    format!("gnomecode-check-store-{name}-{}", std::process::id())
}

/// Ключ: записан → статус «задан» → удалён → статус «не задан» — тот же ход,
/// что «Задать ключ» → «ключ задан ✓» → «Убрать» на странице настроек.
#[test]
fn key_roundtrip_on_a_scratch_entry() {
    let provider = scratch_name("roundtrip");
    // Чистый старт: записи нет — и это не ошибка («Убрать» дважды).
    providers_scratch_remove(&provider);

    gnomecode_lib::providers::scratch::save(TEST_SERVICE, &provider, "sk-test-123")
        .expect("ключ записан в Credential Manager");
    assert_eq!(
        gnomecode_lib::providers::scratch::status(TEST_SERVICE, &provider).expect("заметка записанного ключа"),
        true,
        "у записи с ключом статус «задан»"
    );

    providers_scratch_remove(&provider);
    assert_eq!(
        gnomecode_lib::providers::scratch::status(TEST_SERVICE, &provider).expect("заметка после удаления"),
        false,
        "после удаления статус «не задан»"
    );
}

/// Убрать ключ во временном сервисе; результат — была ли запись.
fn providers_scratch_remove(provider: &str) {
    gnomecode_lib::providers::scratch::remove(TEST_SERVICE, provider)
        .expect("удаление записи проверки не падает");
}

/// Модель по умолчанию хранится в state.json и переживает переподъём
/// хранилища: новая страница настроек показывает тот же выбор.
#[test]
fn default_model_survives_the_store_reopen() {
    let data = TempDir::new("default-model");
    let file = data.0.join("state.json");
    let store = gnomecode_lib::state::Store::at(file.clone());
    store
        .patch(&StatePatch {
            default_model: Some(ChatModel {
                name: "Claude Sonnet 5.5".to_string(),
                id: "anthropic/claude-sonnet-5-5".to_string(),
            }),
            ..StatePatch::default()
        })
        .expect("модель по умолчанию запомнилась");

    let reopened = Store::at(file);
    let saved = reopened.load();
    let held = saved.default_model.expect("модель по умолчанию пережила переподъём");
    assert_eq!(held.name, "Claude Sonnet 5.5", "строка настроек показывает то же имя");
    assert_eq!(held.id, "anthropic/claude-sonnet-5-5", "запрос новых чатов несёт тот же идентификатор");
}

/// Секция умолчаний прав (`default` в rules.json) пишется и читается: строки
/// вкладки «Плагины» показывают её же, нет секции — умолчание ask.
#[test]
fn defaults_section_writes_and_reads_back() {
    let data = TempDir::new("defaults");
    let file = rules::file(data.0.clone());

    // Секции нет — все категории ask.
    let empty = rules::global_at(&file);
    assert_eq!(empty.get("Write"), None, "секции нет — умолчаний нет");

    rules::set(&file, rules::GLOBAL, "Terminal", "deny").expect("умолчание записано");
    rules::set(&file, rules::GLOBAL, "Read", "allow").expect("второе умолчание записано");

    let held = rules::global_at(&file);
    assert_eq!(held.get("Terminal").map(String::as_str), Some("deny"), "записанное умолчание читается");
    assert_eq!(held.get("Read").map(String::as_str), Some("allow"));
    assert_eq!(held.get("Write").map(String::as_str), None, "категория без записи не завелась");
    // Умолчание чужой секции (правило плагина) не смешивается с секцией default.
    rules::set(&file, "git", "Write", "deny").expect("правило плагина записано");
    let held = rules::global_at(&file);
    assert_eq!(held.get("Write"), None, "правило плагина не попало в секцию умолчаний");
}

/// Правило плагина старше умолчания настроек: своё решает, чужого — секция
/// `default`, нет и её — умолчание ask (спека, «Решено за вас» №8).
#[test]
fn plugin_rule_beats_the_global_default() {
    let data = TempDir::new("order");
    let file = rules::file(data.0.clone());

    rules::set(&file, rules::GLOBAL, "Write", "deny").expect("умолчание Write: deny");
    rules::set(&file, "git", "Write", "allow").expect("своё правило git: allow");

    let held = rules::at(&file);
    assert_eq!(
        rules::resolved(&held, "git", "Write"),
        Some("allow"),
        "своё правило плагина старше умолчания настроек"
    );
    assert_eq!(
        rules::resolved(&held, "docs", "Write"),
        Some("deny"),
        "правила плагина нет — решает секция умолчаний настроек"
    );
    assert_eq!(
        rules::resolved(&held, "docs", "Network"),
        None,
        "ни правила, ни умолчания — умолчание ask"
    );
}
