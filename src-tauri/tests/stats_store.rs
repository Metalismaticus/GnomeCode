//! Сбор расхода в stats.jsonl (docs/BATCH.md, пункт 2, шаг «сбор»).
//!
//! Постоянные тесты: одна строка на завершённый шаг модели, повтор события не
//! дублирует, обрыв потока и рестарт движка записанное не теряют, испорченный
//! файл — норма. Живая форма события закреплена кадрами, захваченными зондом
//! на движке v2.0.25 (2026-10-09) — константы `STEP_STARTED_LIVE`/`STEP_ENDED_LIVE`.
//!
//! Зонд живого SSE (`live_sse_usage_probe`, `--ignored`) крутит живой движок
//! против локального OpenAI-совместимого mock-сервера: ответ модели идёт по
//! настоящему циклу движка, а usage-события `/api/event` захватываются сырыми
//! кадрами. Запуск:
//! cargo test --manifest-path src-tauri/Cargo.toml --test stats_store -- --ignored --nocapture

use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use gnomecode_lib::opencode::client::{
    Cache, Endpoint, Feed, ModelRef, ServerEvent, StepEnded, StepStarted, Tokens,
};
use gnomecode_lib::state::{StatePatch, Store};
use gnomecode_lib::stats::Recorder;
use gnomecode_lib::opencode::engine::{locate, Engine};

/// Шаг, как его прислал живой движок v2.0.25 (замер 2026-10-09, зонд ниже):
/// верхний уровень — id/created/location/durable, расход — в `data`.
const STEP_STARTED_LIVE: &str = r#"{"id":"evt_120b687c5001t3MnkkQSLnoAHn","created":1791550195653,"type":"session.step.started","location":{"directory":"C:\\repo"},"data":{"sessionID":"ses_probe","agent":"studio","model":{"id":"probe-model","providerID":"probe-local","variant":"default"},"assistantMessageID":"msg_probe","snapshot":"058b29aec9aa122b03714e62ae183452da65a769","started":1791550195645},"durable":{"aggregateID":"ses_probe","seq":6,"version":1}}"#;
const STEP_ENDED_LIVE: &str = r#"{"id":"evt_120b6880b001XAe258QI2G7yGa","created":1791550195723,"type":"session.step.ended","location":{"directory":"C:\\repo"},"data":{"sessionID":"ses_probe","assistantMessageID":"msg_probe","finish":"stop","rawFinish":"stop","cost":0,"tokens":{"input":8,"output":5,"reasoning":2,"cache":{"read":3,"write":0}},"snapshot":"058b29aec9aa122b03714e62ae183452da65a769","files":[]},"durable":{"aggregateID":"ses_probe","seq":10,"version":1}}"#;

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-stats-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }

    fn file(&self, name: &str) -> PathBuf {
        self.0.join(name)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Хранилище окна с проектом: Recorder читает проект записи из state.
fn store_with_project(path: PathBuf, project: &str) -> Arc<Store> {
    let store = Arc::new(Store::at(path));
    store
        .patch(&StatePatch {
            project: Some(project.to_string()),
            ..StatePatch::default()
        })
        .expect("проект записан в state");
    store
}

fn started(session: &str, message: &str, provider: &str, model: &str, at: u64) -> ServerEvent {
    ServerEvent::StepStarted {
        data: StepStarted {
            session: session.to_string(),
            message: message.to_string(),
            model: Some(ModelRef {
                id: model.to_string(),
                provider: provider.to_string(),
            }),
            started: at,
        },
    }
}

fn ended(session: &str, message: &str, input: f64, output: f64, cost: f64) -> ServerEvent {
    ServerEvent::StepEnded {
        data: StepEnded {
            session: session.to_string(),
            message: message.to_string(),
            cost,
            tokens: Tokens {
                input,
                output,
                reasoning: 0.0,
                cache: Cache {
                    read: 0.0,
                    write: 0.0,
                },
            },
        },
    }
}

fn unix_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|span| span.as_millis() as u64)
        .unwrap_or(0)
}

/// Записи stats.jsonl как JSON: строки без JSON (мусор в испорченном файле —
/// норма) пропускает, по записям проверяющий сверяет поля.
fn stored(file: &std::path::Path) -> Vec<serde_json::Value> {
    std::fs::read_to_string(file)
        .unwrap_or_default()
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect()
}

const SESSION: &str = "ses_mine";

/// Живые кадры движка разбираются в типы и записываются одной строкой расхода.
#[test]
fn live_frames_parse_into_one_row() {
    let data = TempDir::new("live-frames");
    let file = data.file("stats.jsonl");
    let mut usage = Recorder::at(file.clone(), None);
    let began = ServerEvent::parse(STEP_STARTED_LIVE);
    let over = ServerEvent::parse(STEP_ENDED_LIVE);
    assert!(
        !matches!(began, ServerEvent::Other) && !matches!(over, ServerEvent::Other),
        "живые кадры v2.0.25 разбираются в типы, а не в Other"
    );
    usage.observe(&began, "ses_probe");
    usage.observe(&over, "ses_probe");

    let rows = stored(&file);
    assert_eq!(rows.len(), 1, "завершённый шаг — одна строка: {rows:?}");
    let row = &rows[0];
    assert_eq!(row["session"], "ses_probe");
    assert_eq!(row["provider"], "probe-local");
    assert_eq!(row["model"], "probe-model");
    assert_eq!(row["input"], 8.0);
    assert_eq!(row["output"], 5.0);
    assert_eq!(row["reasoning"], 2.0);
    assert_eq!(row["cache_read"], 3.0);
    assert_eq!(row["cache_write"], 0.0);
    assert_eq!(row["cost"], 0.0);
    assert!(row["time"].as_u64().unwrap_or(0) >= 1791550195723, "время — момент записи");
}

/// Одна строка на сообщение: длительность — от отправки шага, проект — из state.
#[test]
fn one_row_per_message_with_duration_and_project() {
    let data = TempDir::new("one-row");
    let file = data.file("stats.jsonl");
    let store = store_with_project(data.file("state.json"), "C:\\proj");
    let mut usage = Recorder::at(file.clone(), Some(store));

    let dispatch = unix_ms().saturating_sub(5_000);
    usage.observe(&started(SESSION, "msg_a", "lab", "model-x", dispatch), SESSION);
    usage.observe(&ended(SESSION, "msg_a", 100.0, 20.0, 0.5), SESSION);

    let rows = stored(&file);
    assert_eq!(rows.len(), 1, "один шаг — одна строка: {rows:?}");
    let row = &rows[0];
    assert_eq!(row["provider"], "lab");
    assert_eq!(row["model"], "model-x");
    assert_eq!(row["project"], "C:\\proj");
    assert_eq!(row["input"], 100.0);
    assert_eq!(row["cost"], 0.5);
    let duration = row["duration_ms"].as_u64().unwrap_or(0);
    assert!(
        (4_000..60_000).contains(&duration),
        "длительность — от отправки до записи: {duration}"
    );
}

/// Повтор события того же шага строку не дублирует; следующий шаг — новую пишет.
#[test]
fn repeated_ended_does_not_duplicate() {
    let data = TempDir::new("dedup");
    let file = data.file("stats.jsonl");
    let mut usage = Recorder::at(file.clone(), None);
    usage.observe(&started(SESSION, "msg_a", "lab", "m", unix_ms()), SESSION);
    usage.observe(&ended(SESSION, "msg_a", 1.0, 2.0, 0.0), SESSION);
    // Обрыв потока и возврат того же события — вторая строка не пишется.
    usage.observe(&ended(SESSION, "msg_a", 1.0, 2.0, 0.0), SESSION);
    assert_eq!(stored(&file).len(), 1, "повтор шага не дублирует запись");

    usage.observe(&started(SESSION, "msg_b", "lab", "m", unix_ms()), SESSION);
    usage.observe(&ended(SESSION, "msg_b", 3.0, 4.0, 0.0), SESSION);
    let rows = stored(&file);
    assert_eq!(rows.len(), 2, "следующий шаг — своя строка: {rows:?}");
    assert_eq!(rows[1]["input"], 3.0, "вторая строка — про свой шаг");
}

/// Обрыв потока и рестарт движка: записанное остаётся в файле, задвоения нет.
#[test]
fn break_and_restart_keep_rows_unique() {
    let data = TempDir::new("restart");
    let file = data.file("stats.jsonl");
    let mut usage = Recorder::at(file.clone(), None);
    usage.observe(&started(SESSION, "msg_a", "lab", "m", unix_ms()), SESSION);
    usage.observe(&ended(SESSION, "msg_a", 1.0, 1.0, 0.0), SESSION);
    // Обрыв потока: писатель переживает, поток поднимается заново (новый Recorder
    // не создаётся — see supervise), движок перезапускается, дубликат шага приходит.
    usage.observe(&ended(SESSION, "msg_a", 1.0, 1.0, 0.0), SESSION);
    usage.observe(&started(SESSION, "msg_b", "lab", "m", unix_ms()), SESSION);
    usage.observe(&ended(SESSION, "msg_b", 2.0, 2.0, 0.0), SESSION);
    let rows = stored(&file);
    assert_eq!(rows.len(), 2, "после обрыва и рестарта: старое цело, дублей нет: {rows:?}");
    assert_eq!(rows[0]["input"], 1.0, "первая строка пережила обрыв");
}

/// Шаг без увиденного начала (обрыв до конца ответа) пишется с последней
/// известной моделью сессии и нулевой длительностью — расход не теряется.
#[test]
fn ended_without_started_uses_last_known_model() {
    let data = TempDir::new("no-started");
    let file = data.file("stats.jsonl");
    let mut usage = Recorder::at(file.clone(), None);
    usage.observe(&started(SESSION, "msg_a", "lab", "old", unix_ms()), SESSION);
    usage.observe(&ended(SESSION, "msg_lost", 7.0, 7.0, 0.0), SESSION);
    let rows = stored(&file);
    assert_eq!(rows.len(), 1, "расход шага без начала записывается: {rows:?}");
    assert_eq!(rows[0]["model"], "old", "модель — последняя известная в сессии");
    assert_eq!(rows[0]["provider"], "lab");
    assert_eq!(rows[0]["duration_ms"], 0, "отправку не видели — длительность честный ноль");

    // Сессия без единого шага: пустые провайдер и модель, строка всё равно пишется.
    usage.observe(&ended("ses_other", "msg_x", 1.0, 1.0, 0.0), "ses_other");
    let rows = stored(&file);
    assert_eq!(rows.len(), 2);
    assert_eq!(rows[1]["provider"], "");
    assert_eq!(rows[1]["model"], "");
}

/// Чужие сессии и события не про расход строк не создают; испорченный файл —
/// норма: запись дописывается после мусора, недоступный файл ленту не рвёт.
#[test]
fn foreign_events_and_corrupted_file_are_normal() {
    let data = TempDir::new("corrupt");
    let file = data.file("stats.jsonl");
    std::fs::write(&file, "мусор без формата\n").expect("мусор записан");
    let mut usage = Recorder::at(file.clone(), None);

    usage.observe(&started("ses_other", "msg_a", "lab", "m", unix_ms()), SESSION);
    usage.observe(&ended("ses_other", "msg_a", 1.0, 1.0, 0.0), SESSION);
    assert_eq!(stored(&file).len(), 0, "чужая сессия строк не пишет");

    usage.observe(&started(SESSION, "msg_a", "lab", "m", unix_ms()), SESSION);
    usage.observe(&ended(SESSION, "msg_a", 1.0, 1.0, 0.0), SESSION);
    let lines = std::fs::read_to_string(&file).expect("файл читается");
    let written: Vec<&str> = lines.lines().collect();
    assert_eq!(written.len(), 2, "мусор остался, запись дописалась: {written:?}");
    assert!(serde_json::from_str::<serde_json::Value>(written[1]).is_ok(), "вторая строка — JSON");

    // Путь, куда не записать (родитель — файл): ошибки глотаются, паники нет.
    let blocker = data.file("занято");
    std::fs::write(&blocker, "файл").expect("файл-преграда создан");
    let mut sealed = Recorder::at(blocker.join("stats.jsonl"), None);
    sealed.observe(&ended(SESSION, "msg_b", 1.0, 1.0, 0.0), SESSION);
}

/// Лента не меняется: расход — отдельный потребитель, строк ленты step.ended не даёт.
#[test]
fn feed_rows_unchanged_by_step_ended() {
    let mut feed = Feed::default();
    assert!(
        feed.apply(&ended(SESSION, "msg_a", 1.0, 1.0, 0.0), SESSION).is_empty(),
        "расход не создаёт строк ленты"
    );
    assert!(
        !feed.apply(&started(SESSION, "msg_a", "lab", "m", unix_ms()), SESSION).is_empty(),
        "начало шага по-прежнему открывает строку ответа"
    );
}

const DEADLINE_SECS: u64 = 150;

fn isolate_data() {
    let base = std::env::temp_dir().join(format!("gnomecode-stats-probe-{}", std::process::id()));
    for key in ["XDG_DATA_HOME", "XDG_CONFIG_HOME"] {
        std::fs::create_dir_all(base.join(key)).expect("папка движка создана");
        std::env::set_var(key, base.join(key));
    }
}

/// Лог артефакта: %TEMP%/opencode/stats-sse-probe.log
fn artifact() -> std::path::PathBuf {
    std::env::var_os("TEMP")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir)
        .join("opencode")
        .join("stats-sse-probe.log")
}

/// OpenAI-совместимый mock: POST /v1/chat/completions → SSE-поток с usage,
/// остальное — пустой JSON. Close-delimited: тело до закрытия сокета.
fn serve_openai() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("mock: свободный порт");
    let port = listener.local_addr().expect("mock: адрес").port();
    std::thread::spawn(move || {
        for socket in listener.incoming().flatten() {
            std::thread::spawn(move || {
                let mut socket = socket;
                let mut raw = Vec::new();
                let mut one = [0u8; 1];
                loop {
                    if read_one(&mut socket, &mut one) != 1 {
                        return;
                    }
                    raw.push(one[0]);
                    if raw.ends_with(b"\r\n\r\n") {
                        break;
                    }
                    if raw.len() > 256 * 1024 {
                        return;
                    }
                }
                let head = String::from_utf8_lossy(&raw).to_string();
                let length: usize = head
                    .lines()
                    .find_map(|l| l.strip_prefix("Content-Length: "))
                    .and_then(|v| v.trim().parse().ok())
                    .unwrap_or(0);
                let mut body = vec![0u8; length.max(1)];
                if read_exact(&mut socket, &mut body[..length]) != length {
                    return;
                }
                log(&format!(
                    "--- mock принял: {}{}",
                    head.lines().next().unwrap_or_default(),
                    String::from_utf8_lossy(&body[..length])
                ));

                let usage = r#""usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18,"prompt_tokens_details":{"cached_tokens":3},"completion_tokens_details":{"reasoning_tokens":2}}"#;
                let chunk1 = "data: {\"id\":\"chatcmpl-probe\",\"object\":\"chat.completion.chunk\",\"created\":1700000000,\"model\":\"probe-model\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"понг\"},\"finish_reason\":null}]}\n\n";
                let chunk2 = format!(
                    "data: {{\"id\":\"chatcmpl-probe\",\"object\":\"chat.completion.chunk\",\"created\":1700000000,\"model\":\"probe-model\",\"choices\":[{{\"index\":0,\"delta\":{{}},\"finish_reason\":\"stop\"}}],{usage}}}\n\n"
                );
                let payload = format!("{chunk1}{chunk2}data: [DONE]\n\n");
                let answer = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nConnection: close\r\n\r\n{payload}"
                );
                let _ = socket.write_all(answer.as_bytes());
                let _ = socket.flush();
                // Движок дочитывает поток: сокет держим открытым чуть дольше.
                std::thread::sleep(Duration::from_millis(500));
            });
        }
    });
    port
}

fn read_one(socket: &mut std::net::TcpStream, one: &mut [u8; 1]) -> usize {
    loop {
        match socket.read(one) {
            Ok(n) => return n,
            Err(ref e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => return 0,
        }
    }
}

fn read_exact(socket: &mut std::net::TcpStream, out: &mut [u8]) -> usize {
    let mut done = 0usize;
    while done < out.len() {
        match socket.read(&mut out[done..]) {
            Ok(0) | Err(_) => break,
            Ok(n) => done += n,
        }
    }
    done
}

fn log(text: &str) {
    if let Some(parent) = artifact().parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(artifact()) {
        let _ = writeln!(file, "{text}");
    }
    println!("{text}");
}

/// Побайтовый захват SSE с ручной разборкой chunked-обвязки (дисциплина
/// client.rs::chunk_header: `BufReader::read_line` на таймауте теряет хвост
/// строки — здесь читается сырой байт, терять нечего). HTTP-заголовки ответа
/// пропускаются до первой chunked-строки размера.
fn capture_frames(mut socket: std::net::TcpStream, deadline: Instant, stop: &AtomicBool) -> Vec<String> {
    let _ = socket.set_read_timeout(Some(Duration::from_millis(300)));
    let mut lines: Vec<String> = Vec::new();
    let mut line: Vec<u8> = Vec::new();
    let mut size_hex: Vec<u8> = Vec::new();
    let mut left: u64 = 0;
    #[derive(PartialEq)]
    enum Phase {
        Head,
        Size,
        Body,
        ChunkEnd,
        Trailer,
    }
    let mut phase = Phase::Head;
    let mut head: Vec<u8> = Vec::new();
    let mut one = [0u8; 1];
    loop {
        if Instant::now() >= deadline || stop.load(Ordering::SeqCst) {
            break;
        }
        match socket.read(&mut one) {
            Ok(0) => break,
            Ok(1) => {}
            Ok(_) => unreachable!("????? ?????? ?????"),
            Err(ref e)
                if e.kind() == std::io::ErrorKind::WouldBlock
                    || e.kind() == std::io::ErrorKind::TimedOut =>
            {
                continue
            }
            Err(_) => break,
        }
        let byte = one[0];
        match phase {
            Phase::Head => {
                head.push(byte);
                if head.ends_with(b"\r\n\r\n") {
                    log(&format!(
                        "--- голова потока: {}",
                        String::from_utf8_lossy(&head).replace("\r\n", " | ")
                    ));
                    head.clear();
                    phase = Phase::Size;
                } else if head.len() > 64 * 1024 {
                    break;
                }
            }
            Phase::Size => {
                if byte == b'\n' {
                    let text = String::from_utf8_lossy(&size_hex).to_string();
                    let size_text = text.trim().split(';').next().unwrap_or("").trim();
                    left = u64::from_str_radix(size_text, 16).unwrap_or(0);
                    size_hex.clear();
                    phase = if left == 0 { Phase::Trailer } else { Phase::Body };
                } else if byte != b'\r' {
                    size_hex.push(byte);
                }
            }
            Phase::Body => {
                left -= 1;
                if byte == b'\n' {
                    line.push(byte);
                    let text = String::from_utf8_lossy(&line).trim_end().to_string();
                    if !text.is_empty() {
                        lines.push(text);
                    }
                    line.clear();
                } else {
                    line.push(byte);
                }
                if left == 0 {
                    phase = Phase::ChunkEnd;
                    if !line.is_empty() {
                        let text = String::from_utf8_lossy(&line).trim_end().to_string();
                        if !text.is_empty() {
                            lines.push(text);
                        }
                        line.clear();
                    }
                }
            }
            Phase::ChunkEnd => {
                if byte == b'\n' {
                    phase = Phase::Size;
                }
            }
            Phase::Trailer => {
                if byte == b'\n' {
                    if line.is_empty() {
                        break;
                    }
                    line.clear();
                } else {
                    line.push(byte);
                }
            }
        }
    }
    if !line.is_empty() {
        let text = String::from_utf8_lossy(&line).trim_end().to_string();
        if !text.is_empty() {
            lines.push(text);
        }
    }
    lines
}

fn basic_auth(pair: &str) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = pair.as_bytes();
    let mut out = String::new();
    for part in bytes.chunks(3) {
        let triple = [
            part[0],
            *part.get(1).unwrap_or(&0),
            *part.get(2).unwrap_or(&0),
        ];
        let packed = (u32::from(triple[0]) << 16) | (u32::from(triple[1]) << 8) | u32::from(triple[2]);
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

/// Сырой POST на живой движок: тот же путь, что у EventStream (сокет, Basic).
fn raw_post(endpoint: &Endpoint, path: &str, body: &str) -> String {
    let mut socket =
        std::net::TcpStream::connect((endpoint.host.as_str(), endpoint.port)).expect("POST подключился");
    let _ = socket.set_read_timeout(Some(Duration::from_secs(30)));
    let basic = basic_auth(&format!("opencode:{}", endpoint.password));
    let request = format!(
        "POST {path} HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {basic}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        endpoint.host,
        endpoint.port,
        body.len()
    );
    socket.write_all(request.as_bytes()).expect("POST ушёл");
    let mut answer = Vec::new();
    let _ = socket.read_to_end(&mut answer);
    String::from_utf8_lossy(&answer).to_string()
}

/// Живой замер: имя и форма usage-события на движке той же версии, что стоит
/// у владельца. Красное до правки: step.ended приходит и падает в Other.
#[test]
#[ignore]
fn live_sse_usage_probe() {
    isolate_data();
    let _ = std::fs::remove_file(artifact());
    let mock_port = serve_openai();
    let config = format!(
        r#"{{"$schema":"https://opencode.ai/config.json","providers":{{"probe-local":{{"name":"Probe","package":"@opencode/ai/providers/openai-compatible","settings":{{"baseURL":"http://127.0.0.1:{mock_port}/v1","apiKey":"sk-probe"}},"models":{{"probe-model":{{}}}}}}}}}}"#
    );
    log(&format!("--- mock на порту {mock_port}; конфиг: {config}"));

    let for_engine = Arc::new(config);
    let mut engine = Engine::start_with_config(Arc::new(move || Some((*for_engine).clone())))
        .expect("движок поднялся");
    let endpoint: Endpoint = engine.endpoint();

    let stop = Arc::new(AtomicBool::new(false));
    let stop_reader = Arc::clone(&stop);
    let read_endpoint = endpoint.clone();
    let shared: Arc<std::sync::Mutex<Vec<String>>> = Arc::new(std::sync::Mutex::new(Vec::new()));
    let shared_reader = Arc::clone(&shared);
    let reader = std::thread::spawn(move || {
        let mut socket =
            std::net::TcpStream::connect((read_endpoint.host.as_str(), read_endpoint.port))
                .expect("поток подключился");
        let _ = socket.set_read_timeout(Some(Duration::from_millis(300)));
        let basic = basic_auth(&format!("opencode:{}", read_endpoint.password));
        let request = format!(
            "GET /api/event HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {basic}\r\nAccept: text/event-stream\r\nConnection: keep-alive\r\n\r\n",
            read_endpoint.host, read_endpoint.port
        );
        socket
            .write_all(request.as_bytes())
            .expect("запрос потока ушёл");
        let frames = capture_frames(
            socket,
            Instant::now() + Duration::from_secs(DEADLINE_SECS),
            &stop_reader,
        );
        if let Ok(mut held) = shared_reader.lock() {
            *held = frames;
        }
    });

    let api = gnomecode_lib::opencode::client::Api::new(&endpoint);
    let session = api.create_session("Зонд статистики").expect("сессия создана");
    log(&format!("--- сессия: {session}"));
    // v2.0.25: модель живёт на сессии (POST /api/session/{id}/model), в теле
    // prompt её нет — замер 2026-10-09.
    let model_body = r#"{"model":{"providerID":"probe-local","id":"probe-model"}}"#;
    let answer = raw_post(&endpoint, &format!("/api/session/{session}/model"), model_body);
    log(&format!("--- модель сессии: {answer}"));
    let sent = api.prompt(&session, "Ответь одним словом: понг", None);
    log(&format!("--- prompt вернул: {sent:?}"));
    let wait_deadline = Instant::now() + Duration::from_secs(90);
    loop {
        if Instant::now() >= wait_deadline {
            log("--- предел ожидания выполнения");
            break;
        }
        let done = shared
            .lock()
            .map(|held| {
                held.iter().any(|line| {
                    line.contains("session.execution.succeeded")
                        || line.contains("session.execution.failed")
                        || line.contains("session.step.ended")
                })
            })
            .unwrap_or(false);
        if done {
            log("--- выполнение завершено, добираем хвост потока");
            std::thread::sleep(Duration::from_millis(1500));
            break;
        }
        std::thread::sleep(Duration::from_millis(500));
    }
    stop.store(true, Ordering::SeqCst);
    let _ = reader.join();
    let frames = shared.lock().map(|held| held.clone()).unwrap_or_default();
    log(&format!("--- хвост движка: {}", engine.log_tail()));

    log("--- события потока:");
    let mut others = 0usize;
    let mut step_ended_raw: Option<String> = None;
    for frame in &frames {
        let payload = frame.trim_start_matches("data:").trim();
        if payload.is_empty() {
            log(frame);
            continue;
        }
        if let ServerEvent::Other = ServerEvent::parse(payload) {
            others += 1;
        }
        if payload.contains("session.step.ended") {
            step_ended_raw = Some(payload.to_string());
        }
    }
    for (index, frame) in frames.iter().enumerate() {
        log(&format!("{index:03}: {frame}"));
    }
    log(&format!(
        "--- итог: кадров {}; в Other: {}",
        frames.len(),
        others
    ));
    log(&format!("--- step.ended сырой: {:?}", step_ended_raw));
    engine.stop();

    let raw = step_ended_raw.expect("живой движок прислал session.step.ended");
    // Правка на месте: живой кадр разбирается в тип, и шаг ложится строкой
    // расхода — артефакт показывает фактические токены живого ответа.
    let ServerEvent::StepEnded { data } = ServerEvent::parse(&raw) else {
        panic!("живой session.step.ended не разобрался в тип: {raw}");
    };
    log(&format!(
        "--- живой расход: сессия {}, сообщение {}, cost {}, токены {:?}",
        data.session, data.message, data.cost, data.tokens
    ));
    let rows_file = artifact().with_file_name("stats-sse-probe.jsonl");
    let _ = std::fs::remove_file(&rows_file);
    let mut usage = Recorder::at(rows_file.clone(), None);
    for frame in &frames {
        let payload = frame.trim_start_matches("data:").trim();
        if payload.is_empty() {
            continue;
        }
        usage.observe(&ServerEvent::parse(payload), &data.session);
    }
    let stored = std::fs::read_to_string(&rows_file).unwrap_or_default();
    log(&format!("--- строка расхода из живого ответа: {stored}"));
    assert!(
        stored.contains(&data.session) && stored.contains("probe-local"),
        "живой шаг не записался в stats.jsonl зонда: {stored}"
    );
}

#[test]
#[ignore]
fn engine_found() {
    let found = locate().expect("движок найден");
    assert!(found.is_file(), "{} — не файл", found.display());
}
