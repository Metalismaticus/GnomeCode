//! Tool Sets (src-tauri/src/plugins/toolsets.rs): сохранённая группа плагинов
//! подключается одним пунктом меню — сет пишется в toolsets.json и переживает
//! перечитывание, через выделенную функцию подключения сета каждый установленный
//! плагин получает выбранный скоуп (прокси перезапуска окна здесь — свежий merged
//! с чистым реестром), недоступный плагин сета пропускается, снятие плагина с
//! чата не стирает сет и не деинсталлирует его. Проверки на временных папках —
//! данных владельца не касаются (docs/BATCH.md, пункт 7; phase2.md, раздел 11).

use gnomecode_lib::plugins::install::CatalogEntry;
use gnomecode_lib::plugins::{catalog, commands, registry, scopes, toolsets};

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-toolsets-{}-{name}", std::process::id()));
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

/// Запись реестра установленного: подключение сета берёт только установленный плагин.
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
    let file = gnomecode_lib::plugins::install::registry_file(folder.to_path_buf());
    std::fs::create_dir_all(file.parent().expect("у реестра есть папка")).expect("папка реестра создана");
    std::fs::write(file, serde_json::to_string(&known).expect("реестр собран"))
        .expect("реестр записан");
}

/// Доступные id из записей реестра: то же, что команда окна соберёт из движка
/// и реестра установленного перед подключением сета.
fn available(entries: &[CatalogEntry]) -> Vec<String> {
    entries.iter().map(|entry| entry.id.clone()).collect()
}

/// Список «Godot Dev» — группа git и docs: на нём проверяется всё.
fn pairs() -> Vec<String> {
    vec!["git".to_string(), "docs".to_string()]
}

#[test]
fn toolset_is_saved_and_connects_the_installed_ids_with_a_scope() {
    let data = TempDir::new("pairs");
    let blocks = data.join("blocks");
    let file = toolsets::file(blocks.clone());
    toolsets::set(&file, "Godot Dev", &pairs()).expect("сет записан");
    let held = toolsets::at(&file);
    let ids = held
        .get("Godot Dev")
        .unwrap_or_else(|| panic!("сета «Godot Dev» нет после перечитывания: {:?}", held));
    assert_eq!(
        ids,
        &pairs(),
        "после перечитывания файла Tool Set потерял своих плагинов"
    );

    // Подключение сета: installed записи в реестре — оба доступны; скоуп
    // «проект» от выделенной функции ложится на файл скоупов.
    let installed = vec![record("git"), record("docs")];
    write_installed(&blocks, &installed);
    let scopes_file = scopes::file(blocks.clone());
    let reg = registry::Registry::default();
    let connected =
        commands::toolset_connect(&reg, scopes_file.clone(), Some("C:\\prj"), &available(&installed), ids, Some("project".to_string()))
            .expect("сет подключён");
    assert_eq!(connected, pairs(), "сет подключил не все доступные плагины");

    let saved = scopes::at(&scopes_file);
    let own = saved
        .project
        .get("C:\\prj")
        .unwrap_or_else(|| panic!("проектного списка в plugin_scopes.json нет: {:?}", saved));
    assert_eq!(
        own,
        &pairs(),
        "файл скоупов проекта не содержит обоих плагинов сета: {:?}",
        saved.project
    );

    // Прокси перезапуска окна: чистый реестр (новый чат), кнопки возвращает
    // проектный скоуп — оба плагина подключены с пометкой «project».
    let fresh = registry::Registry::default();
    let effective = scopes::connected_for(&fresh.connected(), &fresh.opted_out(), own);
    assert_eq!(effective, pairs(), "чистый реестр потерял кнопки скоупа проекта");
    let list = catalog::with_scopes(
        catalog::merged(&[], &[], &effective, &[], &installed),
        &[],
        &fresh.connected(),
        own,
        &[],
    );
    for id in pairs() {
        let own = list
            .iter()
            .find(|one| one.id == id)
            .unwrap_or_else(|| panic!("плагина «{id}» нет в списке нового чата"));
        assert!(own.connected, "в новом чате не подключён «{id}» из сета");
        assert_eq!(
            own.scope.as_deref(),
            Some("project"),
            "у «{id}» не отмечен проектный скоуп подключения сета"
        );
    }
}

#[test]
fn uninstalled_ids_of_a_toolset_are_passed_over() {
    let data = TempDir::new("unavailable");
    let blocks = data.join("blocks");
    let installed = vec![record("git")];
    write_installed(&blocks, &installed);
    let reg = registry::Registry::default();

    let connected = commands::toolset_connect(
        &reg,
        scopes::file(blocks.clone()),
        Some("C:\\prj"),
        &available(&installed),
        &["git".to_string(), "godot".to_string()],
        Some("project".to_string()),
    )
    .expect("подключение сета не упало на недоступном плагине");

    assert_eq!(connected, vec!["git".to_string()], "недоступный плагин попал в подключение сета");
    let reg_ids = reg.connected();
    assert_eq!(
        reg_ids,
        vec!["git".to_string()],
        "реестр чата принял недоступный «godot»: {:?}",
        reg_ids
    );
    let saved = scopes::at(&scopes::file(blocks));
    assert!(
        !saved.project.values().any(|own| own.iter().any(|id| id == "godot")),
        "недоступный «godot» записан в проектный список: {:?}",
        saved.project
    );
}

#[test]
fn removing_from_the_chat_keeps_the_set_and_the_plugins() {
    let data = TempDir::new("remove");
    let blocks = data.join("blocks");
    let installed = vec![record("git"), record("docs")];
    write_installed(&blocks, &installed);
    let set_file = toolsets::file(blocks.clone());
    toolsets::set(&set_file, "Godot Dev", &pairs()).expect("сет записан");
    let reg = registry::Registry::default();
    commands::toolset_connect(
        &reg,
        scopes::file(blocks.clone()),
        Some("C:\\prj"),
        &available(&installed),
        &pairs(),
        Some("project".to_string()),
    )
    .expect("сет подключён");

    // Снятие с чата из панели «Plugins in this chat»: только реестр окна.
    reg.opt_out_of("git");

    let held = toolsets::at(&set_file);
    assert_eq!(
        held.get("Godot Dev"),
        Some(&pairs()),
        "снятие с чата стёрло Tool Set: {:?}",
        held
    );
    let after = gnomecode_lib::plugins::install::installed(&gnomecode_lib::plugins::install::registry_file(
        blocks.clone(),
    ));
    assert_eq!(
        after.len(),
        2,
        "снятие с чата деинсталлировало плагин: в реестре осталось {} из 2",
        after.len()
    );

    // В том же чате снятие держится до перезапуска: git убран, docs на месте.
    let saved = scopes::at(&scopes::file(blocks));
    let own = saved.project.get("C:\\prj").cloned().unwrap_or_default();
    let effective = scopes::connected_for(&reg.connected(), &reg.opted_out(), &own);
    assert!(
        !effective.iter().any(|id| id == "git"),
        "снятый с чата «git» вернулся в этом же окне: {:?}",
        effective
    );
    assert!(
        effective.iter().any(|id| id == "docs"),
        "снятие с чата убрало и не тронутый «docs»: {:?}",
        effective
    );
}
