//! Открытие старого чата кликом из сайдбара (карточка b20261009-p4b-openchats):
//! лента чистится событием `reset`, история выбранной сессии читается из ядра
//! (маршрут `GET /api/session/{id}/message`, живой замер v2.0.25 от 2026-10-10:
//! список идёт свежими сверху, страницы — курсором `cursor.next`, форма сообщения —
//! плоская `{id, time, type, text | content}` с частями `text`/`tool`),
//! вопрос после открытия уходит в ту же сессию, и всё это без строки
//! «Поток прерван, переподключаюсь…». Чата нет в списке движка — строка-уведомление,
//! сессия не меняется.
//!
//! Мост здесь настоящий (`Chat`), движок — loopback-сервер этого же теста:
//! команда окна идёт по тому же пути, что и в продукте (`Chat::open_chat` →
//! поток ленты → `Cmd::OpenChat`), а не через отдельный вызов для проверки.

use std::net::TcpListener;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

mod common;

use common::{chunked_head, json_head, read_request, wait_for, ListSink, Loopback};
use gnomecode_lib::opencode::client::{Endpoint, FeedEvent};
use gnomecode_lib::opencode::{Chat, NOTICE_OPEN_MISSED, Sink};
use gnomecode_lib::state::Store;

const OLD_QUESTION: &str = "Вопрос из старого чата";
const OLD_ANSWER: &str = "Ответ из старого чата";
const OLD_EARLY: &str = "Ранний ответ";
/// Строка вызова инструмента из истории: разбор части `tool` идёт через
/// `tool_line`/`summarize` — тот же вид, что у живой ленты.
const OLD_TOOL: &str = "✓ read · src/main.rs";
const FIRST: &str = "Первый вопрос до открытия";
const AFTER: &str = "Вопрос после открытия";
const AFTER_MISS: &str = "Вопрос после промаха мимо списка";
const GHOST: &str = "ses_ghost";
const RECONNECT: &str = "Поток прерван, переподключаюсь…";
/// Предел ожидания строки ленты: медленный компьютер — не поломка.
const WAIT: Duration = Duration::from_secs(15);

/// Сервер проверки: две сессии в списке живых, история `ses_one` — двумя
/// страницами (свежие сверху, вторая по курсору), создание сессий считает,
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
            if line.starts_with("GET /api/session ") {
                let body = format!(
                    r#"{{"data":[{{"id":"ses_one","title":"Разбор сайдбара","time":{{"updated":1760000000000}}}},{{"id":"ses_two","title":"Второй чат","time":{{"updated":1760000001000}}}}],"cursor":null}}"#
                );
                let _ = socket.write_all(json_head(&body).as_bytes());
                return;
            }
            if line.starts_with("POST /api/session ") {
                let n = sessions.fetch_add(1, Ordering::SeqCst) + 1;
                let _ = socket.write_all(
                    json_head(&format!(r#"{{"data":{{"id":"ses_fresh_{n}"}}}}"#)).as_bytes(),
                );
                return;
            }
            if line.starts_with("GET /api/session/ses_one/message") {
                // Страница истории: список идёт свежими сверху (замер v2.0.25),
                // вторая страница — по курсору, у последней следующего нет.
                let body = if line.contains("cursor=page-2") {
                    r#"{"data":[{"id":"msg_zero","time":{"created":1791632740000},"type":"assistant","content":[{"type":"tool","id":"call_1","name":"read","state":{"status":"completed","input":{"filePath":"src/main.rs"}}},{"type":"text","text":"Ранний ответ"}],"finish":"stop"}],"cursor":{}}"#.to_string()
                } else {
                    r#"{"data":[{"id":"msg_two","time":{"created":1791632755970},"type":"assistant","content":[{"type":"text","text":"Ответ из старого чата"}],"finish":"stop"},{"id":"msg_one","time":{"created":1791632740176},"text":"Вопрос из старого чата","type":"user"}],"cursor":{"next":"page-2"}}"#.to_string()
                };
                let _ = socket.write_all(json_head(&body).as_bytes());
                return;
            }
            if line.contains("/message") {
                // История остальных сессий пуста: у фиктивной сессии её тоже нет.
                let _ = socket.write_all(json_head(r#"{"data":[],"cursor":{}}"#).as_bytes());
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

/// Ждать событие `reset` в ленте: его шлют «новый чат» и открытие старого чата.
fn wait_for_reset(sink: &ListSink, wait: Duration) {
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        if sink.rows().iter().any(|event| matches!(event, FeedEvent::Reset)) {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    panic!("в ленте нет события reset за {wait:?} — открытие чата не дошло до ленты");
}

/// Ждать строку-уведомление с точным текстом (открытие мимо списка — уведомление).
fn wait_for_notice(sink: &ListSink, needle: &str, wait: Duration) {
    let deadline = Instant::now() + wait;
    while Instant::now() < deadline {
        let hit = sink.rows().iter().any(|event| matches!(
            event,
            FeedEvent::Row { kind: gnomecode_lib::opencode::client::RowKind::Notice, text, .. }
                if text.contains(needle)
        ));
        if hit {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    panic!("в ленте нет уведомления «{needle}» за {wait:?}: {:?}", common::texts(sink));
}

/// Открытие старого чата: история из ядра в ленте (страницы курсаором, старые
/// сверху), сессия переключена и запомнена, новый вопрос уходит в неё, без
/// «переподключаюсь»; промах мимо списка — уведомление, сессия на месте.
#[test]
fn open_chat_reads_history_and_switches_the_session() {
    let (port, sessions, last_prompt) = start_server();
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());

    let file =
        std::env::temp_dir().join(format!("gnomecode-chat-open-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&file);
    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_saved(
        Box::new(Loopback { endpoint }),
        Arc::clone(&sink) as Arc<dyn Sink>,
        Some(Arc::new(Store::at(file.clone()))),
    );

    // Живой чат до открытия: вопрос уходит к свежесозданной сессии.
    chat.send(FIRST, FIRST, &[], None).expect("первый вопрос ушёл");
    wait_for(&sink, FIRST, WAIT);
    prompt_session(&last_prompt, "ses_fresh_1", WAIT);

    // Открытие старого чата: reset, история двумя страницами, старые сверху.
    chat.open_chat("ses_one").expect("команда открытия ушла");
    wait_for_reset(&sink, WAIT);
    wait_for(&sink, OLD_TOOL, WAIT);
    wait_for(&sink, OLD_EARLY, WAIT);
    wait_for(&sink, OLD_QUESTION, WAIT);
    wait_for(&sink, OLD_ANSWER, WAIT);

    // Сессия переключена и запомнена: перезапуск приложения вернётся к ней.
    let saved = Store::at(file.clone()).load();
    assert_eq!(
        saved.session.as_deref(),
        Some("ses_one"),
        "открытый чат запомнен в состоянии окна"
    );

    // Новый вопрос уходит в открытый чат, а не в прошлую сессию.
    chat.send(AFTER, AFTER, &[], None).expect("вопрос после открытия ушёл");
    wait_for(&sink, AFTER, WAIT);
    let prompt = prompt_session(&last_prompt, "ses_one", WAIT);
    assert!(
        prompt.contains("ses_one"),
        "после открытия вопрос уходит в открытый чат: {prompt:?}"
    );
    assert_eq!(
        sessions.load(Ordering::SeqCst),
        1,
        "открытие старого чата не создаёт новых сессий"
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
        "открытие старого чата не роняет поток событий: в ленте нет строки «{RECONNECT}»: {lines:?}"
    );

    // Промах мимо списка движка: строка-уведомление, сессия не меняется —
    // следующий вопрос всё ещё уходит в открытый ранее чат.
    chat.open_chat(GHOST).expect("команда открытия мимо списка ушла");
    wait_for_notice(&sink, NOTICE_OPEN_MISSED, WAIT);
    let missed = Store::at(file).load();
    assert_eq!(
        missed.session.as_deref(),
        Some("ses_one"),
        "промах мимо списка не меняет открытую сессию"
    );
    chat.send(AFTER_MISS, AFTER_MISS, &[], None).expect("вопрос после промаха ушёл");
    wait_for(&sink, AFTER_MISS, WAIT);
    let prompt = prompt_session(&last_prompt, "ses_one", WAIT);
    assert!(
        prompt.contains("ses_one"),
        "после промаха вопрос уходит в прежний чат: {prompt:?}"
    );
}
