//! «Новый чат»: лента чистится событием `reset`, вопрос уходит к новой сессии,
//! и всё это без строки «Поток прерван, переподключаюсь…» — замечание владельца
//! 2026-10-06: «новый чат не могу создать».
//!
//! Мост здесь настоящий (`Chat`), движок — loopback-сервер этого же теста:
//! команда окна идёт по тому же пути, что и в продукте (`Chat::new_chat` →
//! поток ленты), а не через отдельный вызов для проверки.

use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

mod common;

use common::{chunked_head, json_head, read_request, wait_for, ListSink, Loopback};
use gnomecode_lib::opencode::client::{Endpoint, FeedEvent};
use gnomecode_lib::opencode::{Chat, Sink};
use gnomecode_lib::state::Store;

const QUESTION: &str = "Проверь новый чат";
const NEXT: &str = "Второй вопрос после нового чата";
const RECONNECT: &str = "Поток прерван, переподключаюсь…";
/// Предел ожидания строки ленты: медленный компьютер — не поломка.
const WAIT: Duration = Duration::from_secs(15);

/// Сервер проверки: создание сессии считает (каждая — своя `ses_chat_N`),
/// путь отправки запоминает — по нему видно, к какой сессии ушёл вопрос.
fn serve(port: Arc<Mutex<u16>>, sessions: Arc<AtomicUsize>, last_prompt: Arc<Mutex<String>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    *port.lock().expect("порт") = listener.local_addr().expect("адрес").port();
    for socket in listener.incoming() {
        let Ok(mut socket) = socket else { return };
        let sessions = Arc::clone(&sessions);
        let last_prompt = Arc::clone(&last_prompt);
        thread::spawn(move || {
            let request = read_request(&mut socket);
            let line = request.lines().next().unwrap_or_default().to_string();
            use std::io::Write;
            if line.starts_with("POST /api/session ") {
                let n = sessions.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = socket.write_all(
                    json_head(&format!(r#"{{"data":{{"id":"ses_chat_{n}"}}}}"#)).as_bytes(),
                );
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

/// Поднять сервер и дождаться его порт: (порт, счётчик сессий, путь промта).
fn start_server() -> (Arc<Mutex<u16>>, Arc<AtomicUsize>, Arc<Mutex<String>>) {
    let port = Arc::new(Mutex::new(0u16));
    let sessions = Arc::new(AtomicUsize::new(0));
    let last_prompt = Arc::new(Mutex::new(String::new()));
    thread::spawn({
        let (port, sessions, last_prompt) =
            (Arc::clone(&port), Arc::clone(&sessions), Arc::clone(&last_prompt));
        move || serve(port, sessions, last_prompt)
    });
    while *port.lock().expect("порт") == 0 {
        thread::sleep(Duration::from_millis(10));
    }
    (port, sessions, last_prompt)
}

/// Ждать, пока путь отправки укажет сессию `needle`: строка вопроса в ленте
/// появляется раньше POST, путь опаздывает на долю секунды.
fn prompt_session(last_prompt: &Mutex<String>, needle: &str, wait: Duration) -> String {
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        let path = last_prompt.lock().expect("путь отправки").clone();
        if path.contains(needle) {
            return path;
        }
        thread::sleep(Duration::from_millis(20));
    }
    let path = last_prompt.lock().expect("путь отправки").clone();
    panic!("путь отправки не указал сессию {needle} за {WAIT:?}: {path:?}");
}

/// Ждать событие `reset` в ленте: его шлёт только команда «новый чат».
fn wait_for_reset(sink: &ListSink, wait: Duration) {
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        if sink.rows().iter().any(|event| matches!(event, FeedEvent::Reset)) {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    panic!("в ленте нет события reset за {wait:?} — «новый чат» не дошёл до ленты");
}

/// «Новый чат»: `reset` в ленте, вторая сессия движка, ни одной строки
/// «переподключаюсь», новая сессия запомнена в состоянии окна.
#[test]
fn new_chat_clears_the_feed_and_opens_a_fresh_session() {
    let (port, sessions, last_prompt) = start_server();
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());

    let file =
        std::env::temp_dir().join(format!("gnomecode-chat-reset-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&file);
    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_saved(
        Box::new(Loopback { endpoint }),
        Arc::clone(&sink) as Arc<dyn Sink>,
        Some(Arc::new(Store::at(file.clone()))),
    );

    chat.send(QUESTION, QUESTION, &[], None).expect("первый вопрос ушёл");
    wait_for(&sink, QUESTION, WAIT);
    let first = prompt_session(&last_prompt, "ses_chat_1", WAIT);
    assert!(
        first.contains("ses_chat_1"),
        "до «нового чата» вопрос уходит к первой сессии: {first:?}"
    );

    chat.new_chat().expect("команда «новый чат» ушла");
    wait_for_reset(&sink, WAIT);

    chat.send(NEXT, NEXT, &[], None).expect("второй вопрос ушёл");
    wait_for(&sink, NEXT, WAIT);
    let second = prompt_session(&last_prompt, "ses_chat_2", WAIT);
    assert!(
        second.contains("ses_chat_2"),
        "после «нового чата» вопрос уходит к новой сессии, а не к прошлой: {second:?}"
    );
    assert_eq!(
        sessions.load(Ordering::SeqCst),
        2,
        "новая сессия создана ровно один раз на «новый чат»"
    );
    let lines: Vec<String> = sink
        .rows()
        .iter()
        .filter_map(|event| match event {
            FeedEvent::Row { text, .. } | FeedEvent::Append { delta: text, .. } => {
                Some(text.clone())
            }
            FeedEvent::Reset => None,
        })
        .collect();
    assert!(
        !lines.iter().any(|text| text.contains(RECONNECT)),
        "«новый чат» не роняет поток событий: в ленте нет строки «{RECONNECT}»: {lines:?}"
    );
    assert_eq!(
        Store::at(file).load().session.as_deref(),
        Some("ses_chat_2"),
        "новая сессия запомнена в состоянии окна — следующий запуск вернётся к ней"
    );
}
