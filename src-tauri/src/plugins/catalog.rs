//! Разбор ответа движка о плагинах и командах: единственное место, где известна
//! форма движка (ADR-0001). Наружу отдаём [`super::Plugin`] — интерфейс формы не знает.
//!
//! Форма движка (`GET /api/plugin`, `GET /api/command`):
//! - плагин — `{ id, source, features, state: { status: "active" | "failed", error? } }`;
//! - команда — `{ name, description? }`, а команда плагина приходит с именем
//!   `плагин:команда`: префикс приписывает сам движок, поэтому по нему команда
//!   и относится к плагину.

use serde_json::Value;

use super::install::CatalogEntry;
use super::model::{Command, Plugin, ACTIVE};
/// Разделитель, которым движок отделяет имя плагина в имени команды.
const SEPARATOR: char = ':';
/// Символы, которые движок заменяет на `_` в именах плагина и команды: префикс
/// команды сравниваем с тем же правилом, иначе плагин «my-plugin» не совпадёт с «my_plugin».
const REPLACED: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";

/// Плагины проекта с их командами и пометкой «подключён к чату».
///
/// `connected` и `disabled` — по спискам реестра: подключение делаем мы, у движка его нет.
pub fn plugins(
    raw: &[Value],
    commands: &[Value],
    connected: &[String],
    disabled: &[String],
) -> Vec<Plugin> {
    raw.iter()
        .filter_map(|entry| plugin(entry, commands, connected, disabled))
        .collect()
}

/// Список с реестром установленного: движок файловые плагины из своей глобальной
/// папки в `GET /api/plugin` не перечисляет (замер 2026-10-06, opencode v2.0.23),
/// поэтому установленные из каталога даёт наш реестр — та же форма, что у движка.
/// Карточные поля и выключенность тоже от реестра (docs/SPEC/plugins.md, сцена A):
/// у движка их не спросить. Если плагин движка и реестра один — поля реестра ложатся
/// поверх, состояние движка чище.
pub fn merged(
    raw: &[Value],
    commands: &[Value],
    connected: &[String],
    disabled: &[String],
    installed: &[CatalogEntry],
) -> Vec<Plugin> {
    let mut list = plugins(raw, commands, connected, disabled);
    for entry in installed {
        let connected_flag = connected.iter().any(|known| known == &entry.id);
        if let Some(known) = list.iter().position(|one| one.id == entry.id) {
            let base = &mut list[known];
            *base = card(base, connected_flag, entry);
        } else {
            list.push(from_entry(entry, connected_flag));
        }
    }
    list
}

/// Карточные поля поверх строк плагина: имя, автор, версия, описание, права и
/// отметка «выключен»; id, состояние и оставшиеся команды — у плагина движка.
fn card(base: &mut Plugin, connected: bool, entry: &CatalogEntry) -> Plugin {
    Plugin {
        connected,
        commands: base.commands.clone(),
        state: base.state.clone(),
        error: base.error.clone(),
        id: base.id.clone(),
        name: Some(entry.name.clone()),
        author: Some(entry.author.clone()),
        version: Some(entry.version.clone()),
        description: Some(entry.description.clone()),
        permissions: permissions_of(entry),
        disabled: entry.disabled,
        rules: None,
        update: None,
    }
}

/// Строка плагина из одной записи реестра: commands собраны, как их приписывает движок.
fn from_entry(entry: &CatalogEntry, connected: bool) -> Plugin {
    Plugin {
        id: entry.id.clone(),
        state: ACTIVE.to_string(),
        error: String::new(),
        connected,
        commands: entry
            .commands
            .iter()
            .map(|command| Command {
                name: format!("{}{SEPARATOR}{}", sanitize(&entry.id), command.name),
                label: command.name.clone(),
                description: command.description.clone(),
            })
            .collect(),
        name: Some(entry.name.clone()),
        author: Some(entry.author.clone()),
        version: Some(entry.version.clone()),
        description: Some(entry.description.clone()),
        permissions: permissions_of(entry),
        disabled: entry.disabled,
        rules: None,
        update: None,
    }
}

/// Права записи на карточку: «Категория: значение», как в сводке прав установки.
pub fn permissions_of(entry: &CatalogEntry) -> Vec<String> {
    entry
        .permissions
        .iter()
        .map(|one| format!("{}: {}", one.category, one.value))
        .collect()
}

/// Одна строка плагина: состояние — из `state.status`, команды — по префиксу имени.
fn plugin(entry: &Value, commands: &[Value], connected: &[String], disabled: &[String]) -> Option<Plugin> {
    let id = text(entry.get("id"));
    if id.is_empty() {
        return None;
    }
    let state = text(entry.get("state").and_then(|state| state.get("status")));
    let state = if state.is_empty() {
        ACTIVE.to_string()
    } else {
        state
    };
    let prefix = format!("{}{SEPARATOR}", sanitize(&id));
    Some(Plugin {
        connected: connected.iter().any(|known| known == &id),
        disabled: disabled.iter().any(|known| known == &id),
        error: text(entry.get("state").and_then(|state| state.get("error"))),
        commands: commands_of(commands, &prefix),
        id,
        state,
        name: None,
        author: None,
        version: None,
        description: None,
        permissions: vec![],
        rules: None,
        update: None,
    })
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