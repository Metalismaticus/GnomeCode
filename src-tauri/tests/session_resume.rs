//! Живой движок — в данных по XDG, изолированных от базы владельца
//! (docs/TESTING.md, «Данные пользователя»): проверка не знает ключей владельца,
//! живого ответа модели не ждёт. Лента — настоящий мост (`Chat::with_saved`):
//! сервер в этом же тесте отсюда и видно, к какой сессии пошёл вопрос и было ли
//! создание. Гоняет `tests/checks/session_resume.py`.

use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

mod common;

use common::{chunked_head, isolate_engine_data, json_head, read_request, wait_for, ListSink};
use gnomecode_lib::opencode::client::{Api, Endpoint};
use gnomecode_lib::opencode::engine::Engine;
use gnomecode_lib::opencode::session::{parse_list, resumed, sessions};
use gnomecode_lib::opencode::{Chat, EngineLife, Sink};
use gnomecode_lib::state::{StatePatch, Store};

/// Сохранённая сессия прошлого запуска, которую должно подобрать из списка живых.
const SAVED: &str = "ses_predshop";
/// Новая сессия, которую создаёт сервер проверки для правила «нет — создаём».
const CREATED: &str = "ses_new";
const QUESTION: &str = "Проверь сессию";
/// Предел ожидания строки ленты: медленный компьютер — не поломка.
const WAIT: Duration = Duration::from_secs(15);

/// Движок проверки: сервер в том же тесте, «падать» не нужно.
struct Loopback {
    endpoint: Endpoint,
}

impl EngineLife for Loopback {
    fn endpoint(&self) -> Endpoint {
        self.endpoint.clone()
    }

    fn alive(&mut self) -> bool {
        true
    }

    fn restart(&mut self) -> Result<(), String> {
        Err("перезапуск движка в проверке не нужен".to_string())
    }
}

/// Файл состояния во временной папке — путь свой на каждый тест, база владельца не трогается.
fn scratch(name: &str) -> PathBuf {
    let file = std::env::temp_dir().join(format!("gnomecode-session-{name}-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&file);
    file
}

/// Сервер проверки: список сессий отдаёт сохранённую, POST создаёт новую и считает
/// создания, путь отправки запоминает — по нему видно, в какую сессию ушёл вопрос.
fn serve(port: Arc<Mutex<u16>>, creates: Arc<AtomicUsize>, last_prompt: Arc<Mutex<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    *port.lock().expect("порт") = listener.local_addr().expect("адрес").port();
    for socket in listener.incoming() {
        let Ok(mut socket) = socket else { return };
        let creates = Arc::clone(&creates);
        let last_prompt = Arc::clone(&last_prompt);
        thread::spawn(move || {
            let request = read_request(&mut socket);
            let line = request.lines().next().unwrap_or_default().to_string();
            use std::io::Write;
            if line.starts_with("GET /api/session ") {
                let body = format!(
                    r#"{{"data":[{{"id":"{SAVED}","title":"Разбор мебели","time":{{"updated":1760000000000}}}}],"cursor":null}}"#
                );
                let _ = socket.write_all(json_head(&body).as_bytes());
                return;
            }
            if line.starts_with("POST /api/session ") {
                creates.fetch_add(1, Ordering::SeqCst);
                let _ = socket.write_all(json_head(&format!(r#"{{"data":{{"id":"{CREATED}"}}}}"#)).as_bytes());
                return;
            }
            if line.contains("/prompt") {
                *last_prompt.lock().expect("путь отправки") = line;
                let _ = socket.write_all(json_head(r#"{"data":{"id":"msg_check"}}"#).as_bytes());
                return;
            }
            // Поток событий держится открытым, пока идёт проверка.
            let _ = socket.write_all(chunked_head().as_bytes());
            thread::sleep(Duration::from_secs(30));
        });
    }
}

/// Поднять сервер и дождаться его порт: (порт, счётчик создания, путь промта).
fn start_server() -> (Arc<Mutex<u16>>, Arc<AtomicUsize>, Arc<Mutex<String>>) {
    let port = Arc::new(Mutex::new(0u16));
    let creates = Arc::new(AtomicUsize::new(0));
    let last_prompt = Arc::new(Mutex::new(String::new()));
    thread::spawn({
        let (port, creates, last_prompt) = (Arc::clone(&port), Arc::clone(&creates), Arc::clone(&last_prompt));
        move || serve(port, creates, last_prompt)
    });
    while *port.lock().expect("порт") == 0 {
        thread::sleep(Duration::from_millis(10));
    }
    (port, creates, last_prompt)
}

/// Список живых сессий: обе созданные сессии видны, разбор сырого ответа движка
/// и правило возврата работают без ленты (разбор списка, не сокет-детали).
#[test]
fn saved_session_found_in_live_list() {
    isolate_engine_data();
    let engine = Engine::start().expect("движок поднялся и /api/config ответил");
    let endpoint = engine.endpoint();
    let api = Api::new(&endpoint);
    let first = api.create_session("Разбор дерева файлов").expect("сессия создана");
    let second = api.create_session("Строгий чат").expect("создана вторая");

    let list = sessions(&api).expect("список живых сессий вернулся");
    assert!(
        list.iter().any(|item| item.id == first),
        "своя сессия есть в списке живых: {list:?}"
    );
    assert!(
        list.iter().any(|item| item.id == second),
        "вторая сессия тоже в списке живых: {list:?}"
    );

    // Сырой ответ движка — тот же список глазами состояния: разбор и поиск по id.
    let raw = serde_json::json!([
        {"id": first, "title": "Разбор дерева файлов", "time": {"updated": 1_760_000_000_000u64}},
        {"id": "ses_second"}
    ]);
    let parsed = parse_list(&raw);
    assert_eq!(parsed.len(), 2, "обе сессии разобраны из сырого ответа: {parsed:?}");
    assert!(
        resumed(&list, &first).is_some(),
        "правило возврата находит сохранённую сессию в списке"
    );
    assert!(
        resumed(&list, "ses_removed").is_none(),
        "сессии нет в списке — правило отвечает «нет»: приложение создаёт новую"
    );
}

/// Сохранённая сессия жива: лента берёт её из списка движка, создания нет,
/// вопрос уходит к ней, а файл состояния хранит запись прошлого запуска.
#[test]
fn feed_returns_to_saved_session_from_live_list() {
    let (port, creates, last_prompt) = start_server();
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());

    let file = scratch("saved");
    let store = Store::at(file.clone());
    store
        .patch(&StatePatch {
            session: Some(SAVED.to_string()),
            ..StatePatch::default()
        })
        .expect("прошлый запуск приложения запомнил сессию");

    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_saved(
        Box::new(Loopback { endpoint }),
        Arc::clone(&sink) as Arc<dyn Sink>,
        Some(Arc::new(store)),
    );
    chat.send(QUESTION, QUESTION).expect("вопрос ушёл");
    wait_for(&sink, QUESTION, WAIT);

    let prompt = last_prompt.lock().expect("путь отправки").clone();
    assert!(
        prompt.contains(SAVED),
        "вопрос уходит к сохранённой сессии, а не к новой: {prompt:?}"
    );
    assert_eq!(
        creates.load(Ordering::SeqCst),
        0,
        "сохранённая сессия жива в списке движка — создавать новую не нужно"
    );
    // Файл сессии не переписан: там запись прошлого запуска приложения.
    assert_eq!(
        Store::at(file).load().session.as_deref(),
        Some(SAVED),
        "сохранённая запись не подменена"
    );
}

/// Сохранённой сессии нет в списке движка: новая создана, запомнена в файле
/// состояния — при следующем запуске приложения она вернётся (правило «создаём»).
#[test]
fn feed_creates_and_remembers_session_without_saved_one() {
    let (port, creates, last_prompt) = start_server();
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());

    let file = scratch("fresh");
    let store = Store::at(file.clone());
    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_saved(
        Box::new(Loopback { endpoint }),
        Arc::clone(&sink) as Arc<dyn Sink>,
        Some(Arc::new(store)),
    );
    chat.send(QUESTION, QUESTION).expect("вопрос ушёл");
    wait_for(&sink, QUESTION, WAIT);

    let prompt = last_prompt.lock().expect("путь отправки").clone();
    assert!(
        prompt.contains(CREATED),
        "вопрос уходит к новой сессии: {prompt:?}"
    );
    assert_eq!(
        creates.load(Ordering::SeqCst),
        1,
        "новая сессия создана ровно один раз на запуск"
    );
    assert_eq!(
        Store::at(file).load().session.as_deref(),
        Some(CREATED),
        "новая сессия запомнена в файле состояния"
    );
}
