//! Импорт существующей конфигурации OpenCode (CE-1): пакеты из
//! `opencode.json` владельца попадают в реестр установленного как
//! «импортированные, отключённые». Правила юнита: ре-импорт добавляет только
//! новые записи (ключ дедупликации — имя npm-пакета, 1.2); существующие
//! записи не перезаписываются; импортированные автообновлением не
//! трогаются (1.1); разбор честно считает «Распознано N из M» (F-DX-10).

mod common;

use gnomecode_lib::plugins::import;
use gnomecode_lib::plugins::install::{self, Source};
use gnomecode_lib::plugins::updates;

use common::{FakeGithub, TempDir};

/// Конфиг владельца: два пакета, путь и не-строка — «распознано 2 из 4».
const CONFIG: &str = r#"{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "@zai/gnome-plugins",
    "awesome-plugin",
    "./local/own.ts",
    { "name": "объект" }
  ]
}"#;

/// Ре-импорт не плодит дубликаты (CE-1): первый ход добавляет оба пакета,
/// второй — ноль; записи реестра те же, ключ — имя npm-пакета.
#[test]
fn reimport_adds_only_new_records() {
    let data = TempDir::new("dedup");
    let registry = install::registry_file(data.path().clone());

    let first = import::record_new(&registry, &["@zai/gnome-plugins".to_string(), "awesome-plugin".to_string()])
        .expect("первый импорт записан");
    assert_eq!(first, 2, "два новых пакета добавлены");
    assert_eq!(install::records(&registry).len(), 2, "обе записи в реестре");

    // Ре-импорт того же конфига на следующем запуске.
    let second = import::record_new(&registry, &["@zai/gnome-plugins".to_string(), "awesome-plugin".to_string()])
        .expect("повторный импорт не ошибка");
    assert_eq!(second, 0, "новых записей нет — дедуп по имени пакета");
    assert_eq!(install::records(&registry).len(), 2, "дублей не завелось");

    // Третий пакет на следующем запуске — добавляется один.
    let third = import::record_new(&registry, &["awesome-plugin".to_string(), "fresh-one".to_string()])
        .expect("третий импорт записан");
    assert_eq!(third, 1, "добавлен только новый пакет");
    assert_eq!(install::records(&registry).len(), 3);
}

/// Импортированная запись: «установлена, отключена» (CE-1), источник —
/// импорт (F11); запись реестра без поля читается как каталог (старые файлы).
#[test]
fn imported_records_are_disabled_and_marked() {
    let data = TempDir::new("marks");
    let registry = install::registry_file(data.path().clone());

    import::record_new(&registry, &["awesome-plugin".to_string()]).expect("запись импорта");
    let held = install::records(&registry);
    let entry = held.get("awesome-plugin").expect("запись на месте");
    assert_eq!(entry.source, Source::Imported, "источник — импорт");
    assert!(entry.disabled, "импортированный входит отключённым");
    assert!(entry.repo.is_empty() && entry.entry.is_empty(), "файла и репозитория у нас нет");
    assert_eq!(entry.version, "", "версию ведёт движок — у нас её нет");

    // Старый реестр без поля source — записи каталога (serde default).
    let legacy = data.join("legacy.json");
    std::fs::write(
        &legacy,
        r#"{ "github": { "id": "github", "name": "GitHub", "description": "", "author": "",
             "version": "1.4.2", "repo": "m/g", "entry": "index.ts" } }"#,
    )
    .expect("старый реестр записан");
    let held = install::records(&legacy);
    assert_eq!(
        held.get("github").expect("старая запись прочитана").source,
        Source::Registry,
        "запись без поля — из каталога"
    );
}

/// Разбор конфига: npm-имена распознаны, путь и не-строка — пропуск с
/// причиной; не-JSON — честный отказ файла, а не паника.
#[test]
fn parse_recognizes_npm_and_skips_the_rest() {
    let parsed = import::parse(CONFIG);
    assert_eq!(
        parsed.packages,
        vec!["@zai/gnome-plugins".to_string(), "awesome-plugin".to_string()],
        "распознаны два npm-имени"
    );
    assert_eq!(parsed.packages.len() + parsed.skipped.len(), 4, "распознано 2 из 4");
    assert!(
        parsed.skipped.iter().any(|(raw, why)| raw.contains(".ts") && why.contains("движок")),
        "путь пропущен с причиной «движок грузит сам»"
    );
    assert!(
        parsed.skipped.iter().any(|(raw, _)| raw.contains("объект")),
        "не-строка пропущена с записью"
    );

    // Конфиг без ключа plugin — импортировать нечего, без ошибки.
    let empty = import::parse(r#"{ "model": "glm-5.3" }"#);
    assert!(empty.packages.is_empty() && empty.skipped.is_empty());

    // Битый JSON — одна причина на файл.
    let broken = import::parse("{ не json");
    assert_eq!(broken.packages.len(), 0);
    assert_eq!(broken.skipped.len(), 1, "причина отказа названа");
}

/// Индекс каталога, где импортированный пакет «нашёлся» с новой версией:
/// автообновление должно его молча пропустить (1.1).
const INDEX: &str = r#"[
  {
    "id": "awesome-plugin",
    "name": "Awesome",
    "description": "импортированный пакет, найденный в каталоге",
    "author": "кто-то",
    "version": "9.9.9",
    "repo": "someone/awesome",
    "entry": "index.ts"
  }
]"#;

/// Импортированные автообновлением не трогаются (1.1): запись с источником
/// «импорт», чей id есть в индексе с новой версией, остаётся как была.
#[test]
fn auto_update_skips_imported_records() {
    let github = FakeGithub::start(&[INDEX], &[]);
    let data = TempDir::new("skip-imported");
    let registry = install::registry_file(data.path().clone());
    let plugins = data.join("plugins");
    let notes = updates::file(data.path().clone());

    import::record_new(&registry, &["awesome-plugin".to_string()]).expect("запись импорта");
    let done = updates::check_and_update(
        github.index_url().as_str(),
        &plugins,
        &registry,
        &notes,
        &data.join("vcache.json"),
    )
    .expect("проверка прошла");

    assert!(done.applied.is_empty(), "импортированный не обновлялся");
    let held = install::records(&registry);
    let entry = held.get("awesome-plugin").expect("запись на месте");
    assert_eq!(entry.version, "", "версия импортированного не тронута");
    assert_eq!(entry.source, Source::Imported, "источник не перезаписан");
    assert!(
        !done.notes.records.contains_key("awesome-plugin"),
        "записи обновления для импортированного не завелось"
    );
    assert!(
        !plugins.join("awesome-plugin.ts").exists(),
        "файл импортированного не скачивался"
    );
}
