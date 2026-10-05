//! Разбор ответа движка о плагинах и командах: единственное место, где известна
//! форма движка (ADR-0001). Наружу отдаём [`super::Plugin`] — интерфейс формы не знает.
//!
//! Форма движка (`GET /api/plugin`, `GET /api/command`):
//! - плагин — `{ id, source, features, state: { status: "active" | "failed", error? } }`;
//! - команда — `{ name, description? }`, а команда плагина приходит с именем
//!   `плагин:команда`: префикс приписывает сам движок, поэтому по нему команда
//!   и относится к плагину.

use serde_json::Value;

use super::model::{Command, Plugin, ACTIVE};

/// Разделитель, которым движок отделяет имя плагина в имени команды.
const SEPARATOR: char = ':';
/// Символы, которые движок заменяет на `_` в именах плагина и команды: префикс
/// команды сравниваем с тем же правилом, иначе плагин «my-plugin» не совпадёт с «my_plugin».
const REPLACED: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";

/// Плагины проекта с их командами и пометкой «подключён к чату».
///
/// `connected` — по реестру чата: подключение делаем мы, у движка его нет.
pub fn plugins(raw: &[Value], commands: &[Value], connected: &[String]) -> Vec<Plugin> {
    raw.iter()
        .map(|entry| plugin(entry, commands, connected))
        .filter(|plugin| !plugin.id.is_empty())
        .collect()
}

/// Одна строка плагина: состояние — из `state.status`, команды — по префиксу имени.
fn plugin(entry: &Value, commands: &[Value], connected: &[String]) -> Plugin {
    let id = text(entry.get("id"));
    let state = text(entry.get("state").and_then(|state| state.get("status")));
    let state = if state.is_empty() {
        ACTIVE.to_string()
    } else {
        state
    };
    let prefix = format!("{}{SEPARATOR}", sanitize(&id));
    Plugin {
        connected: connected.iter().any(|known| known == &id),
        error: text(entry.get("state").and_then(|state| state.get("error"))),
        commands: commands_of(commands, &prefix),
        id,
        state,
    }
}

/// Команды одного плагина: имя начинается с `плагин:` — это его команда.
fn commands_of(commands: &[Value], prefix: &str) -> Vec<Command> {
    commands
        .iter()
        .filter_map(|entry| command(entry, prefix))
        .collect()
}

/// Команда плагина: полное имя — для движка, подпись на кнопке — без префикса.
fn command(entry: &Value, prefix: &str) -> Option<Command> {
    let name = text(entry.get("name"));
    let rest = name.strip_prefix(prefix)?;
    if rest.is_empty() {
        return None;
    }
    Some(Command {
        description: text(entry.get("description")),
        label: rest.to_string(),
        name,
    })
}

/// Строковое поле объекта: пусто, если поля нет или оно не строка.
fn text(value: Option<&Value>) -> String {
    value.and_then(Value::as_str).unwrap_or_default().to_string()
}

/// Имя плагина в том виде, в каком движок ставит его в имя команды: всё, кроме
/// букв, цифр, дефиса и подчёркивания, заменено на `_`.
fn sanitize(name: &str) -> String {
    name.chars()
        .map(|letter| if REPLACED.contains(letter) { letter } else { '_' })
        .collect()
}