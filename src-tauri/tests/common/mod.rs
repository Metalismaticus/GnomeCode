//! Общее для проверок моста: чтение запроса клиента целиком и лента-накопитель.
//!
//! Сервер в проверке — настоящий сокет, поэтому запрос надо дочитать до конца:
//! иначе сокет закроется с непрочитанными данными и клиент получит обрыв
//! вместо ответа.

use std::io::Read;
use std::net::TcpStream;
use std::time::{Duration, Instant};

use gnomecode_lib::opencode::client::{Endpoint, FeedEvent};
use gnomecode_lib::opencode::{EngineLife, Sink};

/// Запрос клиента: заголовки и тело по `Content-Length`.
pub fn read_request(socket: &mut TcpStream) -> String {
    let mut raw = Vec::new();
    let mut one = [0u8; 1];
    while let Ok(1) = socket.read(&mut one) {
        raw.push(one[0]);
        if raw.ends_with(b"\r\n\r\n") || raw.len() > 64 * 1024 {
            break;
        }
    }
    let head = String::from_utf8_lossy(&raw).to_string();
    let length: usize = head
        .lines()
        .find_map(|line| line.strip_prefix("Content-Length: "))
        .and_then(|value| value.trim().parse().ok())
        .unwrap_or(0);
    let mut body = vec![0u8; length];
    if length > 0 {
        let _ = socket.read_exact(&mut body);
    }
    format!("{head}{}", String::from_utf8_lossy(&body))
}

/// Кадры событий в chunked-обвязке, как отдаёт живой `opencode serve`.
pub fn chunked_head() -> &'static str {
    "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n"
}

/// Ответ с JSON-телом: сессии и сообщения движка приезжают такими.
pub fn json_head(body: &str) -> String {
    format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

/// Лента проверки: строки моста собираются в список, как их увидит окно.
#[derive(Default)]
pub struct ListSink(std::sync::Mutex<Vec<FeedEvent>>);

impl Sink for ListSink {
    fn emit(&self, event: FeedEvent) {
        self.0.lock().expect("список строк").push(event);
    }
}

impl ListSink {
    pub fn rows(&self) -> Vec<FeedEvent> {
        self.0.lock().expect("список строк").clone()
    }
}

/// Движок проверки: сервер в этом же тесте, «падать» ему не нужно.
pub struct Loopback {
    pub endpoint: Endpoint,
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

/// Строки ленты одним списком текстов: по ним ждут и проверяют.
pub fn texts(sink: &ListSink) -> Vec<String> {
    sink.rows()
        .into_iter()
        .map(|row| match row {
            FeedEvent::Row { text, .. } => text,
            FeedEvent::Append { delta, .. } => delta,
        })
        .collect()
}

/// Ждать строку ленты: пока не появилась — ждём, потом падаем с тем, что есть.
/// Медленный компьютер — не поломка, поэтому предел передаёт проверка.
pub fn wait_for(sink: &ListSink, needle: &str, wait: Duration) {
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        if texts(sink).iter().any(|text| text.contains(needle)) {
            return;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
    panic!("в ленте нет «{needle}» за {wait:?}: {:?}", texts(sink));
}
