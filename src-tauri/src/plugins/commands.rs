//! Команды окна для плагинов: список установленных, подключение к чату, клик
//! по кнопке команды и ответ окна одобрения. Клик проходит слой прав
//! (docs/SPEC/plugins.md, «Утверждённый UX одобрения»): разрешённое уходит
//! движку, чувствительное возвращает запрос окну, отказ — строка в ленте.

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::opencode::{client::Api, Chat};

use super::catalog;
use super::install;
use super::model::Plugin;
use super::permissions::Grants;
use super::registry::Registry;

/// Плагины проекта с командами и отметкой «подключён к чату»: движок и реестр
/// установленного (`installed.json`) — движок файловые плагины не перечисляет.
#[tauri::command]
pub fn plugin_list(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
) -> Result<Vec<Plugin>, String> {
    let endpoint = chat
        .endpoint()
        .ok_or_else(|| "Движок OpenCode не запущен: список плагинов недоступен".to_string())?;
    let api = Api::new(&endpoint);
    let fallback = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    let installed = install::installed(&install::registry_file(fallback));
    Ok(catalog::merged(
        &api.plugins()?,
        &api.commands()?,
        &registry.connected(),
        &installed,
    ))
}

/// Подключить плагин к чату: он появляется кнопками в шапке без перезапуска.
/// Запись наша — у движка подключения нет (`POST /api/plugin` не существует).
#[tauri::command]
pub fn plugin_connect(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    id: String,
) -> Result<Vec<Plugin>, String> {
    registry.connect(&id);
    plugin_list(app, chat, registry)
}

/// Каталог «Available»: индекс доступных плагинов с GitHub владельца.
#[tauri::command]
pub fn catalog_list() -> Result<Vec<install::CatalogEntry>, String> {
    install::fetch(install::CATALOG_URL)
}

/// Установить плагин из каталога: файл — в папку плагинов движка, запись — в
/// реестр установленного, движок перезапустится тихо (читает плагины при старте).
#[tauri::command]
pub fn plugin_install(app: AppHandle, chat: State<'_, Chat>, id: String) -> Result<(), String> {
    let fallback = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir());
    install::install_by_id(&id, &install::registry_file(fallback))?;
    chat.restart()
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