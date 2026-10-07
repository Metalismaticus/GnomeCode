//! Старт окна не ждёт движок: окно появляется сразу, лента честно говорит
//! «движок поднимается…» (замечание владельца 2026-10-07: при запуске окно долго
//! неотвечающее — мост блокировал setup, пока OpenCode server не ответит).
//!
//! Ставится красным до починки: «Chat::start занял ~30 с — setup окна ждёт
//! движок». Гоняет `tests/checks/startup_freeze.py`.

use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

mod common;

use common::{wait_for, ListSink};
use gnomecode_lib::opencode::{Chat, Sink};
use gnomecode_lib::state::Store;

/// Переменная дочернего режима: процесс-«движок» узнаёт себя по ней.
const FAKE_ENV: &str = "GNOMECODE_FAKE_ENGINE";

/// Предел ожидания ответа движка в Engine::start — 30 с; замер должен быть
/// много короче обеих границ, поэтому 2 с и 10 с.
const START_BUDGET: Duration = Duration::from_secs(2);
const NOTICE_WAIT: Duration = Duration::from_secs(10);

#[test]
fn window_does_not_wait_for_the_engine_at_start() {
    if std::env::var(FAKE_ENV).is_ok() {
        // Режим «движка»: подвесить процесс на 60 с — дольше предела ожидания
        // Engine::start (30 с), потом закрыться самому; сироты не оставляем.
        thread::sleep(Duration::from_secs(60));
        return;
    }

    // Фейковый движок: бинарь-пример «жив, но не отвечает» как opencode.exe.
    let fake = common::TempDir::new("fake-engine");
    let exe = std::env::current_exe().expect("свой исполняемый файл найден");
    // current_exe лежит в target/debug/deps → примеры — в target/debug/examples
    // (имя может содержать хеш сборки — ищем по префиксу).
    let examples = exe
        .parent()
        .and_then(|deps| deps.parent())
        .expect("папка target/debug")
        .join("examples");
    let fake_source = std::fs::read_dir(&examples)
        .ok()
        .and_then(|files| {
            files
                .flatten()
                .map(|entry| entry.path())
                .find(|path| {
                    path.is_file()
                        && path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .is_some_and(|n| n.starts_with("fake_engine") && n.ends_with(".exe"))
                })
        })
        .unwrap_or_default();
    assert!(
        fake_source.is_file(),
        "бинарь-пример не собран: {} — проверку гоняет `cargo test --examples`",
        examples.display()
    );
    let fake_engine = fake.join("opencode.exe");
    std::fs::copy(&fake_source, &fake_engine).expect("копия примера — фейковый движок");

    // PATH отдаёт первую папку: locate() находит там opencode.exe.
    let mut path = fake.path().display().to_string();
    path.push(';');
    path.push_str(&std::env::var("PATH").unwrap_or_default());
    std::env::set_var("PATH", &path);
    // Переменную видит и дочерний процесс-«движок».
    std::env::set_var(FAKE_ENV, "1");

    // Данные store — во временной папке: база владельца не трогается.
    let store = Arc::new(Store::at(PathBuf::from(fake.join("state.json"))));
    let sink = Arc::new(ListSink::default());

    let started = Instant::now();
    let _chat = Chat::start(store, Arc::clone(&sink) as Arc<dyn Sink>);
    let elapsed = started.elapsed();
    assert!(
        elapsed < START_BUDGET,
        "Chat::start занял {elapsed:?} — setup окна ждёт движок, окно не отвечает"
    );

    // Лента честна во время подъёма: строка «движок поднимается…» приходит,
    // пока мост ждёт первый ответ сервера, а не после.
    wait_for(&sink, "поднимается", NOTICE_WAIT);
}
