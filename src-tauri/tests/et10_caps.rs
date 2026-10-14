//! Капы ET10: кэш версий держит последние K версий плагина (эвикция старых),
//! счётчик событий ротирует файл при росте сверх лимита.

use gnomecode_lib::plugins::install::{self, CatalogEntry};
use gnomecode_lib::plugins::vcache;
use gnomecode_lib::plugins::counter;

struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-et10-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }
    fn path(&self) -> std::path::PathBuf {
        self.0.clone()
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn entry(id: &str, version: &str) -> CatalogEntry {
    CatalogEntry {
        id: id.to_string(),
        name: id.to_string(),
        description: String::new(),
        author: String::new(),
        version: version.to_string(),
        repo: "a/b".to_string(),
        entry: "index.ts".to_string(),
        permissions: vec![],
        commands: vec![],
        disabled: false,
        source: install::Source::default(),
    }
}

/// Эвикция (ET10): K=3 версии на плагин — четвёртая вытесняет самую старую,
/// у соседнего плагина свои версии не тронуты.
#[test]
fn cache_evicts_oldest_versions_beyond_the_cap() {
    let data = TempDir::new("evict");
    let cache = vcache::file(data.path());

    for version in ["1.0.0", "1.1.0", "1.2.0", "1.3.0"] {
        vcache::remember(&cache, &entry("github", version), "content").expect("версия запомнена");
    }
    vcache::remember(&cache, &entry("docs", "0.1.0"), "docs-content").expect("docs запомнен");

    assert!(vcache::get(&cache, "github", "1.0.0").is_none(), "самая старая вытеснена");
    assert!(vcache::get(&cache, "github", "1.1.0").is_some(), "вторая осталась");
    assert!(vcache::get(&cache, "github", "1.3.0").is_some(), "новая на месте");
    assert!(
        vcache::get(&cache, "docs", "0.1.0").is_some(),
        "версии соседнего плагина не тронуты"
    );
}

/// Ротация счётчика (ET10): файл больше лимита — переезжает в .1, основной
/// начинается с нуля, события после ротации дописываются в новый файл.
#[test]
fn events_file_rotates_when_over_the_limit() {
    let data = TempDir::new("rotate");
    let events = data.path().join("events.jsonl");

    counter::opt_in(data.path()).expect("opt-in включён");
    for index in 0..25 {
        counter::record_limited(&events, "install", Some("github"), 200);
        let _ = index;
    }
    let meta = std::fs::metadata(&events).expect("файл событий на месте");
    assert!(meta.len() <= 400, "файл ротируется: не должен сильно расти ({})", meta.len());
    let rotated = std::fs::metadata(data.path().join("events.jsonl.1")).expect(".1 на месте");
    assert!(rotated.len() > 0, "старые события переехали в .1");
}
