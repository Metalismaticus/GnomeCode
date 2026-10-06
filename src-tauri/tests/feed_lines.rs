// События движка, важные ленте. Формат OpenCode: `{"type": …, "data": {…}}`,
// поэтому у каждого варианта своё тело — это union, а не «any» (ADR-0001).
// Остальные события разбираются в `Other`: формат движка меняется, лента — нет.
//
// Слой прав вызовов плагинов (docs/SPEC/plugins.md, «Утверждённый UX одобрения»)
// проверяется здесь же через настоящий мост (`Chat::with_engine`): строка запуска
// «⧗ плагин · команда» и строка отказа «⚠ … requires approval» — его слова в ленте.

use gnomecode_lib::opencode::client::{Endpoint, Feed, FeedEvent, RowKind, ServerEvent, ToolError};
use gnomecode_lib::opencode::{Chat, Sink};
use gnomecode_lib::plugins::permissions::Grants;

use std::io::Write;
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

mod common;

use common::{ListSink, Loopback, read_request, wait_for};

const SESSION: &str = "ses_fixture";

fn fixture_events() -> Vec<ServerEvent> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../tests/fixtures/chat-stream.jsonl"
    );
    let text = std::fs::read_to_string(path).expect("фикстура потока на месте");
    text.lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| ServerEvent::parse(line.trim()))
        .collect()
}

/// Лента целиком: строки, как их увидит окно.
fn feed() -> Vec<FeedEvent> {
    let mut feed = Feed::default();
    let mut rows = Vec::new();
    for event in fixture_events() {
        rows.extend(feed.apply(&event, SESSION));
    }
    rows
}

fn rows_of_kind(kind: RowKind) -> Vec<String> {
    feed()
        .into_iter()
        .filter_map(|row| match row {
            FeedEvent::Row {
                kind: found, text, ..
            } if found == kind => Some(text),
            _ => None,
        })
        .collect()
}

fn appended(id: &str) -> String {
    feed()
        .into_iter()
        .filter_map(|row| match row {
            FeedEvent::Append { id: found, delta } if found == id => Some(delta),
            _ => None,
        })
        .collect()
}

fn answer_id() -> String {
    let rows = feed();
    rows.iter()
        .find_map(|row| match row {
            FeedEvent::Row {
                id,
                kind: RowKind::Assistant,
                ..
            } => Some(id.clone()),
            _ => None,
        })
        .expect("в ленте есть строка ответа")
}

#[test]
fn text_deltas_collect_into_one_answer() {
    let id = answer_id();
    assert_eq!(
        appended(&id),
        "Смотрю структуру папки. Мост на месте.",
        "дельты собираются в один ответ"
    );
    let answers = rows_of_kind(RowKind::Assistant);
    assert_eq!(
        answers.last().map(String::as_str),
        Some("Смотрю структуру папки. Мост на месте."),
        "ended отдаёт полный текст, а не пустую строку"
    );
}

#[test]
fn tool_call_shows_name_and_action() {
    let tools = rows_of_kind(RowKind::Tool);
    let last = tools.last().cloned().unwrap_or_default();
    assert!(
        last.starts_with("✓ read · src/bridge.ts"),
        "строка вызова инструмента называет действие, а не только факт: {last:?}"
    );
}

/// Файлы строки ленты: у строки `✓` файл, который она прочитала, — источник
/// ответа (phase2.md, 9.1); у запуска («⧗») его ещё нет.
fn files_of_kind(kind: RowKind) -> Vec<Option<String>> {
    feed()
        .into_iter()
        .filter_map(|row| match row {
            FeedEvent::Row { kind: found, file, .. } if found == kind => Some(file),
            _ => None,
        })
        .collect()
}

#[test]
fn done_tool_row_names_the_file_it_read() {
    let rows = files_of_kind(RowKind::Tool);
    assert_eq!(
        rows.last().cloned().flatten().as_deref(),
        Some("src/bridge.ts"),
        "строка «✓» несёт файл входа вызова (ключ filePath): {:?}",
        rows
    );
}

#[test]
fn running_tool_row_is_not_yet_a_source() {
    let rows = files_of_kind(RowKind::Tool);
    assert!(
        rows.iter()
            .rev()
            .skip(1)
            .all(|file| file.is_none()),
        "файл — источник только у исполненного вызова: {:?}",
        rows
    );
}

#[test]
fn unknown_event_does_not_break_the_feed() {
    let mut feed = Feed::default();
    let unknown = ServerEvent::parse(r#"{"id":"evt_x","type":"session.brand.new","data":{}}"#);
    assert!(
        feed.apply(&unknown, SESSION).is_empty(),
        "незнакомое событие новой версии движка не рвёт ленту"
    );
}

#[test]
fn events_of_other_session_are_not_shown() {
    let mut feed = Feed::default();
    let other = ServerEvent::parse(
        r#"{"id":"evt_y","type":"session.text.delta","data":{"sessionID":"ses_other","assistantMessageID":"msg_z","delta":"чужое"}}"#,
    );
    assert!(
        feed.apply(&other, SESSION).is_empty(),
        "чужая сессия в ленте GnomeCode не показывается"
    );
}

#[test]
fn finished_execution_is_a_notice_not_a_hang() {
    let notices = rows_of_kind(RowKind::Notice);
    assert!(
        notices
            .iter()
            .any(|line| line.contains("Ответ модели получен")),
        "по завершении работы в ленте появляется строка, а не пустота: {notices:?}"
    );
}

#[test]
fn failed_tool_call_is_visible_as_a_line() {
    let mut feed = Feed::default();
    let failed = ServerEvent::parse(
        r#"{"id":"evt_3","type":"session.tool.failed","data":{"sessionID":"ses_fixture","id":"call_x","error":{"type":"unknown","message":"файл не найден"}}}"#,
    );
    let rows = feed.apply(&failed, SESSION);
    let line = rows
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
        line.starts_with("✗") && line.contains("файл не найден"),
        "упавший инструмент виден строкой с причиной: {line:?}"
    );
    assert!(
        ToolError {
            message: "пусто".to_string()
        }
        .message
            == "пусто",
        "тело ошибки разбирается в тип, а не теряется"
    );
}

// Слой прав: решение видно в ленте и уходит (или не уходит) движку. Сервер —
// свой сокет, как в проверке обрыва: мост настоящий, opencode не нужен.

/// Предел ожидания строки ленты: медленный компьютер — не поломка.
const WAIT: std::time::Duration = std::time::Duration::from_secs(10);

/// Сервер проверки: сессия, поток событий и приём одобренной команды.
/// Тело команды логируется целиком — по нему видно, что ушло движку.
fn serve_command(port_holder: Arc<Mutex<u16>>, log: Arc<Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    *port_holder.lock().expect("порт") = listener.local_addr().expect("адрес").port();
    for socket in listener.incoming() {
        let Ok(mut socket) = socket else {
            return;
        };
        let seen = Arc::clone(&log);
        thread::spawn(move || {
            let request = read_request(&mut socket);
            if let Ok(mut held) = seen.lock() {
                held.push(request.clone());
            }
            let first = request.lines().next().unwrap_or_default().to_string();
            if first.starts_with("POST /api/session ") {
                let _ = socket.write_all(common::json_head(r#"{"data":{"id":"ses_fixture"}}"#).as_bytes());
                return;
            }
            if first.contains("/command") {
                // Движок отвечает на команду пустым телом 204 (замер 2026-10-05).
                let _ = socket.write_all(b"HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n");
                return;
            }
            let _ = socket.write_all(common::chunked_head().as_bytes());
            // Поток держится открытым, пока идёт проверка.
            thread::sleep(Duration::from_secs(30));
        });
    }
}

/// Строки вызова инструмента ленты: запуск и отказ слоя прав идут ими.
fn tool_lines(sink: &ListSink) -> Vec<String> {
    sink.rows()
        .into_iter()
        .filter_map(|row| match row {
            FeedEvent::Row {
                kind: RowKind::Tool,
                text,
                ..
            } => Some(text),
            _ => None,
        })
        .collect()
}

/// Мост с движком-подставой и логом запросов: общий вход трёх проверок слоя прав.
fn bridge_with_log() -> (Chat, Arc<ListSink>, Arc<Mutex<Vec<String>>>) {
    let port = Arc::new(Mutex::new(0u16));
    let log: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    thread::spawn({
        let port = Arc::clone(&port);
        let log = Arc::clone(&log);
        move || serve_command(port, log)
    });
    while *port.lock().expect("порт") == 0 {
        thread::sleep(Duration::from_millis(10));
    }
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());
    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_engine(Box::new(Loopback { endpoint }), Arc::clone(&sink) as Arc<dyn Sink>);
    (chat, sink, log)
}

#[test]
fn granted_command_starts_with_a_feed_line_and_reaches_the_engine() {
    let (chat, sink, log) = bridge_with_log();
    chat.command("docs", "search", "docs:search")
        .expect("одобренная команда ушла мосту");
    wait_for(&sink, "⧗ docs · search", WAIT);
    assert!(
        tool_lines(&sink).iter().any(|line| line == "⧗ docs · search"),
        "строка запуска — строка вызова инструмента: {:?}",
        tool_lines(&sink)
    );
    let seen = log.lock().expect("лог запросов").join("\n---\n");
    assert!(
        seen.contains("POST /api/session/ses_fixture/command"),
        "команда уходит движку POST-ом в сессию: {seen:?}"
    );
    assert!(
        seen.contains("\"name\":\"docs:search\"") && seen.contains("\"text\":\"\""),
        "тело команды несёт имя и обязательный пустой text: {seen:?}"
    );
}

#[test]
fn refusal_shows_a_line_and_does_not_call_the_engine() {
    let (chat, sink, log) = bridge_with_log();
    chat.refused("docs", "search")
        .expect("отказ ушёл мосту");
    wait_for(&sink, "requires approval", WAIT);
    assert!(
        tool_lines(&sink)
            .iter()
            .any(|line| line == "⚠ docs · search requires approval"),
        "отказ назван строкой слоя прав: {:?}",
        tool_lines(&sink)
    );
    let seen = log.lock().expect("лог запросов").join("\n---\n");
    assert!(
        !seen.contains("/command"),
        "после отказа движку нечего отправлять: {seen:?}"
    );
}

#[test]
fn user_row_carries_attached_files_as_a_field() {
    let (chat, sink, _log) = bridge_with_log();
    chat.send("Проверь", "Проверь", &["src/bridge.ts".to_string()], None)
        .expect("вопрос ушёл мосту");
    wait_for(&sink, "Проверь", WAIT);
    let files = sink.rows().into_iter().find_map(|row| match row {
        FeedEvent::Row {
            kind: RowKind::User,
            files,
            ..
        } => files,
        _ => None,
    });
    assert_eq!(
        files,
        Some(vec!["src/bridge.ts".to_string()]),
        "файлы вопроса идут полем строки, а не разбором «Файлы: …» текстом"
    );
}

#[test]
fn chat_rule_removes_the_question() {
    let grants = Grants::default();
    assert!(
        grants.sensitive("docs:search"),
        "без правила вызов считается чувствительным — спрашивать"
    );
    grants.allow("docs:search");
    assert!(
        !grants.sensitive("docs:search"),
        "правило «для этого чата» сняло вопрос: тот же вызов больше не спрашивает"
    );
}
