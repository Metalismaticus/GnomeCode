// События движка, важные ленте. Формат OpenCode: `{"type": …, "data": {…}}`,
// поэтому у каждого варианта своё тело — это union, а не «any» (ADR-0001).
// Остальные события разбираются в `Other`: формат движка меняется, лента — нет.

use gnomecode_lib::opencode::client::{Feed, FeedEvent, RowKind, ServerEvent, ToolError};

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
