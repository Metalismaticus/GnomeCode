//! Скоупы подключения плагинов (src-tauri/src/plugins/scopes.rs): выбор «этот
//! проект» и «Enable by default» при подключении помнится в plugin_scopes.json
//! и вернёт кнопки плагину после перезапуска (прокси «нового чата» здесь —
//! свежий merged со скоуповым списком); снятие плагина с чата не деинсталлирует
//! его и не стирает скоуп. Проверки на временных папках — данных владельца
//! не касаются (docs/BATCH.md, пункт 5; docs/SPEC/plugins.md, сцена E).

use gnomecode_lib::plugins::install::CatalogEntry;
use gnomecode_lib::plugins::{catalog, registry, scopes};

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-scopes-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }

    fn join(&self, tail: &str) -> std::path::PathBuf {
        self.0.join(tail)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Запись реестра установленного: скоуп подключает только установленный плагин.
fn record(id: &str) -> CatalogEntry {
    CatalogEntry {
        id: id.to_string(),
        name: "GitHub".to_string(),
        description: "Repository, issues, pull requests".to_string(),
        author: "Metalismaticus".to_string(),
        version: "1.4.2".to_string(),
        repo: "Metalismaticus/github-plugin".to_string(),
        entry: "index.ts".to_string(),
        permissions: vec![],
        commands: vec![gnomecode_lib::plugins::install::CommandSpec {
            name: "diff".to_string(),
            description: "показать изменения рабочей папки".to_string(),
            category: None,
        }],
        disabled: false,
    }
}

/// Положить в реестр установленного записи: как их пишет установщик пункта 1.
fn write_installed(folder: &std::path::Path, entries: &[CatalogEntry]) {
    let known: std::collections::BTreeMap<String, CatalogEntry> = entries
        .iter()
        .map(|entry| (entry.id.clone(), entry.clone()))
        .collect();
    let registry = gnomecode_lib::plugins::install::registry_file(folder.to_path_buf());
    std::fs::create_dir_all(registry.parent().expect("у реестра есть папка")).expect("папка реестра создана");
    std::fs::write(registry, serde_json::to_string(&known).expect("реестр собран"))
        .expect("реестр записан");
}

/// Текст файла, если он есть: пусто — свои нарративные проверки ниже.
fn file_text(file: &std::path::Path) -> String {
    std::fs::read_to_string(file).unwrap_or_default()
}

/// Плоскость скоупа одной папки, как её собирает команда plugin_list.
fn own_ids(saved: &scopes::Scopes, root: &str) -> Vec<String> {
    saved.project.get(root).cloned().unwrap_or_default()
}

#[test]
fn project_scope_is_saved_to_the_file_and_returns_the_plugin() {
    let data = TempDir::new("project");
    let file = scopes::file(data.join("folder"));

    scopes::set(&file, "project", Some("C:\\prj"), "git").expect("проектный скоуп записан");

    let text = file_text(&file);
    assert!(
        text.contains("git"),
        "в plugin_scopes.json проектного списка нет: «{}»",
        text.replace('\n', " ")
    );

    // Новый чат после перезапуска: реестр чата пуст, кнопки даёт скоуп проекта.
    let saved = scopes::at(&file);
    let own = own_ids(&saved, "C:\\prj");
    let installed = vec![record("git")];
    let effective = scopes::connected_for(&[], &[], &own);
    let list = catalog::with_scopes(
        catalog::merged(&[], &[], &effective, &[], &installed),
        &[],
        &[],
        &own,
        &[],
    );
    let git = list
        .iter()
        .find(|one| one.id == "git")
        .expect("плагина «git» нет в списке — скоуп проекта его не вернул");
    assert!(git.connected, "после сброса чата плагин не подключён скоупом проекта");
    assert_eq!(
        git.scope.as_deref(),
        Some("project"),
        "у подключённого скоупом плагина не отмечен его скоуп"
    );
}

#[test]
fn global_scope_works_for_another_folder() {
    let data = TempDir::new("global");
    let file = scopes::file(data.join("folder"));

    scopes::set(&file, "global", None, "git").expect("глобальный скоуп записан");
    let saved = scopes::at(&file);
    let installed = vec![record("git")];
    let list = catalog::with_scopes(
        catalog::merged(&[], &[], &scopes::connected_for(&[], &[], &saved.global), &[], &installed),
        &[],
        &[],
        &[],
        &saved.global,
    );
    let git = list
        .iter()
        .find(|one| one.id == "git")
        .expect("плагина «git» нет в списке — глобальный скоуп его не вернул");
    assert!(git.connected, "глобальный скоуп не вернул плагин в новом чате другой папки");
    assert_eq!(git.scope.as_deref(), Some("global"), "глобальному подключению не отмечен скоуп global");
}

#[test]
fn removing_from_the_chat_keeps_the_plugin_and_its_scope() {
    let data = TempDir::new("remove");
    let file = scopes::file(data.join("folder"));
    let installed = vec![record("git")];
    write_installed(&data.join("folder"), &installed);

    scopes::set(&file, "project", Some("C:\\prj"), "git").expect("скоуп записан");
    let reg = registry::Registry::default();
    reg.connect("git");
    reg.opt_out_of("git");

    let saved = scopes::at(&file);
    assert!(
        saved.project.values().any(|own| own.iter().any(|id| id == "git")),
        "снятие с чата стёрло скоуп — плагин должен остаться подключённым в других чатах"
    );
    let text = file_text(&gnomecode_lib::plugins::install::registry_file(data.join("folder")));
    assert!(
        text.contains("github-plugin"),
        "снятие с чата деинсталлировало плагин: запись реестра потерялась"
    );

    // В этом же чате снятие держится: effective-список plugin_list пуст —
    // connected_for вычитает opt-out из скоупов до перезапуска окна.
    let effective = scopes::connected_for(&reg.connected(), &reg.opted_out(), &own_ids(&saved, "C:\\prj"));
    let merged = catalog::merged(&[], &[], &effective, &[], &installed);
    let git = merged
        .iter()
        .find(|one| one.id == "git")
        .expect("плагина «git» нет в списке — снятие с чата удалило его из установленных");
    assert!(!git.connected, "снятие с чата держится только до перезапуска окна, а скоуп вернул кнопки сразу");
    assert!(
        git.commands.iter().any(|command| command.name == "git:diff"),
        "снятие с чата деинсталлировало плагин: команд в списке больше нет"
    );

    // После перезапуска (новый реестр, чистый opt-out) скоуп возвращает кнопки.
    let fresh = scopes::connected_for(&[], &[], &own_ids(&saved, "C:\\prj"));
    let merged = catalog::merged(&[], &[], &fresh, &[], &installed);
    let git = merged
        .iter()
        .find(|one| one.id == "git")
        .expect("плагина «git» нет в списке нового чата — скоуп проекта не вернул его");
    assert!(git.connected, "после сброса чата скоуп проекта не вернул кнопки");
}

#[test]
fn chat_scope_downgrades_a_project_scope_in_the_file() {
    let data = TempDir::new("downgrade");
    let file = scopes::file(data.join("folder"));
    scopes::set(&file, "project", Some("C:\\prj"), "git").expect("скоуп записан");

    // Полоса скоупов у строки: «Этот чат» — откат до чата, список проекта чист.
    scopes::set(&file, "chat", Some("C:\\prj"), "git").expect("скоуп чата записан");
    let saved = scopes::at(&file);
    assert!(
        !saved.project.values().any(|own| own.iter().any(|id| id == "git")),
        "после выбора «Этот чат» плагин остался в проектном списке: {:?}",
        saved.project
    );
}

#[test]
fn once_scope_does_not_survive_a_restart() {
    let data = TempDir::new("once");
    let file = scopes::file(data.join("folder"));

    scopes::set(&file, "once", None, "git").expect("скоуп once записан");
    let saved = scopes::at(&file);
    assert!(
        saved.global.is_empty() && saved.project.is_empty(),
        "«Once» попал в файл скоупов — память файла для него не нужна, снимается после вопроса: {:?}",
        saved
    );
}

#[test]
fn explicit_scope_on_an_already_connected_row_updates_the_chat_registry() {
    let data = TempDir::new("re-choice");
    let file = scopes::file(data.join("folder"));

    // а) Плагин уже подключён (строкой списка) — явный «Once» в полосе обязан
    // встать на реестр чата: следующий вопрос его снимает (take_once), иначе
    // «Once» молча живёт до конца сессии как «Chat» (сцена E спеки).
    let reg = registry::Registry::default();
    reg.connect("git");
    let visible = scopes::connected_for(&reg.connected(), &reg.opted_out(), &[]);
    let already = visible.iter().any(|one| one == "git");
    reg.choose("git", "once", true, already);

    assert!(
        reg.once_ids().iter().any(|one| one == "git"),
        "«Once» не встал на реестр уже подключённого плагина — take_once его не снимет, «Once» будет жить до конца сессии как «Chat»"
    );
    assert!(
        reg.connected().iter().any(|one| one == "git"),
        "«Once» снял плагин с чата до вопроса — он действует до конца текущего запроса, не сразу"
    );
    let taken = reg.take_once();
    assert_eq!(taken, vec!["git".to_string()], "«Once» не помечен в реестре — после вопроса снимать нечего");
    assert!(
        reg.connected().is_empty(),
        "после вопроса плагин остался подключённым — «Once» не снялся (сцена E: до конца текущего запроса)"
    );

    // Идемпотентен только клик строки без скоупа: подключённый остаётся, «Once»
    // не ставится.
    reg.connect("git");
    let visible = scopes::connected_for(&reg.connected(), &reg.opted_out(), &[]);
    let already = visible.iter().any(|one| one == "git");
    reg.choose("git", "chat", false, already);
    assert!(
        reg.once_ids().is_empty() && reg.connected().iter().any(|one| one == "git"),
        "повторный клик строки без скоупа поменял реестр чата"
    );

    // б) «Project» уже в файле, реестр пуст (новый чат после перезапуска) —
    // явный «Chat» обязан вернуть плагин в реестр чата и снять скоуп из файла,
    // а не дать кнопкам исчезнуть из этого чата.
    scopes::set(&file, "project", Some("C:\\prj"), "git").expect("проектный скоуп записан");
    let fresh = registry::Registry::default(); // перезапуск — прокси нового чата
    let saved = scopes::at(&file);
    let scoped = saved.project.get("C:\\prj").cloned().unwrap_or_default();
    let visible = scopes::connected_for(&fresh.connected(), &fresh.opted_out(), &scoped);
    let already = visible.iter().any(|one| one == "git");
    fresh.choose("git", "chat", true, already);
    scopes::set(&file, "chat", Some("C:\\prj"), "git").expect("скоуп чата записан");
    assert!(
        fresh.connected().iter().any(|one| one == "git"),
        "после выбора «Chat» на строке со скоупом из файла плагина нет в реестре чата — кнопки исчезнут вместо «этот чат»"
    );
    let saved = scopes::at(&file);
    assert!(
        !saved.project.values().any(|own| own.iter().any(|id| id == "git")),
        "после выбора «Chat» проектный скоуп остался в файле: {:?}",
        saved.project
    );

    // в) Тот же проход с явным «Once» после перезапуска: пометка once ставится —
    // следующий вопрос снимет плагин, а не «до конца сессии».
    scopes::set(&file, "project", Some("C:\\prj"), "git").expect("проектный скоуп возвращён в файл");
    let fresh = registry::Registry::default();
    let saved = scopes::at(&file);
    let scoped = saved.project.get("C:\\prj").cloned().unwrap_or_default();
    let visible = scopes::connected_for(&fresh.connected(), &fresh.opted_out(), &scoped);
    let already = visible.iter().any(|one| one == "git");
    fresh.choose("git", "once", true, already);
    scopes::set(&file, "once", Some("C:\\prj"), "git").expect("скоуп once записан");
    assert!(
        fresh.once_ids().iter().any(|one| one == "git"),
        "явный «Once» на строке со скоупом из файла не встал на реестр — после вопроса плагин останется с чатом до конца сессии"
    );
    assert!(fresh.connected().iter().any(|one| one == "git"), "«Once» не вернул плагин в чат");
    assert!(file_text(&file).is_empty() || !file_text(&file).contains("git"), "«Once» оставил скоуп в файле");
}
