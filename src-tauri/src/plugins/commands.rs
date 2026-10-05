//! Команды окна для плагинов: список установленных, подключение к чату, клик
//! по кнопке команды и ответ окна одобрения. Клик проходит слой прав
//! (docs/SPEC/plugins.md, «Утверждённый UX одобрения»): разрешённое уходит
//! движку, чувствительное возвращает запрос окну, отказ — строка в ленте.

use serde::Serialize;
use tauri::State;

use crate::opencode::{client::Api, Chat};

use super::catalog;
use super::model::Plugin;
use super::permissions::Grants;
use super::registry::Registry;

/// Плагины проекта с командами и отметкой «подключён к чату». Пустой список —
/// законное состояние движка, а не ошибка: сообщения приходят через `Result`.
#[tauri::command]
pub fn plugin_list(chat: State<'_, Chat>, registry: State<'_, Registry>) -> Result<Vec<Plugin>, String> {
    let endpoint = chat
        .endpoint()
        .ok_or_else(|| "Движок OpenCode не запущен: список плагинов недоступен".to_string())?;
    let api = Api::new(&endpoint);
    Ok(catalog::plugins(
        &api.plugins()?,
        &api.commands()?,
        &registry.connected(),
    ))
}

/// Подключить плагин к чату: он появляется кнопками в шапке без перезапуска.
/// Запись наша — у движка подключения нет (`POST /api/plugin` не существует).
#[tauri::command]
pub fn plugin_connect(
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    id: String,
) -> Result<Vec<Plugin>, String> {
    registry.connect(&id);
    plugin_list(chat, registry)
}

/// Что сказал слой прав клику по кнопке команды (docs/SPEC/plugins.md).
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum PluginRun {
    /// Разрешено: команда уходит движку, строка запуска уже в ленте.
    Started,
    /// Вызов чувствительный: интерфейс открывает окно одобрения.
    Approval,
}

/// Клик по кнопке команды в шапке: выданное правило исполняет без вопроса,
/// иначе — запрос окну одобрения. Правила чата — наш слой: движковый
/// permission-слой наружу не сговорчив (замер 2026-10-05), решение ДО вызова.
#[tauri::command]
pub fn plugin_run(
    chat: State<'_, Chat>,
    grants: State<'_, Grants>,
    plugin: String,
    label: String,
    command: String,
) -> Result<PluginRun, String> {
    if grants.sensitive(&command) {
        return Ok(PluginRun::Approval);
    }
    chat.command(&plugin, &label, &command)
        .map(|_| PluginRun::Started)
}

/// Ответ владельца в окне одобрения: правило на этот чат, один запуск или отказ.
/// «Для проекта» из этого окна и глобальные правила — Этап 2
/// (docs/BLOCKED.md, «Решено»); отказ запоминается только в ленте строкой.
#[tauri::command]
pub fn plugin_decide(
    chat: State<'_, Chat>,
    grants: State<'_, Grants>,
    plugin: String,
    label: String,
    command: String,
    decision: String,
) -> Result<(), String> {
    match decision.as_str() {
        "allow" => chat.command(&plugin, &label, &command),
        "chat" => {
            grants.allow(&command);
            chat.command(&plugin, &label, &command)
        }
        "deny" => chat.refused(&plugin, &label),
        other => Err(format!("Неизвестный ответ одобрения «{other}»: выбора из окна три")),
    }
}