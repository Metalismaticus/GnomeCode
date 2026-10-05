//! Действия карточки раздела «Плагинов» над записью реестра (src-tauri/src/plugins/manage.rs):
//! Enable/Disable пишет только отметку `disabled` в `installed.json`, Uninstall по
//! подтверждению удаляет и запись, и файл плагина в папке движка — повторное удаление
//! не ошибка для файла (docs/BATCH.md, пункт 2; docs/SPEC/plugins.md, сцена A).
//! Проверки на временных папках — данных владельца не касаются.

use gnomecode_lib::plugins::install::CatalogEntry;
use gnomecode_lib::plugins::manage;

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-manage-{}-{name}", std::process::id()));
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

/// Запись реестра перед проверкой: реальная форма установщика (пункта 1 партии).
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
        commands: vec![],
        disabled: false,
    }
}

fn write_registry(registry: &std::path::Path, entries: &[CatalogEntry]) {
    let known: std::collections::BTreeMap<String, CatalogEntry> = entries
        .iter()
        .map(|entry| (entry.id.clone(), entry.clone()))
        .collect();
    std::fs::create_dir_all(registry.parent().expect("у реестра есть папка")).expect("папка данных создана");
    std::fs::write(registry, serde_json::to_string(&known).expect("реестр собран"))
        .expect("реестр записан");
}

#[test]
fn disable_marks_the_record_and_enable_clears_the_mark() {
    let data = TempDir::new("data");
    let registry = data.join("installed.json");
    write_registry(&registry, &[record("github")]);

    let found = manage::set_disabled("github", true, &registry).expect("выключение записано");
    assert!(found, "запись плагина нашлась в реестре");

    let text = std::fs::read_to_string(&registry).expect("реестр прочитан после выключения");
    assert!(
        text.contains("\"disabled\": true") || text.contains("\"disabled\":true"),
        "в реестре появилась отметка выключенного: {text}"
    );
    assert!(
        text.contains("github-plugin"),
        "остальные поля записи не задеты: {text}"
    );

    manage::set_disabled("github", false, &registry).expect("включение записано");
    let text = std::fs::read_to_string(&registry).expect("реестр прочитан после включения");
    assert!(
        text.contains("\"disabled\": false") || text.contains("\"disabled\":false"),
        "включение сняло отметку, а не переписало её на противоположную навсегда: {text}"
    );
}

#[test]
fn enable_or_disable_of_a_plugin_without_a_record_is_not_an_error() {
    let data = TempDir::new("data-2");
    let registry = data.join("installed.json");

    let found = manage::set_disabled("browser", true, &registry).expect("выключение без записи — не ошибка");
    assert!(!found, "записи в реестре нет — команда ведёт её в реестре чата");
}

#[test]
fn uninstall_removes_the_record_and_the_plugin_file() {
    let data = TempDir::new("data-3");
    let plugins = TempDir::new("plugins-3");
    let registry = data.join("installed.json");
    write_registry(&registry, &[record("github")]);
    let file = plugins.join("github.ts");
    std::fs::write(&file, "export default {}").expect("файл плагина для удаления");

    manage::remove("github", &registry, &plugins.0).expect("удаление прошло");

    assert!(
        !file.exists(),
        "файл плагина удалён вместе с записью: {}",
        file.display()
    );
    let text = std::fs::read_to_string(&registry).expect("реестр прочитан после удаления");
    assert!(
        !text.contains("github"),
        "в реестре не осталось записи о плагине: {text}"
    );
}

#[test]
fn uninstall_without_a_record_refuses_and_does_not_touch_the_file() {
    let data = TempDir::new("data-4");
    let plugins = TempDir::new("plugins-4");
    let registry = data.join("installed.json");
    let file = plugins.join("git.ts");
    std::fs::write(&file, "export default {}").expect("файл плагина для отказа");

    let reason = manage::remove("git", &registry, &plugins.0)
        .expect_err("плагин движка вне реестра удалить нельзя — кнопки ему и не показывается");
    assert!(
        reason.contains("нет записи"),
        "отказ объясняет отсутствие записи: {reason}"
    );
    assert!(
        file.exists(),
        "файл чужого плагина не задет: {}",
        file.display()
    );
}

#[test]
fn missing_plugin_file_is_not_an_uninstall_error() {
    let data = TempDir::new("data-5");
    let plugins = TempDir::new("plugins-5");
    let registry = data.join("installed.json");
    write_registry(&registry, &[record("github")]);

    manage::remove("github", &registry, &plugins.0)
        .expect("отсутствие файла — движок мог его уже не читать, записи достаточно");
}
