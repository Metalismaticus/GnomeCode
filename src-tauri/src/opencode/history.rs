//! Разбор истории сессии в строки ленты. Форма сообщения снята живым замером
//! v2.0.25 (2026-10-10): у вопроса текст полем, у ответа — части `content`
//! (`text`/`tool`); вызов инструмента несёт имя, статус и вход. Здесь это
//! единственное место (ADR-0001): наружу идут строки ленты, а не JSON движка.
//!
//! Незнакомое разбор не рвёт: часть неизвестного типа, сообщение без текста и
//! ответ другой версии движка пропускаются — открытый чат показывает то, что
//! понятно, вместо ошибки.

use serde::Deserialize;
use serde_json::Value;

use super::client::{self, FeedEvent, RowKind, ToolState};

/// Сообщение истории: форма плоская, чего нет — умолчание (замер v2.0.25).
#[derive(Debug, Default, Deserialize)]
struct Message {
    #[serde(default)]
    id: String,
    #[serde(rename = "type", default)]
    kind: String,
    /// Текст вопроса: у ответа текст живёт в частях, поле пустое.
    #[serde(default)]
    text: String,
    #[serde(default)]
    time: Created,
    #[serde(default)]
    content: Vec<Part>,
}

/// Момент сообщения (unix-миллисекунды).
#[derive(Debug, Default, Deserialize)]
struct Created {
    #[serde(default)]
    created: u64,
}

/// Часть ответа: текст или вызов инструмента; незнакомый тип — пропуск.
#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum Part {
    #[serde(rename = "text")]
    Text {
        #[serde(default)]
        text: String,
    },
    #[serde(rename = "tool")]
    Tool {
        #[serde(default)]
        name: String,
        #[serde(default)]
        state: ToolPart,
    },
    #[serde(other)]
    Other,
}

/// Состояние вызова в истории: статус и вход — из них та же строка, что у
/// живой ленты (`✓ read · src/main.rs`).
#[derive(Debug, Default, Deserialize)]
struct ToolPart {
    #[serde(default)]
    status: String,
    #[serde(default)]
    input: Value,
}

/// История → строки ленты в порядке хода разговора (сообщения уже старыми
/// сверху — порядок отдаёт `Api::messages`). Служебных строк здесь нет:
/// владелец открыл переписку, а не ход работы над ней.
pub fn rows(messages: &[Value]) -> Vec<FeedEvent> {
    let mut out = Vec::new();
    for raw in messages {
        let Ok(message) = serde_json::from_value::<Message>(raw.clone()) else {
            continue;
        };
        match message.kind.as_str() {
            "user" if !message.text.trim().is_empty() => out.push(row(
                &message.id,
                RowKind::User,
                message.text,
                message.time.created,
            )),
            "assistant" => out.extend(assistant_rows(&message)),
            _ => {}
        }
    }
    out
}

/// Части ответа строками: тексты — репликами с временем сообщения, вызовы —
/// строкой инструмента того же вида, что у живой ленты. Идентификаторы частей
/// растут от идентификатора сообщения: лента складывает строки по id, части
/// одного сообщения спорить за неё не должны.
fn assistant_rows(message: &Message) -> Vec<FeedEvent> {
    let mut out = Vec::new();
    for (index, part) in message.content.iter().enumerate() {
        match part {
            Part::Text { text } if !text.trim().is_empty() => out.push(row(
                &part_id(&message.id, index),
                RowKind::Assistant,
                text.clone(),
                message.time.created,
            )),
            Part::Tool { name, state } => {
                // Статус — тот же вид строки, что у живой ленты: исполнено — «✓»,
                // ошибка — «✗», остальное (в том числе незнакомый статус) — «⧗».
                let done = match state.status.as_str() {
                    "completed" => ToolState::Done,
                    "error" => ToolState::Failed,
                    _ => ToolState::Running,
                };
                let name = if name.is_empty() { client::UNKNOWN_TOOL } else { name };
                let detail = client::summarize(&state.input.to_string());
                out.push(FeedEvent::Row {
                    id: part_id(&message.id, index),
                    kind: RowKind::Tool,
                    text: client::tool_line(name, done, &detail),
                    plugin: None,
                    files: None,
                    // Источник — исполненный вызов: файл идёт только со строкой
                    // «✓», как и в живой ленте (Feed::tool).
                    file: if done == ToolState::Done {
                        client::file_of(&state.input)
                    } else {
                        None
                    },
                    time: None,
                });
            }
            _ => {}
        }
    }
    out
}

/// Идентификатор строки части сообщения: `{сообщение}-{номер}`.
fn part_id(message: &str, index: usize) -> String {
    format!("{message}-{index}")
}

/// Реплика ленты: время стоит у вопроса и ответа — подпись показывает то, что
/// знают данные; у вызовов и служебных строк его нет (спека ленты §4).
fn row(id: &str, kind: RowKind, text: String, time: u64) -> FeedEvent {
    FeedEvent::Row {
        id: id.to_string(),
        kind,
        text,
        plugin: None,
        files: None,
        file: None,
        time: if time > 0 { Some(time) } else { None },
    }
}

#[cfg(test)]
mod tests {
    use super::rows;
    use serde_json::json;

    /// Формы живого замера v2.0.25: вопрос с текстом полем, ответ с частями
    /// текста и исполненного вызова — строки ленты в порядке частей.
    #[test]
    fn measured_forms_become_feed_rows() {
        let messages = vec![
            json!({
                "id": "msg_zero", "time": {"created": 1000}, "type": "assistant",
                "content": [
                    {"type": "tool", "id": "call_1", "name": "read",
                     "state": {"status": "completed", "input": {"filePath": "src/main.rs"}}},
                    {"type": "text", "text": "Ранний ответ"}
                ],
                "finish": "stop"
            }),
            json!({"id": "msg_one", "time": {"created": 2000}, "text": "Вопрос", "type": "user"}),
        ];
        let events = rows(&messages);
        assert_eq!(events.len(), 3, "три строки: вызов, ответ, вопрос: {events:?}");
        let texts: Vec<String> = events
            .iter()
            .map(|event| match event {
                FeedEvent::Row { text, .. } => text.clone(),
                _ => String::new(),
            })
            .collect();
        assert_eq!(texts[0], "✓ read · src/main.rs", "вызов — строкой живой ленты");
        assert_eq!(texts[1], "Ранний ответ", "текст ответа — репликой");
        assert_eq!(texts[2], "Вопрос", "вопрос — репликой");
        // Время — только у реплик; у исполненного вызова источник — файл.
        for event in &events {
            if let FeedEvent::Row { id, kind, file, time, .. } = event {
                if id.ends_with("-0") {
                    assert!(matches!(kind, RowKind::Tool), "часть вызова — строка инструмента");
                    assert_eq!(file.as_deref(), Some("src/main.rs"), "файл — источник «✓»");
                    assert!(time.is_none(), "у вызова подписи с временем нет");
                } else {
                    assert!(time.is_some(), "у реплики время сообщения: {id}");
                }
            }
        }
    }

    /// Незнакомое разбор не рвёт: часть неизвестного типа, сломанное сообщение
    /// и ответ без текста пропускаются, остальное разбирается.
    #[test]
    fn unknown_parts_and_shapes_do_not_break() {
        let messages = vec![
            json!({"id": "a", "type": "assistant", "content": [
                {"type": "reasoning", "text": "мысли"},
                {"type": "text", "text": "   "},
                {"type": "text", "text": "Ответ"}
            ]}),
            json!({"id": "b", "type": "system", "text": "служебное"}),
            json!({"type": "user"}),
            Value::Null,
        ];
        let events = rows(&messages);
        assert_eq!(events.len(), 1, "прошёл только осмысленный текст: {events:?}");
        assert!(
            matches!(&events[0], FeedEvent::Row { text, .. } if text == "Ответ"),
            "текст части дошёл до строки"
        );
    }
}
