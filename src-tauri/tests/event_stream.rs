//! Поток событий по сокету: подключение, авторизация, чтение, обрыв и переподключение.
//!
//! Сервер в тесте — настоящий сокет на свободном порту: проверка идёт по тому же
//! пути, что и живой `opencode serve` (HTTP-запрос, chunked SSE, Basic-авторизация).
//! Проверка `tests/checks/opencode_client.py` гоняет эти тесты через `cargo test`.

use std::io::{Read, Write};
use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use gnomecode_lib::opencode::client::{
    Api, Endpoint, EventStream, Feed, FeedEvent, RowKind, ServerEvent, Step,
};

const SESSION: &str = "ses_fixture";
const PASSWORD: &str = "test-pass";
/// Значение, которого нет в правильном заголовке, — так проверка ловит свою ошибку.
const WRONG: &str = "неправильный пароль";

fn frames() -> Vec<String> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../tests/fixtures/chat-stream.jsonl"
    );
    let text = std::fs::read_to_string(path).expect("фикстура потока на месте");
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| chunk(&format!("data: {}\n\n", line.trim())))
        .collect()
}

fn chunked_head(status: &str) -> String {
    format!("HTTP/1.1 {status}\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n")
}

/// Кадр в chunked-обвязке — ровно так отдаёт живой `opencode serve`.
fn chunk(payload: &str) -> String {
    format!("{:x}\r\n{payload}\r\n", payload.len())
}

fn plain_head(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {status}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{body}",
        body.len()
    )
}

/// Прочитать запрос клиента до конца заголовков: иначе сервер закроет сокет с
/// непрочитанными данными, и клиент получит обрыв вместо ответа.
fn drain_request(socket: &mut std::net::TcpStream) -> String {
    let mut raw = Vec::new();
    let mut one = [0u8; 1];
    while let Ok(1) = socket.read(&mut one) {
        raw.push(one[0]);
        if raw.ends_with(b"\r\n\r\n") {
            break;
        }
        if raw.len() > 64 * 1024 {
            break;
        }
    }
    String::from_utf8_lossy(&raw).to_string()
}

/// Один поток событий: сервер отдаёт кадры и закрывает соединение.
#[test]
fn stream_reads_all_events_then_closes() {
    let served = frames();
    let expected = served.len();
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        let Ok((mut socket, _)) = listener.accept() else {
            return;
        };
        drain_request(&mut socket);
        let _ = socket.write_all(chunked_head("200 OK").as_bytes());
        for frame in served {
            if socket.write_all(frame.as_bytes()).is_err() {
                return;
            }
        }
    });
    let mut stream = EventStream::connect(&Endpoint::local(port, PASSWORD.to_string()))
        .expect("поток подключился");
    let mut seen = 0;
    // Тишина между кадрами — это ожидание, а не конец: крутимся, пока сервер не закроет сокет.
    loop {
        match stream.step() {
            Ok(Step::Event(event)) => {
                assert!(
                    !matches!(event, ServerEvent::Other),
                    "фикстура разобралась в типы, а не в Other"
                );
                seen += 1;
            }
            Ok(Step::Idle) => continue,
            Ok(Step::Closed) => break,
            Err(reason) => panic!("поток отдал ошибку вместо обрыва: {reason}"),
        }
    }
    assert_eq!(seen, expected, "поток отдал все события фикстуры");
}

/// Обрыв посередине: после разрыва поток подключается снова и лента продолжается.
#[test]
fn stream_reconnects_after_a_break() {
    let served = frames();
    let half = served.len() / 2;
    let connections = Arc::new(AtomicUsize::new(0));
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    let counter = Arc::clone(&connections);
    thread::spawn(move || {
        for _ in 0..2 {
            let Ok((mut socket, _)) = listener.accept() else {
                return;
            };
            let round = counter.fetch_add(1, Ordering::SeqCst) + 1;
            drain_request(&mut socket);
            let _ = socket.write_all(chunked_head("200 OK").as_bytes());
            // Первый поток обрывается на середине, второй отдаёт хвост.
            let slice = if round == 1 {
                &served[..half]
            } else {
                &served[half..]
            };
            for frame in slice {
                if socket.write_all(frame.as_bytes()).is_err() {
                    break;
                }
            }
        }
    });
    let endpoint = Endpoint::local(port, PASSWORD.to_string());

    let mut rows: Vec<FeedEvent> = Vec::new();
    let mut fold = Feed::default();
    for _ in 0..2 {
        let mut stream = match EventStream::connect(&endpoint) {
            Ok(stream) => stream,
            Err(reason) => panic!("поток не подключился после обрыва: {reason}"),
        };
        loop {
            match stream.step() {
                Ok(Step::Event(event)) => rows.extend(fold.apply(&event, SESSION)),
                Ok(Step::Idle) | Ok(Step::Closed) => break,
                Err(reason) => panic!("поток отдал ошибку вместо обрыва: {reason}"),
            }
        }
    }

    assert!(
        connections.load(Ordering::SeqCst) >= 2,
        "после обрыва поток подключился снова"
    );
    let answer: String = rows
        .iter()
        .filter_map(|row| match row {
            FeedEvent::Append { delta, .. } => Some(delta.clone()),
            _ => None,
        })
        .collect();
    assert_eq!(
        answer, "Смотрю структуру папки. Мост на месте.",
        "ленте не всё равно, был обрыв"
    );
    let tool = rows
        .iter()
        .filter_map(|row| match row {
            FeedEvent::Row {
                kind: RowKind::Tool,
                text,
                ..
            } => Some(text.clone()),
            _ => None,
        })
        .next_back()
        .unwrap_or_default();
    assert!(
        tool.starts_with("✓ read · src/bridge.ts"),
        "строка инструмента пережила обрыв: {tool:?}"
    );
}

/// Heartbeat и пустые кадры — не события: лента не должна ими забиваться.
#[test]
fn heartbeat_is_not_an_event() {
    let served = vec![": heartbeat\n\n".to_string(), "data: \n\n".to_string()];
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        let Ok((mut socket, _)) = listener.accept() else {
            return;
        };
        drain_request(&mut socket);
        let _ = socket.write_all(chunked_head("200 OK").as_bytes());
        for frame in served {
            let _ = socket.write_all(chunk(&frame).as_bytes());
        }
        // Соединение держим открытым и тело не завершаем: клиент должен ждать следующий
        // кадр, а не считать поток конченным.
        thread::sleep(Duration::from_millis(4000));
    });
    let mut stream = EventStream::connect(&Endpoint::local(port, PASSWORD.to_string()))
        .expect("поток подключился");
    for step_number in 1..=3 {
        let step = stream.step();
        assert!(
            matches!(step, Ok(Step::Idle)),
            "тишина и heartbeat — это ожидание, а не событие ленты: шаг {step_number} дал {step:?}"
        );
    }
    assert!(
        !matches!(stream.step(), Ok(Step::Closed)),
        "пока сервер держит соединение, поток считается живым"
    );
}

/// Имя пользователя Basic-авторизации — `opencode`, пароль — наш.
#[test]
fn request_carries_basic_authorization() {
    let seen = Arc::new(AtomicUsize::new(0));
    let marker = Arc::clone(&seen);
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        let Ok((mut socket, _)) = listener.accept() else {
            return;
        };
        let request = drain_request(&mut socket);
        let expected = format!(
            "Authorization: Basic {}",
            encode(&format!("opencode:{PASSWORD}"))
        );
        if request.contains(&expected) {
            marker.store(1, Ordering::SeqCst);
        }
        let _ = socket.write_all(chunked_head("200 OK").as_bytes());
        thread::sleep(Duration::from_millis(200));
    });
    let _ = EventStream::connect(&Endpoint::local(port, PASSWORD.to_string()))
        .expect("поток подключился");
    assert_eq!(
        seen.load(Ordering::SeqCst),
        1,
        "запрос потока несёт Basic opencode:<пароль>"
    );
    assert!(
        !encode(&format!("opencode:{PASSWORD}")).contains(WRONG),
        "пароль в заголовке — наш"
    );
}

/// 401 называется прямо: «сервер молчит» — плохая причина для неверного пароля.
#[test]
fn wrong_password_is_named_as_401() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        let Ok((mut socket, _)) = listener.accept() else {
            return;
        };
        drain_request(&mut socket);
        let _ = socket.write_all(plain_head("401 Unauthorized", "{\"error\":\"nope\"}").as_bytes());
    });
    match EventStream::connect(&Endpoint::local(port, WRONG.to_string())) {
        Ok(_) => panic!("поток с чужим паролем не должен подключаться"),
        Err(reason) => assert!(reason.contains("401"), "причина называет 401: {reason}"),
    }
}

/// Готовность сервера: 401 — тоже названная причина, а не «сервер не ответил».
#[test]
fn unauthorized_request_is_named() {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        let Ok((mut socket, _)) = listener.accept() else {
            return;
        };
        drain_request(&mut socket);
        let _ = socket.write_all(plain_head("401 Unauthorized", "{\"error\":\"nope\"}").as_bytes());
    });
    let endpoint = Endpoint::local(port, WRONG.to_string());
    match Api::new(&endpoint).ready() {
        Ok(()) => panic!("сервер без нашего пароля не должен считаться готовым"),
        Err(reason) => assert!(reason.contains("401"), "причина называет 401: {reason}"),
    }
}

/// Сессия и отправка текста идут по HTTP: без них лента не с кем говорить.
#[test]
fn session_and_prompt_go_over_http() {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let seen = Arc::clone(&requests);
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let port = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        for _ in 0..2 {
            let Ok((mut socket, _)) = listener.accept() else {
                return;
            };
            let head_text = drain_request(&mut socket);
            let length: usize = head_text
                .lines()
                .find_map(|line| line.strip_prefix("Content-Length: "))
                .and_then(|value| value.trim().parse().ok())
                .unwrap_or(0);
            let mut body = vec![0u8; length];
            let _ = socket.read_exact(&mut body);
            let text = format!("{head_text}{}", String::from_utf8_lossy(&body));
            if let Ok(mut log) = seen.lock() {
                log.push(text);
            }
            let answer = if head_text.starts_with("POST /api/session ") {
                "{\"data\":{\"id\":\"ses_created\"}}"
            } else {
                "{\"data\":{\"id\":\"msg_created\"}}"
            };
            let _ = socket.write_all(plain_head("200 OK", answer).as_bytes());
        }
    });
    let endpoint = Endpoint::local(port, PASSWORD.to_string());
    let api = Api::new(&endpoint);
    let session = api.create_session("GnomeCode").expect("сессия создана");
    assert_eq!(
        session, "ses_created",
        "идентификатор сессии берётся из ответа сервера"
    );
    api.prompt(&session, "Привет", None).expect("текст ушёл");
    let log = requests.lock().expect("лог запросов").clone();
    assert!(
        log.iter().any(
            |text| text.starts_with("POST /api/session/ses_created/prompt")
                && text.contains("Привет")
        ),
        "текст уходит в сессию: {log:?}"
    );
}

/// base64 из таблицы — копия клиента ради сравнения заголовка, а не крейт.
fn encode(input: &str) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    let mut out = String::new();
    for part in bytes.chunks(3) {
        let triple = [
            part[0],
            *part.get(1).unwrap_or(&0),
            *part.get(2).unwrap_or(&0),
        ];
        let packed =
            (u32::from(triple[0]) << 16) | (u32::from(triple[1]) << 8) | u32::from(triple[2]);
        for index in 0..=3 {
            if index <= part.len() {
                out.push(TABLE[((packed >> (18 - 6 * index)) & 0x3f) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}
