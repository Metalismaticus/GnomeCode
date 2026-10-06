//! Автообновление плагинов при запуске (docs/BATCH.md, пункт 4): индекс каталога
//! новее реестра установленного — версия обновляется сама, права не менялись;
//! права изменились — сводка до включения (docs/SPEC/plugins.md, сцена K), файл
//! плагина не трогается. Худшие ветки: каталог не отвечает — записи целы и есть
//! пометка; плагина нет в индексе — пропуск с пометкой. Окна при запуске нет:
//! проверка при старте — фоновый поток, поэтому вопросов фоновая работа не задаёт.
//!
//! Фейковый raw.githubusercontent — tests/common/mod.rs: настоящий сокет, как у
//! живого GitHub. Зонд обновления со сломанным файлом — живой движок: он читает
//! плагины только при старте, «failed to load» журнала — признак сломанного
//! обновления (откат на запасной файл, прежняя версия в реестре, пометка).

mod common;

use std::net::TcpListener;

use gnomecode_lib::opencode::engine::Engine;
use gnomecode_lib::plugins::install;
use gnomecode_lib::plugins::updates;

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

/// Тот же плагин, версия новее, права те же: тихое обновление без вопросов.
const INDEX_NEXT: &str = r#"[
  {
    "id": "github",
    "name": "GitHub",
    "description": "Repository, issues, pull requests",
    "author": "Metalismaticus",
    "version": "1.5.0",
    "repo": "Metalismaticus/github-plugin",
    "entry": "index.ts",
    "permissions": [
      { "category": "Network", "value": "api.github.com" },
      { "category": "Write", "value": "ask" }
    ],
    "commands": [{ "name": "issues", "description": "list issues" }]
  }
]"#;

/// Версия новее, но права изменились: появляется новая категория — до включения
/// нужна сводка прав, файл прежней версии не заменяется.
const INDEX_PERMS: &str = r#"[
  {
    "id": "github",
    "name": "GitHub",
    "description": "Repository, issues, pull requests",
    "author": "Metalismaticus",
    "version": "1.5.0",
    "repo": "Metalismaticus/github-plugin",
    "entry": "index.ts",
    "permissions": [
      { "category": "Network", "value": "api.github.com" },
      { "category": "Write", "value": "ask" },
      { "category": "Terminal", "value": "ask" }
    ],
    "commands": [{ "name": "issues", "description": "list issues" }]
  }
]"#;

const PLUGIN_SRC: &str = "export default {\n  id: \"github\",\n  async setup() {\n    return {}\n  },\n}\n";

/// Файл новой версии: другой контент — тихое обновление видно по файлу.
const PLUGIN_SRC_NEXT: &str = "export default {\n  id: \"github\",\n  async setup() {\n    return { next: true }\n  },\n}\n";

/// Сломанный файл новой версии: движок его не загрузит.
const PLUGIN_BROKEN: &str = "модуль, который движок не прочитаёт";

#[test]
fn newer_is_a_comparison_of_the_versions() {
    // «Новее» — версии различаются: semver-парсер не заводится, индекс пишет владелец.
    assert!(updates::newer("1.4.2", "1.5.0"), "версия каталога новее — обновление");
    assert!(!updates::newer("1.5.0", "1.5.0"), "та же версия — обновления нет");
}

/// Тихое обновление: версии различаются, права те же — файл заменён молча,
/// реестр записал новую версию, помечено «обновлено», вопросов не задано.
#[test]
fn check_updates_the_plugin_silently_when_permissions_unchanged() {
    let fake = FakeGithub::start(&[INDEX, INDEX_NEXT], &[PLUGIN_SRC, PLUGIN_SRC_NEXT]);
    let plugins = TempDir::new("updates-plugins");
    let data = TempDir::new("updates-data");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");

    let found = install::fetch(&fake.index_url()).expect("индекс каталога прочитан");
    install::install(&found[0], fake.base(), plugins.path(), &registry)
        .expect("плагин установлен: реестр и файл на месте до проверки");

    let checked = updates::check_and_update(&fake.index_url(), plugins.path(), &registry, &file)
        .expect("проверка обновлений прошла");

    assert_eq!(checked.applied, vec!["github"], "обновилось молча: {:?}", checked.applied);
    // Файл — новой версии: замена видна по содержимому, не по времени.
    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл плагина на месте");
    assert_eq!(
        written, PLUGIN_SRC_NEXT,
        "файл не заменён новой версией — то, что движок прочтёт при рестарте"
    );
    let record = std::fs::read_to_string(&registry).expect("реестр установленного записан");
    assert!(
        record.contains("\"1.5.0\"") && !record.contains("1.4.2"),
        "реестр записал новую версию, старой рядом нет: {record}"
    );
    let notes = updates::at(&file);
    let note = notes.records.get("github").expect("запись об обновлении в updates.json");
    assert_eq!(note.from, "1.4.2", "запись: была версия — {note:?}");
    assert_eq!(note.to, "1.5.0", "запись: стала версия — {note:?}");
    assert!(
        note.status == updates::UpdateStatus::Applied,
        "обновилось молча — пометка «обновлено», окно одобрения не открывалось: {note:?}"
    );
    assert!(notes.catalog.is_none(), "каталог отвечал — пометки о недоступности нет");
    assert!(note.permissions.is_empty(), "права не менялись — сводки не ждут: {note:?}");
}

/// Права изменились: сводка прав до включения (сцена K) — файл предыдущей версии
/// не заменяется, реестр не трогается, запись ждёт решения о новых правах.
#[test]
fn changed_permissions_hold_the_update_until_the_summary() {
    let fake = FakeGithub::start(&[INDEX, INDEX_PERMS], &[PLUGIN_SRC, PLUGIN_SRC]);
    let plugins = TempDir::new("updates-hold-plugins");
    let data = TempDir::new("updates-hold-data");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");

    let found = install::fetch(&fake.index_url()).expect("индекс каталога прочитан");
    install::install(&found[0], fake.base(), plugins.path(), &registry)
        .expect("плагин установлен до проверки");

    let checked = updates::check_and_update(&fake.index_url(), plugins.path(), &registry, &file)
        .expect("проверка обновлений прошла");

    assert!(checked.applied.is_empty(), "обновление держится до сводки прав: {:?}", checked.applied);
    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл плагина на месте");
    assert_eq!(
        written, PLUGIN_SRC,
        "файл заменён без разрешения владельца — обновление с новыми правами держится"
    );
    let record = std::fs::read_to_string(&registry).expect("реестр установленного записан");
    assert!(
        record.contains("\"1.4.2\"") && !record.contains("1.5.0"),
        "реестр остался на прежней версии: {record}"
    );
    let notes = updates::at(&file);
    let note = notes.records.get("github").expect("запись об обновлении в updates.json");
    assert!(
        note.status == updates::UpdateStatus::Held,
        "права изменились — ждёт прав: {note:?}"
    );
    assert_eq!(note.permissions, vec!["Network: api.github.com", "Write: ask", "Terminal: ask"],
        "новые права — для сводки до включения: {note:?}");
}

/// Каталог недоступен: работаем на текущих, файлы нетронуты, пометка в разделе.
#[test]
fn an_unavailable_catalog_leaves_everything_and_is_marked() {
    // Настоящий мёртвый порт: слушатель займи и отпусти — соединение отклонится.
    let probe = TcpListener::bind("127.0.0.1:0").expect("порт занят и отпущен");
    let dead = probe.local_addr().expect("адрес мёртвого порта");
    drop(probe);
    let plugins = TempDir::new("updates-dead-plugins");
    let data = TempDir::new("updates-dead-data");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");
    std::fs::write(plugins.join("github.ts"), PLUGIN_SRC).expect("файл плагина заранее на месте");
    let record = r#"{"github":{"id":"github","name":"GitHub","description":"d","author":"a","version":"1.4.2","repo":"Metalismaticus/github-plugin","entry":"index.ts","permissions":[],"commands":[],"disabled":false}}"#;
    std::fs::write(&registry, format!("{{\"github\":{record}}}")).expect("реестр установленного на месте");

    let checked = updates::check_and_update(
        &format!("http://{dead}/Metalismaticus/gnomecode-catalog/main/index.json"),
        plugins.path(),
        &registry,
        &file,
    )
    .expect("недоступный каталог — не сбой: работаем на текущих");

    assert!(checked.applied.is_empty(), "обновлений без каталога не быть: {:?}", checked.applied);
    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл плагина на месте");
    assert_eq!(written, PLUGIN_SRC, "файл тронут при недоступном каталоге — не остаётся на текущей версии");
    let record = std::fs::read_to_string(&registry).expect("реестр установленного на месте");
    assert!(record.contains("\"1.4.2\""), "реестр тронут при недоступном каталоге: {record}");
    let notes = updates::at(&file);
    assert!(
        notes.catalog.is_some(),
        "в разделе остаётся пометка, что каталог недоступен: {notes:?}"
    );
}

/// Плагина нет в каталоге: пропуск с пометкой — файл и реестр не трогаются.
#[test]
fn a_missing_catalog_entry_is_skipped_with_a_note() {
    let fake = FakeGithub::start(&["[]"], &[PLUGIN_SRC]);
    let plugins = TempDir::new("updates-outside-plugins");
    let data = TempDir::new("updates-outside-data");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");
    std::fs::write(plugins.join("github.ts"), PLUGIN_SRC).expect("файл плагина заранее на месте");
    let record = r#"{"id":"github","name":"GitHub","description":"d","author":"a","version":"1.4.2","repo":"Metalismaticus/github-plugin","entry":"index.ts","permissions":[],"commands":[],"disabled":false}"#;
    std::fs::write(&registry, format!(r#"{{"github":{record}}}"#)).expect("реестр установленного на месте");

    let checked = updates::check_and_update(&fake.index_url(), plugins.path(), &registry, &file)
        .expect("пустой каталог — не сбой");

    assert!(checked.applied.is_empty(), "вне каталога обновить нечем: {:?}", checked.applied);
    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл плагина на месте");
    assert_eq!(written, PLUGIN_SRC, "файл тронут у плагина вне каталога");
    let notes = updates::at(&file);
    let note = notes.records.get("github").expect("пропуск с пометкой в updates.json");
    assert!(
        note.status == updates::UpdateStatus::Outside,
        "плагина нет в каталоге — пометка «вне каталога»: {note:?}"
    );
}

/// Обновление сломало плагин: движок не загрузил новый файл — остаётся
/// предыдущая версия, в updates.json пометка «сломано» (крайний случай пункта 4).
#[test]
fn a_broken_update_is_rolled_back_and_marked() {
    let fake = FakeGithub::start(&[INDEX, INDEX_NEXT], &[PLUGIN_SRC, PLUGIN_BROKEN]);
    // Дом и данные движка — во временную папку: журнал и плагины проверки
    // пишут на своё место, данные владельца не задеты.
    let home = TempDir::new("updates-broken-home");
    let data = TempDir::new("updates-broken-data");
    std::fs::create_dir_all(data.path().join("xdg-data")).expect("папка данных движка создана");
    std::env::set_var("USERPROFILE", home.path());
    std::env::set_var("XDG_DATA_HOME", data.path().join("xdg-data"));
    std::env::set_var("XDG_CONFIG_HOME", home.path().join(".config"));

    let plugins = install::plugins_dir();
    std::fs::create_dir_all(&plugins).expect("папка плагинов движка создана");
    let registry = data.join("installed.json");
    let file = data.join("updates.json");
    let found = install::fetch(&fake.index_url()).expect("индекс каталога прочитан");
    install::install(&found[0], fake.base(), &plugins, &registry).expect("плагин установлен");

    let checked = updates::check_and_update(&fake.index_url(), &plugins, &registry, &file)
        .expect("проверка обновлений прошла");
    assert_eq!(checked.applied, vec!["github"], "сломанный файл записан как тихое обновление");

    let broken = updates::follow_restart(
        &checked.applied,
        &plugins,
        &registry,
        &file,
        updates::log_file(),
        &mut || {
            ENGINE.with(|cell| {
                if let Some(mut old) = cell.borrow_mut().take() {
                    old.stop();
                }
                *cell.borrow_mut() = Some(Engine::start().expect("движок поднялся"));
            });
            Ok(())
        },
    )
    .expect("работа после рестарта — проверка журнала и откат");

    ENGINE.with(|cell| {
        if let Some(mut old) = cell.borrow_mut().take() {
            old.stop();
        }
    });
    assert_eq!(broken, vec!["github"], "новая версия не загрузилась — движение сломано");
    let written = std::fs::read_to_string(plugins.join("github.ts")).expect("файл плагина на месте");
    assert_eq!(written, PLUGIN_SRC, "остаётся предыдущая версия — откат на запасной файл");
    let record = std::fs::read_to_string(&registry).expect("реестр установленного записан");
    assert!(
        record.contains("\"1.4.2\"") && !record.contains("1.5.0"),
        "в реестре прежняя версия: {record}"
    );
    let notes = updates::at(&file);
    let note = notes.records.get("github").expect("запись об обновлении в updates.json");
    assert!(
        note.status == updates::UpdateStatus::Broken,
        "обновление сломало плагин — плагин помечен: {note:?}"
    );
}

thread_local! {
    /// Живой движок по ходу проверки: рестарты — стоп и новый запуск.
    static ENGINE: std::cell::RefCell<Option<Engine>> = const { std::cell::RefCell::new(None) };
}
