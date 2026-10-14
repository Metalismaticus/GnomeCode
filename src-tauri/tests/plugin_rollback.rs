//! Кэш артефактов версий и откат в клик (CE-3, T3/ET2): установка и обновление
//! запоминают версии (декларация + артефакт + sha256-при-получении), откат
//! возвращает файл с проверкой хэша и восстанавливает декларацию целиком —
//! права той версии, не только номер (1.3). Версии до кэша и битый кэш —
//! честный отказ (CE-5).

mod common;

use gnomecode_lib::plugins::install::{self};
use gnomecode_lib::plugins::updates;
use gnomecode_lib::plugins::vcache;

use common::{FakeGithub, TempDir};

const INDEX: &str = r#"[
 {
    "id": "github",
    "name": "GitHub",
    "description": "Repository, issues, pull requests",
    "author": "Metalismaticus",
    "version": "1.4.2",
    "repo": "Metalismaticus/github-plugin",
    "entry": "index.ts",
    "permissions": [
     { "category": "Network", "value": "api.github.com" },
     { "category": "Write", "value": "ask" }
    ],
    "commands": [{ "name": "issues", "description": "list issues" }]
  }
]"#;

/// Новее, прав стало меньше: обновление едет тихо (T2) — и 1.4.2 остаётся в кэше.
const INDEX_FEWER: &str = r#"[
 {
    "id": "github",
    "name": "GitHub",
    "description": "Repository, issues, pull requests",
    "author": "Metalismaticus",
    "version": "1.5.0",
    "repo": "Metalismaticus/github-plugin",
    "entry": "index.ts",
    "permissions": [
     { "category": "Network", "value": "api.github.com" }
    ],
    "commands": [{ "name": "issues", "description": "list issues" }]
  }
]"#;

const PLUGIN_SRC: &str = "export default {\n  id: \"github\",\n  async setup() {\n    return {}\n  }\n}\n";
const PLUGIN_SRC_NEXT: &str = "export default {\n  id: \"github\",\n  async setup() {\n    return { next: true }\n  }\n}\n";

/// Установка и обновление запоминают версии: обе декларации с артефактами и
/// хэшами лежат в кэше — откат в клик знает, куда возвращать.
#[test]
fn install_and_update_remember_versions_in_the_cache() {
    let fake = FakeGithub::start(&[INDEX, INDEX_FEWER], &[PLUGIN_SRC, PLUGIN_SRC_NEXT]);
    let plugins = TempDir::new("vcache-plugins");
    let data = TempDir::new("vcache-data");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");
    let cache = vcache::file(data.path().clone());

    let found = install::fetch(&fake.index_url()).expect("индекс прочитан");
    install::install(&found[0], fake.base(), plugins.path(), &registry, &cache)
        .expect("плагин установлен");
    assert!(vcache::has(&cache, "github", "1.4.2"), "версия установки в кэше");

    updates::check_and_update(&fake.index_url(), plugins.path(), &registry, &file, &cache)
        .expect("проверка обновлений прошла");
    assert!(vcache::has(&cache, "github", "1.5.0"), "версия обновления в кэше");

    let held = vcache::get(&cache, "github", "1.4.2").expect("старая версия читается");
    assert_eq!(held.entry.version, "1.4.2", "декларация той поры");
    assert_eq!(held.entry.permissions.len(), 2, "права версии — два (1.3)");
    assert_eq!(held.content, PLUGIN_SRC, "артефакт версии");
    assert_eq!(
        held.sha256,
        vcache::sha256_hex(PLUGIN_SRC.as_bytes()),
        "хэш зафиксирован при получении"
    );
}

/// Откат на кэшированную версию: файл прежнего содержимого, реестр — прежняя
/// версия с прежними правами (1.3), хотя обновлённая запись их уже убрала.
#[test]
fn rollback_restores_the_file_and_the_whole_declaration() {
    let fake = FakeGithub::start(&[INDEX, INDEX_FEWER], &[PLUGIN_SRC, PLUGIN_SRC_NEXT]);
    let plugins = TempDir::new("rollback-plugins");
    let data = TempDir::new("rollback-data");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");
    let cache = vcache::file(data.path().clone());

    let found = install::fetch(&fake.index_url()).expect("индекс прочитан");
    install::install(&found[0], fake.base(), plugins.path(), &registry, &cache)
        .expect("плагин установлен");
    updates::check_and_update(&fake.index_url(), plugins.path(), &registry, &file, &cache)
        .expect("обновление до 1.5.0 прошло тихо");

    updates::rollback_to("github", "1.4.2", plugins.path(), &registry, &cache)
        .expect("откат на кэшированную версию прошёл");

    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл на месте");
    assert_eq!(written, PLUGIN_SRC, "артефакт прежней версии восстановлен");
    let held = install::records(&registry);
    let entry = held.get("github").expect("запись реестра на месте");
    assert_eq!(entry.version, "1.4.2", "версия в реестре — та, на которую откатились");
    assert_eq!(
        entry.permissions.len(),
        2,
        "права той версии вернулись (1.3): {:?}",
        entry.permissions
    );
}

/// Версии нет в кэше — откат невозможен: установка до кэша GnomeCode.
#[test]
fn rollback_without_a_cached_version_refuses() {
    let fake = FakeGithub::start(&[INDEX], &[PLUGIN_SRC]);
    let plugins = TempDir::new("rollback-miss-plugins");
    let data = TempDir::new("rollback-miss-data");
    let registry = data.join("installed.json");
    let cache = vcache::file(data.path().clone());

    let found = install::fetch(&fake.index_url()).expect("индекс прочитан");
    install::install(&found[0], fake.base(), plugins.path(), &registry, &cache)
        .expect("плагин установлен");

    let reason = updates::rollback_to("github", "0.9.0", plugins.path(), &registry, &cache)
        .expect_err("версии до кэша откатываться нечему");
    assert!(
        reason.contains("нет в кэше") && reason.contains("до кэша"),
        "причина называет и версию, и границу кэша: {reason}"
    );
}

/// Битый кэш (хэш записи не сходится с содержимым) — откат отменяется:
/// CE-3 закрывает целостность и у собственных запасов, не только каталога.
#[test]
fn a_corrupted_cache_entry_refuses_the_rollback() {
    let fake = FakeGithub::start(&[INDEX], &[PLUGIN_SRC]);
    let plugins = TempDir::new("rollback-corrupt-plugins");
    let data = TempDir::new("rollback-corrupt-data");
    let registry = data.join("installed.json");
    let cache = vcache::file(data.path().clone());

    let found = install::fetch(&fake.index_url()).expect("индекс прочитан");
    install::install(&found[0], fake.base(), plugins.path(), &registry, &cache)
        .expect("плагин установлен");

    // Подмена содержимого записи при прежнем хэше: кэш повреждён.
    let mut held = vcache::at(&cache);
    let mut record = held.remove("github@1.4.2").expect("запись кэша на месте");
    record.content = "подменённый артефакт".to_string();
    held.insert("github@1.4.2".to_string(), record);
    vcache::save(&cache, &held).expect("испорченный кэш записан");

    let reason = updates::rollback_to("github", "1.4.2", plugins.path(), &registry, &cache)
        .expect_err("хэш не сошёлся — откат отменён");
    assert!(reason.contains("хэш"), "отказ называет целостность: {reason}");
    // Файл установки не перезаписан битым кэшем — откат отказал до записи.
    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл на месте");
    assert_eq!(written, PLUGIN_SRC, "отказавший откат файл не трогал");
}
