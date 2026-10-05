//! Установщик каталога: фейковый raw.githubusercontent на loopback (настоящий сокет,
//! как отдаёт живой GitHub), файл плагина ложится в папку плагинов движка, реестр
//! установленного — installed.json. Повторная установка обновляет запись
//! (docs/ROADMAP.md, «Крайние случаи»). Живой GitHub в проверки не заходит.
//!
//! Зонд на живом движке подтверждает папку глобальных плагинов (`~/.config/opencode/plugins/`
//! на Windows) и загрузку установленного файла при старте — по журналу движка;
//! `/api/plugin` файловые плагины не перечисляет, поэтому список установленного
//! даёт наш реестр (тест слияния).

mod common;

use std::net::TcpListener;
use std::path::PathBuf;

use gnomecode_lib::opencode::engine::{locate, Engine};
use gnomecode_lib::plugins::install::{self, CatalogEntry};

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

const PLUGIN_SRC: &str = "export default {\n  id: \"github\",\n  async setup() {\n    return {}\n  },\n}\n";

/// Фейковый raw.githubusercontent: отвечает на GET путём маршрута, считает запросы.
struct FakeGithub {
    /// `адрес хоста:порта` — база каталога для установщика.
    base: String,
}

impl FakeGithub {
    /// Поднять сервер с двумя маршрутами: индекс каталога и файл плагина.
    /// Вариант индекса выбирается по содержимому запроса: `index.json` отдаёт оба
    /// тела по очереди — первая установка читает первое, вторая — второе.
    fn start(index_bodies: [&'static str; 2]) -> FakeGithub {
        let listener = TcpListener::bind("127.0.0.1:0").expect("фейковый GitHub поднялся");
        let base = format!("http://{}", listener.local_addr().expect("адрес фейка"));
        std::thread::spawn(move || {
            let mut served = 0usize;
            for stream in listener.incoming().flatten() {
                let mut socket = stream;
                let request = common::read_request(&mut socket);
                let route = request.lines().next().unwrap_or_default().to_string();
                let body = if route.contains("index.json") {
                    index_bodies[served.min(1)]
                } else {
                    PLUGIN_SRC
                };
                served += 1;
                let reply = common::json_head(body);
                use std::io::Write;
                let _ = socket.write_all(reply.as_bytes());
                let _ = socket.flush();
            }
        });
        FakeGithub { base }
    }
}

/// Своя временная папка на тест: установки проверки не трогают данные владельца.
struct TempDir(PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-install-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }

    fn join(&self, tail: &str) -> PathBuf {
        self.0.join(tail)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

#[test]
fn install_downloads_plugin_file_and_records_it() {
    let fake = FakeGithub::start([INDEX, INDEX]);
    let plugins = TempDir::new("plugins");
    let data = TempDir::new("data");
    let registry = data.join("installed.json");

    let found = install::fetch(&format!("{}/Metalismaticus/gnomecode-catalog/main/index.json", fake.base))
        .expect("индекс каталога прочитан");
    assert_eq!(found.len(), 1, "в индексе один плагин: {:?}", found);
    let entry = &found[0];
    assert_eq!(entry.id, "github");
    assert_eq!(entry.version, "1.4.2");
    assert_eq!(entry.permissions.len(), 2, "права каталога разобраны: {:?}", entry.permissions);
    assert_eq!(entry.commands.len(), 1, "команды каталога разобраны: {:?}", entry.commands);

    install::install(entry, &fake.base, &plugins.0, &registry).expect("плагин установлен");

    let file = plugins.join("github.ts");
    let written = std::fs::read_to_string(&file).expect("файл плагина записан в папку плагинов движка");
    assert_eq!(written, PLUGIN_SRC, "файл плагина — то, что отдал GitHub");
    let record = std::fs::read_to_string(&registry).expect("реестр установленного записан");
    assert!(
        record.contains("\"1.4.2\"") && record.contains("github-plugin"),
        "в реестре версия и репозиторий: {record}"
    );
}

#[test]
fn reinstall_updates_the_record() {
    let fake = FakeGithub::start([INDEX, INDEX_NEXT]);
    let plugins = TempDir::new("plugins-2");
    let data = TempDir::new("data-2");
    let registry = data.join("installed.json");

    for version in ["1.4.2", "1.5.0"] {
        let found = install::fetch(&format!("{}/Metalismaticus/gnomecode-catalog/main/index.json", fake.base))
            .expect("индекс каталога прочитан");
        install::install(&found[0], &fake.base, &plugins.0, &registry)
            .expect("плагин установлен повторно");
        let record = std::fs::read_to_string(&registry).expect("реестр установленного записан");
        assert!(
            record.contains(&format!("\"{version}\"")),
            "после установки {version} в реестре её запись: {record}"
        );
    }
    let final_record = std::fs::read_to_string(&registry).expect("реестр после второй установки");
    assert!(
        !final_record.contains("1.4.2"),
        "старая версия осталась в реестре рядом с новой: {final_record}"
    );
}

/// Зонд на живом движке: движок читает глобальные плагины только при старте.
/// Файл установщика должен появиться в журнале движка строкой «loading plugin» —
/// движок сам сообщает, что и откуда грузит (данные движка изолированы, журнал
/// уходит во временную папку XDG_DATA_HOME). Формат плагина v2 — default export
/// `{ id, setup }`; `/api/plugin` локальные файловые плагины не перечисляет —
/// список установленного берёт реестр (см. тест слияния ниже).
#[test]
fn engine_loads_the_installed_plugin_from_the_global_folder() {
    let found = match locate() {
        Ok(exe) => exe,
        Err(reason) => {
            panic!("движок не найден: {reason}");
        }
    };
    assert!(found.is_file(), "движок по найденному пути — файл: {}", found.display());

    // Дом и данные движка уходят во временную папку: и плагины, и журнал проверки
    // пишут в одно место, данные владельца не задеты.
    let home = TempDir::new("home-engine");
    let data = TempDir::new("data-engine");
    std::env::set_var("USERPROFILE", &home.0);
    std::env::set_var("XDG_DATA_HOME", data.join("xdg-data"));
    std::env::set_var("XDG_CONFIG_HOME", home.join(".config"));
    std::fs::create_dir_all(data.join("xdg-data")).expect("папка данных движка создана");

    let dir = install::plugins_dir();
    let file = dir.join("catalog_probe.ts");
    std::fs::create_dir_all(&dir).expect("папка плагинов движка создана");
    // Формат v2 проверен на живом движке: default export с id и setup.
    std::fs::write(
        &file,
        "export default {\n  id: \"catalog-probe\",\n  async setup() {\n    return {}\n  },\n}\n",
    )
    .expect("плагин-зонд записан");

    let mut engine = Engine::start().expect("движок поднялся и /api/config ответил");
    let log_path = data.join("xdg-data").join("opencode").join("log").join("opencode.log");
    let needle = "loading plugin";
    let name = file.display().to_string();
    let file_name = file.file_name().expect("у плагина есть имя").to_string_lossy().to_string();
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(20);
    let mut logged = String::new();
    while std::time::Instant::now() < deadline {
        if let Ok(text) = std::fs::read_to_string(&log_path) {
            // Журнал движка экранирует Windows-пути (C:\\Users\\…) и пишет их
            // короткой формой (METALI~1): сравниваем по имени файла.
            let unescaped = text.replace("\\\\", "\\");
            logged = unescaped;
            if logged.contains(needle) && logged.contains(&file_name) {
                engine.stop();
                return;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(300));
    }
    engine.stop();
    let lines: Vec<String> = logged
        .lines()
        .filter(|line| line.contains(needle) || line.contains("failed to load"))
        .map(|line| line.chars().take(220).collect())
        .collect();
    panic!(
        "движок не загрузил установленный плагин {}: в журнале движка {} — {}",
        name,
        log_path.display(),
        lines.join(" | ")
    );
}

/// Реестр установленного — источник списка после установки: движок локальные
/// файловые плагины в `GET /api/plugin` не перечисляет (замер 2026-10-06), поэтому
/// реестр даёт недостающие строки, а движок — состояние и команды project-плагинов.
#[test]
fn merge_lists_installed_plugins_from_the_registry() {
    use gnomecode_lib::plugins::catalog::merged;

    // Сырой ответ движка в его собственной форме (ADR-0001): каталог и реестр
    // установленный — это данные, движковый список приходит JSON-ом.
    let engine = serde_json::json!([
        { "id": "studio", "state": { "status": "active" }, "features": {} }
    ]);
    let commands = serde_json::json!([
        { "name": "studio:init", "description": "guided AGENTS.md setup" }
    ]);
    let installed = vec![CatalogEntry {
        id: "github".to_string(),
        name: "GitHub".to_string(),
        description: "Repository, issues, pull requests".to_string(),
        author: "Metalismaticus".to_string(),
        version: "1.4.2".to_string(),
        repo: "Metalismaticus/github-plugin".to_string(),
        entry: "index.ts".to_string(),
        permissions: vec![install::Permission {
            category: "Network".to_string(),
            value: "api.github.com".to_string(),
        }],
        commands: vec![install::CommandSpec {
            name: "issues".to_string(),
            description: "list issues".to_string(),
        }],
        disabled: false,
    }];

    let merged = merged(
        engine.as_array().expect("список движка — массив"),
        commands.as_array().expect("команды движка — массив"),
        &[],
        &[],
        &installed,
    );
    let github = merged
        .iter()
        .find(|one| one.id == "github")
        .expect("плагин из реестра установленного попал в список");
    assert_eq!(github.commands[0].name, "github:issues", "имя команды — как у движка");
    assert_eq!(github.commands[0].label, "issues", "подпись кнопки — без префикса");
    let studio = merged.iter().find(|one| one.id == "studio").expect("движковый плагин остался");
    assert_eq!(studio.commands.len(), 1, "движковые команды не задублированы");
}
