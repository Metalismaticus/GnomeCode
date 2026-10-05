//! Команды окна для плагинов: список установленных и подключение к чату.
//! Клик по кнопке шапки сюда не приходит: команда плагина уходит через слой прав,
//! а его в проекте пока нет (docs/BLOCKED.md, «Решения»).

use tauri::State;

use crate::opencode::{client::Api, Chat};

use super::catalog;
use super::model::Plugin;
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