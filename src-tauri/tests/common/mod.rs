//! Общее для проверок моста: чтение запроса клиента целиком, лента-накопитель,
//! фейковый raw.githubusercontent и своя временная папка.
//!
//! Сервер в проверке — настоящий сокет, поэтому запрос надо дочитать до конца:
//! иначе сокет закроется с непрочитанными данными и клиент получит обрыв
//! вместо ответа.

use std::io::Read;
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use gnomecode_lib::opencode::client::{Endpoint, FeedEvent};
use gnomecode_lib::opencode::{EngineLife, Sink};

static ISOLATED: AtomicBool = AtomicBool::new(false);

/// Изолировать данные движка для всего процесса: переменные окружения общие у всех
/// тестов одного процесса, второй раз ставить их нельзя — первый вызов уже сработал бы.
/// Иначе проверки создавали бы сессии в базе владельца (docs/TESTING.md, «Данные пользователя»).
pub fn isolate_engine_data() {
    if ISOLATED.swap(true, Ordering::SeqCst) {
        return;
    }
    let base = std::env::temp_dir().join(format!("gnomecode-engine-{}", std::process::id()));
    for key in ["XDG_DATA_HOME", "XDG_CONFIG_HOME"] {
        std::fs::create_dir_all(base.join(key)).expect("временная папка движка создана");
        std::env::set_var(key, base.join(key));
    }
}

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

/// Фейковый raw.githubusercontent на loopback (настоящий сокет, как отдаёт живой
/// GitHub): отвечает на GET по пути, тело индекса и тело файла плагина выбирает
/// очередность своих запросов — секвенция установщика: индекс → файл → новый индекс.
pub struct FakeGithub {
    /// `адрес хоста:порта` — база каталога для установщика.
    base: String,
}

impl FakeGithub {
    /// Поднять сервер: индекс отдаёт тела `index_bodies` по очереди (последнее —
    /// дальше), файл плагина — тела `file_bodies` по очереди (последнее — дальше).
    /// Тела живут весь тест — время потока сервера; тела в вызовах — константы.
    pub fn start(index_bodies: &'static [&'static str], file_bodies: &'static [&'static str]) -> FakeGithub {
        let listener = TcpListener::bind("127.0.0.1:0").expect("фейковый GitHub поднялся");
        let base = format!("http://{}", listener.local_addr().expect("адрес фейка"));
        let index_bodies: Vec<&str> = index_bodies.to_vec();
        let file_bodies: Vec<&str> = file_bodies.to_vec();
        std::thread::spawn(move || {
            let mut indexes = 0usize;
            let mut files = 0usize;
            for socket in listener.incoming().flatten() {
                let mut socket = socket;
                let request = read_request(&mut socket);
                let route = request.lines().next().unwrap_or_default().to_string();
                let (served, bodies) = if route.contains("index.json") {
                    indexes += 1;
                    (indexes, &index_bodies)
                } else {
                    files += 1;
                    (files, &file_bodies)
                };
                let body = bodies[bodies.len().saturating_sub(1).min(served.saturating_sub(1))];
                let reply = json_head(body);
                use std::io::Write;
                let _ = socket.write_all(reply.as_bytes());
                let _ = socket.flush();
            }
        });
        FakeGithub { base }
    }

    pub fn base(&self) -> &str {
        &self.base
    }

    /// Полный адрес индекса каталога: то, что установщик зовёт `install::fetch(source)`.
    pub fn index_url(&self) -> String {
        format!("{}/Metalismaticus/gnomecode-catalog/main/index.json", self.base)
    }
}

/// Своя временная папка на тест: проверить и данные движка, и файлы обновлений
/// там, не трогая данные владельца (docs/TESTING.md, «Данные пользователя»).
pub struct TempDir(PathBuf);

impl TempDir {
    pub fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-test-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }

    pub fn path(&self) -> &PathBuf {
        &self.0
    }

    pub fn join(&self, tail: &str) -> PathBuf {
        self.0.join(tail)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
