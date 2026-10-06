//! Обрыв потока и переподключение: строка вопроса владельца не начинается заново.
//!
//! Мост здесь настоящий (`Chat`), движок и сервер — свои: обрыв потока ловится без
//! живого opencode и без ключей владельца. Проверка идёт по открытому интерфейсу
//! (`Chat::send`, `Sink`), как это делает окно.

use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

mod common;

use common::read_request;
use gnomecode_lib::opencode::client::{Endpoint, FeedEvent, RowKind};
use gnomecode_lib::opencode::{Chat, EngineLife, Sink};

const QUESTION: &str = "Проверь мост";
const RECONNECT: &str = "Поток прерван, переподключаюсь…";
/// Предел ожидания строки ленты: медленный компьютер — не поломка.
const WAIT: Duration = Duration::from_secs(10);

/// Лента проверки: строки моста собираются в список, как их увидит окно.
#[derive(Default)]
struct ListSink(Mutex<Vec<FeedEvent>>);

impl Sink for ListSink {
    fn emit(&self, event: FeedEvent) {
        self.0.lock().expect("список строк").push(event);
    }
}

impl ListSink {
    fn rows(&self) -> Vec<FeedEvent> {
        self.0.lock().expect("список строк").clone()
    }
}

/// Движок проверки: сервер в этом же тесте, «падать» ему не нужно.
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

/// Строки вопроса владельца: `(id, текст)` — как их сложит лента окна.
fn questions(sink: &ListSink) -> Vec<(String, String)> {
    sink.rows()
        .into_iter()
        .filter_map(|row| match row {
            FeedEvent::Row {
                id,
                kind: RowKind::User,
                text,
                ..
            } => Some((id, text)),
            _ => None,
        })
        .collect()
}

fn seen(sink: &ListSink, needle: &str) -> bool {
    sink.rows().iter().any(|row| match row {
        FeedEvent::Row { text, .. } => text.contains(needle),
        FeedEvent::Append { delta, .. } => delta.contains(needle),
        FeedEvent::Reset => false,
    })
}

/// Ждать строку ленты: пока не появилась — ждём, потом падаем с тем, что есть.
fn wait_for(sink: &ListSink, needle: &str) {
    let deadline = Instant::now() + WAIT;
    while Instant::now() < deadline {
        if seen(sink, needle) {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    let rows: Vec<String> = sink
        .rows()
        .into_iter()
        .filter_map(|row| match row {
            FeedEvent::Row { text, .. } => Some(text),
            FeedEvent::Append { delta, .. } => Some(delta),
            FeedEvent::Reset => None,
        })
        .collect();
    panic!("в ленте нет «{needle}» за {WAIT:?}: {rows:?}");
}

fn chunked_head() -> &'static str {
    "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n"
}

fn json_head(body: &str) -> String {
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

/// Сервер проверки: сессия, отправка текста и поток событий. Первый поток обрывается
/// сам — это и есть падение сервера для ленты; второй держится и ждёт дальше.
fn serve(port_holder: Arc<Mutex<u16>>, streams: Arc<AtomicUsize>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    *port_holder.lock().expect("порт") = listener.local_addr().expect("адрес").port();
    for socket in listener.incoming() {
        let Ok(mut socket) = socket else {
            return;
        };
        let round = streams.fetch_add(1, Ordering::SeqCst);
        thread::spawn(move || {
            let request = read_request(&mut socket);
            let line = request.lines().next().unwrap_or_default().to_string();
            use std::io::Write;
            if line.starts_with("POST /api/session ") {
                let _ = socket.write_all(json_head(r#"{"data":{"id":"ses_fixture"}}"#).as_bytes());
                return;
            }
            if line.contains("/prompt") {
                let _ = socket.write_all(json_head(r#"{"data":{"id":"msg_fixture"}}"#).as_bytes());
                return;
            }
            let _ = socket.write_all(chunked_head().as_bytes());
            if round < 2 {
                // Первый поток молчит и обрывается: лента должна переподключиться.
                thread::sleep(Duration::from_millis(200));
                return;
            }
            // Дальше поток просто держится открытым, пока идёт проверка.
            thread::sleep(Duration::from_secs(30));
        });
    }
}

/// Два одинаковых вопроса через обрыв потока — две строки, а не одна заменённая.
#[test]
fn user_row_id_is_not_restarted_after_a_stream_break() {
    let port = Arc::new(Mutex::new(0u16));
    let streams = Arc::new(AtomicUsize::new(0));
    thread::spawn({
        let port = Arc::clone(&port);
        let streams = Arc::clone(&streams);
        move || serve(port, streams)
    });
    while *port.lock().expect("порт") == 0 {
        thread::sleep(Duration::from_millis(10));
    }
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());

    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_engine(Box::new(Loopback { endpoint }), Arc::clone(&sink) as Arc<dyn Sink>);

    chat.send(QUESTION, QUESTION, &[], None).expect("первый вопрос ушёл");
    wait_for(&sink, QUESTION);

    wait_for(&sink, RECONNECT);

    chat.send(QUESTION, QUESTION, &[], None).expect("второй вопрос ушёл");
    let deadline = Instant::now() + WAIT;
    while questions(&sink).len() < 2 && Instant::now() < deadline {
        thread::sleep(Duration::from_millis(20));
    }

    let rows = questions(&sink);
    assert_eq!(
        rows.len(),
        2,
        "после обрыва оба вопроса владельца остаются в ленте: {rows:?}"
    );
    assert!(
        rows.iter().all(|(_, text)| text == QUESTION),
        "обе строки — это заданный вопрос: {rows:?}"
    );
    assert_ne!(
        rows[0].0, rows[1].0,
        "идентификатор строки вопроса не начинается заново после обрыва: {rows:?} — иначе лента \
         сложит два одинаковых вопроса в одну строку"
    );
}
