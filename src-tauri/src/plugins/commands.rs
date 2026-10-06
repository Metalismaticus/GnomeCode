//! Команды окна для плагинов: список установленных, подключение к чату, клик
//! по кнопке команды и ответ окна одобрения. Клик проходит слой прав
//! (docs/SPEC/plugins.md, «Утверждённый UX одобрения»): разрешённое уходит
//! движку, чувствительное возвращает запрос окну, отказ — строка в ленте.

use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

use crate::opencode::{client::Api, Chat};
use crate::state::Store;

use super::catalog;
use super::install;
use super::manage;
use super::model::Plugin;
use super::permissions::Grants;
use super::registry::Registry;
use super::{rules, rules::Decision, scopes, toolsets, updates, usage};

/// Папка данных: переменную задаёт проверка или копия, иначе — папка данных Tauri.
pub(crate) fn data_dir(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir())
}

/// Плагины проекта с командами и отметкой «подключён к чату»: движок и реестр
/// установленного (`installed.json`) — движок файловые плагины не перечисляет.
/// Подключение чата — реестр окна плюс скоупы (`plugin_scopes.json`) минус
/// снятые с чата: перезапуск окна — прокси «нового чата», скоуп проекта и
/// глобальный вернут кнопки, «этот чат» — нет.
#[tauri::command]
pub fn plugin_list(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
) -> Result<Vec<Plugin>, String> {
    let endpoint = chat
        .endpoint()
        .ok_or_else(|| "Движок OpenCode не запущен: список плагинов недоступен".to_string())?;
    let api = Api::new(&endpoint);
    let folder = data_dir(&app);
    let installed = install::installed(&install::registry_file(folder.clone()));
    let saved = scopes::at(&scopes::file(folder.clone()));
    let project = store.load().project.unwrap_or_default();
    let mut scoped = saved.project.get(&project).cloned().unwrap_or_default();
    scoped.extend(saved.global.iter().cloned());
    let effective = scopes::connected_for(&registry.connected(), &registry.opted_out(), &scoped);
    let mut list = catalog::with_scopes(
        catalog::merged(
            &api.plugins()?,
            &api.commands()?,
            &effective,
            &registry.disabled(),
            &installed,
        ),
        &registry.once_ids(),
        &registry.connected(),
        &saved.project.get(&project).cloned().unwrap_or_default(),
        &saved.global,
    );
    // Правила категорий от файла правил: панель Configure показывает их на карточке.
    let held = rules::at(&rules::file(folder.clone()));
    for plugin in &mut list {
        if let Some(own) = held.get(&plugin.id) {
            plugin.rules = Some(own.clone());
        }
    }
    // Обновления из updates.json к карточкам вкладки Updates; запись, чью новую
    // версию уже установили через «Разрешить» сводки, — «обновлено», ждать нечего.
    let file = updates::file(folder.clone());
    let mut notes = updates::at(&file);
    let before = notes.clone();
    updates::refresh(&mut notes, &installed);
    if notes != before {
        updates::save(&file, &notes)?;
    }
    for plugin in &mut list {
        plugin.update = notes.records.get(&plugin.id).cloned();
    }
    // Счётчики вызовов из usage.json к карточкам — «Вызовов: N» на карточке.
    let usage = usage::at(&usage::file(folder.clone()));
    for plugin in &mut list {
        plugin.usage = usage.get(&plugin.id).cloned();
    }
    Ok(list)
}

/// Пометка последней проверки каталога из updates.json: «каталог недоступен —
/// работаем на текущих» — строка вкладки Updates, окно при запуске не открывается
/// (крайний случай автообновления).
#[tauri::command]
pub fn plugin_updates_note(app: AppHandle) -> Result<Option<String>, String> {
    Ok(updates::at(&updates::file(data_dir(&app))).catalog)
}

/// Отмечено ли владелец включил или выключил плагин — Enable или Disable карточки:
/// у записанного в реестр выключение в файле, у прочих — в реестре чата (память
/// окна, как подключение). Список отдаём свежий — карточки пересчитают вкладки.
#[tauri::command]
pub fn plugin_set_enabled(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
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
    plugin_list(app, chat, registry, store)
}

/// Удалить плагин после подтверждения: запись реестра и файл плагина уходят,
/// движок перезапускается тихо (читал файл при старте — перечитывать нечего).
#[tauri::command]
pub fn plugin_uninstall(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
    id: String,
) -> Result<Vec<Plugin>, String> {
    manage::remove(&id, &install::registry_file(data_dir(&app)), &install::plugins_dir())?;
    registry.forget(&id);
    chat.restart()?;
    plugin_list(app, chat, registry, store)
}

/// Подключить плагин к чату со скоупом (сцена E): по умолчанию «этот чат».
/// Запись наша — у движка подключения нет (`POST /api/plugin` не существует).
#[tauri::command]
pub fn plugin_connect(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
    id: String,
    scope: Option<String>,
) -> Result<Vec<Plugin>, String> {
    let folder = data_dir(&app);
    let project = store.load().project;
    plugin_connect_one(&registry, scopes::file(folder), project.as_deref(), &id, scope)?;
    plugin_list(app, chat, registry, store)
}

/// Подключение одного плагина со скоупом — общая запись клика строки списка
/// («Chat») и подключения Tool Set (phase2.md, раздел 11: сет раскладывается
/// на одиночные подключения). Выделено из plugin_connect: явный скоуп
/// (`scope.is_some()`) обновляет реестр даже уже подключённой строки, клик
/// строки без скоупа идемпотентен. Повышающий скоуп («проект», «глобально»)
/// пишется в файл — вернёт кнопки в новых чатах; выбор в полосе «Этот чат»/
/// «Once» у подключённой строки — откат повышенного, файл скоупов правится.
pub fn plugin_connect_one(
    registry: &Registry,
    scopes_file: std::path::PathBuf,
    project: Option<&str>,
    id: &str,
    scope: Option<String>,
) -> Result<(), String> {
    let kind = scope.as_deref().unwrap_or("chat");
    if !matches!(kind, "once" | "chat" | "project" | "global") {
        return Err(format!("неизвестный скоуп «{kind}»: once, chat, project или global"));
    }
    let already = scopes::connected_for(
        &registry.connected(),
        &registry.opted_out(),
        &scoped_for(project, scopes_file.clone(), id),
    )
    .iter()
    .any(|known| known == id);
    registry.choose(id, kind, scope.is_some(), already);
    match kind {
        // Повышающий скоуп пишется в файл — вернёт кнопки в новых чатах.
        "project" | "global" => scopes::set(&scopes_file, kind, project, id)?,
        "chat" | "once" if scope.is_some() => scopes::set(&scopes_file, kind, project, id)?,
        _ => {}
    }
    Ok(())
}

/// Подключить Tool Set целиком (phase2.md, раздел 11): каждый установленный
/// плагин сета со скоупом одним пунктом меню, недоступные пропускаются.
/// `known` — id доступного установленного: движок и реестр установленного
/// — команда окна собирает их перед вызовом. Возвращает подключённые id.
pub fn toolset_connect(
    registry: &Registry,
    scopes_file: std::path::PathBuf,
    project: Option<&str>,
    known: &[String],
    ids: &[String],
    scope: Option<String>,
) -> Result<Vec<String>, String> {
    let mut connected = Vec::new();
    for id in ids {
        if !known.iter().any(|one| one == id) {
            continue;
        }
        plugin_connect_one(registry, scopes_file.clone(), project, id, scope.clone())?;
        connected.push(id.clone());
    }
    Ok(connected)
}

/// Скоуповые id плагина в одной папке: список проекта текущей папки плюс
/// глобальные — то, что знает файл скоупов про этот плагин.
fn scoped_for(project: Option<&str>, folder: std::path::PathBuf, id: &str) -> Vec<String> {
    let saved = scopes::at(&scopes::file(folder));
    let mut ids = project
        .and_then(|root| saved.project.get(root))
        .cloned()
        .unwrap_or_default();
    ids.extend(saved.global.iter().filter(|known| known.as_str() == id).cloned());
    ids
}

/// Снять плагин с чата без деинсталляции (панель «Plugins in this chat»):
/// кнопки уходят из этого окна, установка и скоупы не трогаются — в других
/// чатах и после перезапуска плагин остаётся.
#[tauri::command]
pub fn plugin_disconnect(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
    id: String,
) -> Result<Vec<Plugin>, String> {
    registry.opt_out_of(&id);
    plugin_list(app, chat, registry, store)
}

/// Tool Sets папки данных списком «имя → id» — окну списка нечего собирать.
#[tauri::command]
pub fn plugin_toolsets(app: AppHandle) -> Result<Vec<toolsets::ToolSet>, String> {
    Ok(toolsets::pairs(&toolsets::at(&toolsets::file(data_dir(&app)))))
}

/// Сохранить Tool Set из подключённого сейчас к чату (реестр окна): пусто —
/// нечего сохранять (вслепую сет не создают), имя пустое — записывать нечем.
#[tauri::command]
pub fn plugin_toolset_save(
    app: AppHandle,
    registry: State<'_, Registry>,
    name: String,
) -> Result<Vec<toolsets::ToolSet>, String> {
    let ids = registry.connected();
    if ids.is_empty() {
        return Err("Нечего сохранять: подключите плагин к чату и повторите".to_string());
    }
    if name.trim().is_empty() {
        return Err("Имя сета пустое: введите название".to_string());
    }
    toolsets::set(&toolsets::file(data_dir(&app)), &name, &ids)?;
    Ok(toolsets::pairs(&toolsets::at(&toolsets::file(data_dir(&app)))))
}

/// Подключить Tool Set одним пунктом меню (phase2.md, раздел 11): каждый
/// установленный плагин сета со скоупом (по умолчанию «этот чат»; «проект»
/// делает сет дефолтом проекта), недоступные пропускаются. Доступное — движок
/// и реестр установленного: подключение из каталога и с балки движка равны.
#[tauri::command]
pub fn plugin_toolset_connect(
    app: AppHandle,
    chat: State<'_, Chat>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
    name: String,
    scope: Option<String>,
) -> Result<Vec<Plugin>, String> {
    let folder = data_dir(&app);
    let ids = toolsets::at(&toolsets::file(folder.clone()))
        .get(&name)
        .cloned()
        .ok_or_else(|| format!("сета «{name}» нет: сохраните его из подключённого"))?;
    let known = engine_and_installed_ids(&chat, folder.clone())?;
    let project = store.load().project;
    toolset_connect(&registry, scopes::file(folder), project.as_deref(), &known, &ids, scope)?;
    plugin_list(app, chat, registry, store)
}

/// Удалить Tool Set: имя уходит из файла, плагины и скоупы не трогаются —
/// сет лишь ярлык группы, его удаление ни к чему подключённому не ведёт.
#[tauri::command]
pub fn plugin_toolset_delete(app: AppHandle, name: String) -> Result<Vec<toolsets::ToolSet>, String> {
    toolsets::set(&toolsets::file(data_dir(&app)), &name, &[])?;
    Ok(toolsets::pairs(&toolsets::at(&toolsets::file(data_dir(&app)))))
}

/// Доступные плагины: id от движка (файловые плагины) и реестра установленного
/// (каталог). Сет подключает только их — недоступное имя в сети не рекорд.
fn engine_and_installed_ids(
    chat: &State<'_, Chat>,
    folder: std::path::PathBuf,
) -> Result<Vec<String>, String> {
    let endpoint = chat
        .endpoint()
        .ok_or_else(|| "Движок OpenCode не запущен: доступное установлено недоступно".to_string())?;
    let api = Api::new(&endpoint);
    let mut known: Vec<String> = api
        .plugins()?
        .iter()
        .filter_map(|entry| entry.get("id"))
        .filter_map(serde_json::Value::as_str)
        .map(String::from)
        .collect();
    known.extend(
        install::installed(&install::registry_file(folder))
            .into_iter()
            .map(|entry| entry.id),
    );
    Ok(known)
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
    let held = rules::at(&rules::file(folder.clone()));
    let rule = category
        .as_deref()
        .and_then(|name| rules::value_of(&held, &plugin, name));
    match rules::decide(rule, !grants.sensitive(&command)) {
        Decision::Deny => {
            chat.denied(&plugin, &label)?;
            Ok(PluginRun::Denied)
        }
        Decision::Run => {
            let sent = chat.command(&plugin, &label, &command);
            if sent.is_ok() {
                usage::record(&usage::file(folder), &plugin);
            }
            sent.map(|_| PluginRun::Started)
        }
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
    store: State<'_, Arc<Store>>,
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
    plugin_list(app, chat, registry, store)
}

/// Ответ владельца в окне одобрения: правило на этот чат, один запуск или отказ.
/// «Для проекта» из этого окна и глобальные правила — Этап 2
/// (docs/BLOCKED.md, «Решено»); отказ запоминается только в ленте строкой.
#[tauri::command]
pub fn plugin_decide(
    app: AppHandle,
    chat: State<'_, Chat>,
    grants: State<'_, Grants>,
    plugin: String,
    label: String,
    command: String,
    decision: String,
) -> Result<(), String> {
    match decision.as_str() {
        "allow" => chat.command(&plugin, &label, &command).map(|_| {
            usage::record(&usage::file(data_dir(&app)), &plugin)
        }),
        "chat" => {
            grants.allow(&command);
            chat.command(&plugin, &label, &command).map(|_| {
                usage::record(&usage::file(data_dir(&app)), &plugin)
            })
        }
        "deny" => chat.refused(&plugin, &label),
        other => Err(format!("Неизвестный ответ одобрения «{other}»: выбора из окна три")),
    }
}