//! Команды окна для плагинов: список установленных, подключение к чату, клик
//! по кнопке команды и ответ окна одобрения. Клик проходит слой прав
//! (docs/SPEC/plugins.md, «Утверждённый UX одобрения»): разрешённое уходит
//! движку, чувствительное возвращает запрос окну, отказ — строка в ленте.

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::opencode::{client::Api, Chat};

use super::catalog;
use super::install;
use super::manage;
use super::model::Plugin;
use super::permissions::Grants;
use super::registry::Registry;
use super::{rules, rules::Decision};

/// Папка данных: переменную задаёт проверка или копия, иначе — папка данных Tauri.
fn data_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
}

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
    let folder = data_dir(&app);
    let installed = install::installed(&install::registry_file(folder.clone()));
    let mut list = catalog::merged(
        &api.plugins()?,
        &api.commands()?,
        &registry.connected(),
        &registry.disabled(),
        &installed,
    );
    // Правила категорий от файла правил: панель Configure показывает их на карточке.
    let held = rules::at(&rules::file(folder));
    for plugin in &mut list {
        if let Some(own) = held.get(&plugin.id) {
            plugin.rules = Some(own.clone());
        }
    }
    Ok(list)
}

/// Отмечено ли владелец включил или выключил плагин — Enable или Disable карточки:
/// у записанного в реестр выключение в файле, у прочих — в реестре чата (память
/// окна, как подключение). Список отдаём свежий — карточки пересчитают вкладки.
#[tauri::command]
pub fn plugin_set_enabled(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    disabled: bool,
    id: String,
) -> Result<Vec<Plugin>, String> {
    let folder = data_dir(&app);
    if !manage::set_disabled(&id, disabled, &install::registry_file(folder))? {
        if disabled {
            registry.disable(&id);
        } else {
            registry.enable(&id);
        }
    }
    plugin_list(app, chat, registry)
}

/// Удалить плагин после подтверждения: запись реестра и файл плагина уходят,
/// движок перезапускается тихо (читал файл при старте — перечитывать нечего).
#[tauri::command]
pub fn plugin_uninstall(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    id: String,
) -> Result<Vec<Plugin>, String> {
    manage::remove(&id, &install::registry_file(data_dir(&app)), &install::plugins_dir())?;
    registry.forget(&id);
    chat.restart()?;
    plugin_list(app, chat, registry)
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
    install::install_by_id(&id, &install::registry_file(data_dir(&app)))?;
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
    /// Запрещено правилом категории: строка «⚠ … denied» уже в ленте,
    /// окна одобрения не будет — denied-категории не спрашиваются никогда.
    Denied,
}

/// Категория команды: только у записанных в реестр плагинов декларация знает
/// категории; у прочих её нет, и deny к вызову неприменим (всё через ask).
fn category_of(plugin_id: &str, command: &str, folder: &std::path::Path) -> Option<String> {
    install::installed(&install::registry_file(folder.to_path_buf()))
        .into_iter()
        .find(|entry| entry.id == plugin_id)?
        .commands
        .into_iter()
        .find(|spec| spec.name == command)?
        .category
}

/// Клик по кнопке команды в шапке: правила категории решают ДО вызова движка
/// (собственный permission-слой OpenCode наружу не сговорчив — замер 2026-10-05).
/// Порядок: deny — строка «denied» и конец; грант чата или allow — молча;
/// иначе окно одобрения. Правила перечитываются на каждом вызове — смена в
/// Configure действует на следующий вызов без перезапуска.
#[tauri::command]
pub fn plugin_run(
    app: AppHandle,
    chat: State<'_, Chat>,
    grants: State<'_, Grants>,
    plugin: String,
    label: String,
    command: String,
) -> Result<PluginRun, String> {
    let folder = data_dir(&app);
    let category = category_of(&plugin, &command, &folder);
    let held = rules::at(&rules::file(folder));
    let rule = category
        .as_deref()
        .and_then(|name| rules::value_of(&held, &plugin, name));
    match rules::decide(rule, !grants.sensitive(&command)) {
        Decision::Deny => {
            chat.denied(&plugin, &label)?;
            Ok(PluginRun::Denied)
        }
        Decision::Run => chat
            .command(&plugin, &label, &command)
            .map(|_| PluginRun::Started),
        Decision::Ask => Ok(PluginRun::Approval),
    }
}

/// Сменить правило категории плагина (панель Configure): запись в rules.json —
/// следующий plugin_run перечитает файл и поведёт себя по-новому без перезапуска.
#[tauri::command]
pub fn plugin_set_rule(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    plugin: String,
    category: String,
    value: String,
) -> Result<Vec<Plugin>, String> {
    if !rules::CATEGORIES.contains(&category.as_str()) {
        return Err(format!("неизвестная категория «{category}»: их четыре — Read, Write, Network, Terminal"));
    }
    if !rules::VALUES.contains(&value.as_str()) {
        return Err(format!("неизвестное значение «{value}»: allow, ask или deny"));
    }
    rules::set(&rules::file(data_dir(&app)), &plugin, &category, &value)?;
    plugin_list(app, chat, registry)
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