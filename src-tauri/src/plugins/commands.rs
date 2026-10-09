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
    let engine_plugins = api
        .plugins()
        .map_err(|reason| format!("Движок не ответил на список плагинов — {reason}"))?;
    let engine_commands = api
        .commands()
        .map_err(|reason| format!("Движок не ответил на список команд — {reason}"))?;
    let mut list = catalog::with_scopes(
        catalog::merged(
            &engine_plugins,
            &engine_commands,
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

/// Пометка последней проверки каталога и удержанные правами обновления из
/// updates.json: строка — вкладке Updates («каталог недоступен — работаем на
/// текущих»), удержанные — сводке новых прав, которую интерфейс открывает сам
/// при старте (сцена K, решение владельца 2026-10-06). Движок не спрашивается:
/// held приходит из файла, даже пока движок ещё поднимается.
#[tauri::command]
pub fn plugin_updates_note(app: AppHandle) -> Result<updates::UpdatesNote, String> {
    let notes = updates::at(&updates::file(data_dir(&app)));
    let held = updates::held(&notes);
    Ok(updates::UpdatesNote {
        note: notes.catalog,
        held,
    })
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
/// Асинхронно: как каталог сравнения — сеть (raw.githubusercontent, до 30 с)
/// не замораживает окно при открытии вкладки без сети.
#[tauri::command]
pub async fn catalog_list() -> Result<Vec<install::CatalogEntry>, String> {
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
    // Правило плагина старше умолчания настроек: своё — решает, чужого —
    // решает секция умолчаний, нет и её — умолчание ask (rules::resolved).
    let rule = category.as_deref().and_then(|name| rules::resolved(&held, &plugin, name));
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
    check_category(&category, &value)?;
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

/// Окно настроек: секция умолчаний прав (docs/specs/
/// 2026-10-06-12-nastrojki.md, «Решено за вас» №8) и ключи провайдеров между
/// разделами «Плагины» и «Модели». Правило плагина старше умолчания —
/// plugin_run читает секцию после правил плагина.

/// Умолчания прав секции rules.json (строки Read/Write/Network/Terminal).
#[tauri::command]
pub fn settings_defaults(app: AppHandle) -> Result<Vec<rules::PermissionEntry>, String> {
    let held = rules::global_at(&rules::file(data_dir(&app)));
    Ok(rules::CATEGORIES
        .iter()
        .map(|category| rules::PermissionEntry {
            category: (*category).to_string(),
            value: held.get(*category).cloned().unwrap_or_else(|| rules::DEFAULT.to_string()),
        })
        .collect())
}

/// Сменить умолчание одной категории: запись в секцию умолчаний rules.json —
/// следующий вызов любой команды этой категории без собственного правила ведёт
/// себя по-новому без перезапуска (тот же файл, тот же перечёт plugin_run).
#[tauri::command]
pub fn settings_set_default(app: AppHandle, category: String, value: String) -> Result<Vec<rules::PermissionEntry>, String> {
    check_category(&category, &value)?;
    let file = rules::file(data_dir(&app));
    rules::set(&file, rules::GLOBAL, &category, &value)?;
    settings_defaults_inner(&file)
}

/// Общая проверка категории и значения: та же в plugin_set_rule.
fn check_category(category: &str, value: &str) -> Result<(), String> {
    if !rules::CATEGORIES.contains(&category) {
        return Err(format!("неизвестная категория «{category}»: их четыре — Read, Write, Network, Terminal"));
    }
    if !rules::VALUES.contains(&value) {
        return Err(format!("неизвестное значение «{value}»: allow, ask или deny"));
    }
    Ok(())
}

fn settings_defaults_inner(file: &std::path::Path) -> Result<Vec<rules::PermissionEntry>, String> {
    let held = rules::global_at(file);
    Ok(rules::CATEGORIES
        .iter()
        .map(|category| rules::PermissionEntry {
            category: (*category).to_string(),
            value: held.get(*category).cloned().unwrap_or_else(|| rules::DEFAULT.to_string()),
        })
        .collect())
}

/// Пометка ключа провайдера: «задан» / «не задан»; секрет не возвращается
/// никогда (docs/specs/2026-10-06-12-nastrojki.md, «Решено за вас» №3).
/// У endpoint'а запись названа с префиксом (`providers_store::key_id`).
#[tauri::command]
pub fn key_status(app: AppHandle, provider: String) -> Result<bool, String> {
    crate::providers::status(&key_name(&app, &provider))
}

/// Сохранить ключ провайдера и тихо перезапустить движок: ключи читаются
/// только при старте (provider.rs движка), сессия переживает рестарт.
#[tauri::command]
pub fn key_save(app: AppHandle, chat: State<'_, Chat>, provider: String, secret: String) -> Result<bool, String> {
    crate::providers::save(&key_name(&app, &provider), &secret)?;
    chat.restart()?;
    crate::providers::status(&key_name(&app, &provider))
}

/// Убрать ключ провайдера: рестарта не нужно — движок ничего не знает
/// о ключе, которого у него уже нет (пезапуск вернёт 401 заметки).
#[tauri::command]
pub fn key_remove(app: AppHandle, provider: String) -> Result<bool, String> {
    crate::providers::remove(&key_name(&app, &provider))?;
    Ok(false)
}

/// Имя записи ключа: у своего endpoint'а — `endpoint:<id>`, у провайдера
/// движка — его id. Одно место знает правило, окну префикс не виден.
fn key_name(app: &AppHandle, provider: &str) -> String {
    let file = crate::providers_store::file(data_dir(app));
    if crate::providers_store::endpoint(&crate::providers_store::at(&file), provider).is_some() {
        crate::providers_store::key_id(provider)
    } else {
        provider.to_string()
    }
}

/// Строка раздела «Провайдеры и ключи»: движок (активированные провайдеры —
/// живой список ядра, замер 2026-10-09) плюс свои endpoint'ы из providers.json;
/// моделей столько, сколько отдал `GET /api/model`; включённость — из файла.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRow {
    pub id: String,
    pub name: String,
    pub models: usize,
    /// Свой endpoint (providers.json), а не провайдер движка.
    pub endpoint: bool,
    pub enabled: bool,
}

/// Список провайдеров окна настроек: движок и свои endpoint'ы, без дублей id.
#[tauri::command]
pub fn provider_list(app: AppHandle, chat: State<'_, Chat>) -> Result<Vec<ProviderRow>, String> {
    let endpoint = chat
        .endpoint()
        .ok_or_else(|| "Движок OpenCode не запущен: список провайдеров недоступен".to_string())?;
    let file = crate::providers_store::file(data_dir(&app));
    let held = crate::providers_store::at(&file);
    let enabled_of = |id: &str| !held.disabled.iter().any(|known| known == id);

    let api = Api::new(&endpoint);
    // Модели по провайдерам — из /api/model; не ответил — строки всё равно
    // видны, у строки будет «моделей: 0».
    let models_raw = api.models().unwrap_or(serde_json::Value::Null);
    let counts = model_counts(&models_raw);
    let providers_raw = api.providers().unwrap_or(serde_json::Value::Null);
    let mut rows: Vec<ProviderRow> = match providers_raw.as_array() {
        Some(list) => list
            .iter()
            .filter_map(|one| {
                let id = one.get("id").and_then(serde_json::Value::as_str)?;
                let name = one.get("name").and_then(serde_json::Value::as_str).unwrap_or(id);
                Some(ProviderRow {
                    id: id.to_string(),
                    name: name.to_string(),
                    models: counts.get(id).copied().unwrap_or_default(),
                    endpoint: held.endpoints.iter().any(|known| known.id == id),
                    enabled: enabled_of(id),
                })
            })
            .collect(),
        None => Vec::new(),
    };
    // Свои endpoint'ы, которых движок не отдал (выключен или движок ещё
    // читал конфиг): строка остаётся — включить и удалить её надо всегда.
    for one in &held.endpoints {
        if rows.iter().any(|row| row.id == one.id) {
            continue;
        }
        rows.push(ProviderRow {
            id: one.id.clone(),
            name: one.name.clone(),
            models: one.models.len(),
            endpoint: true,
            enabled: enabled_of(&one.id),
        });
    }
    Ok(rows)
}

/// Число включённых моделей по провайдерам из списка `/api/model`.
fn model_counts(raw: &serde_json::Value) -> std::collections::HashMap<String, usize> {
    let mut counts: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
    let Some(list) = raw.as_array() else { return counts };
    for one in list {
        let enabled = one.get("enabled").and_then(serde_json::Value::as_bool).unwrap_or(true);
        if !enabled {
            continue;
        }
        if let Some(provider) = one.get("providerID").and_then(serde_json::Value::as_str) {
            *counts.entry(provider.to_string()).or_default() += 1;
        }
    }
    counts
}

/// Включить или выключить провайдера/endpoint: включённость — в providers.json
/// (формат state.json не растёт). Endpoint меняет конфиг движка — тихий
/// рестарт; у провайдера движка меняется только видимость в окне.
#[tauri::command]
pub fn provider_set_enabled(
    app: AppHandle,
    chat: State<'_, Chat>,
    id: String,
    enabled: bool,
) -> Result<Vec<ProviderRow>, String> {
    let file = crate::providers_store::file(data_dir(&app));
    crate::providers_store::set_enabled(&file, &id, enabled)?;
    if crate::providers_store::endpoint(&crate::providers_store::at(&file), &id).is_some() {
        chat.restart()?;
    }
    provider_list(app, chat)
}

/// Сколько секунд ждать список моделей endpoint'а: локальные серверы отвечают
/// мгновенно, корпоративному прокси хватает десяти.
const ENDPOINT_PROBE_SECONDS: u64 = 10;

/// Модели endpoint'а: `GET {база}/models` — открытый список OpenAI-совместимого
/// сервера. Ключ идёт заголовком запроса, не файлом; ошибка — словами наружу.
fn endpoint_models(base_url: &str, key: &str) -> Result<Vec<String>, String> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let mut request = ureq::get(&url).timeout(std::time::Duration::from_secs(ENDPOINT_PROBE_SECONDS));
    if !key.is_empty() {
        request = request.set("Authorization", &format!("Bearer {key}"));
    }
    let response = request
        .call()
        .map_err(|e| format!("endpoint не ответил на список моделей — {e}"))?;
    // Тело строкой и serde_json: json-фича ureq не включена, как и у каталога.
    let text = response
        .into_string()
        .map_err(|e| format!("ответ endpoint'а не прочитан — {e}"))?;
    let value: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("ответ endpoint'а не JSON — {e}"))?;
    let list = match &value {
        serde_json::Value::Array(list) => list.clone(),
        serde_json::Value::Object(map) => map
            .get("data")
            .and_then(serde_json::Value::as_array)
            .cloned()
            .ok_or_else(|| "в ответе endpoint'а нет списка моделей".to_string())?,
        _ => return Err("ответ endpoint'а — не список моделей".to_string()),
    };
    Ok(list
        .iter()
        .filter_map(|one| {
            one.get("id")
                .and_then(serde_json::Value::as_str)
                .map(str::to_string)
        })
        .collect())
}

/// Добавить свой endpoint: имя + база URL (+ ключ), модели спрашиваются с
/// самого endpoint'а, ключ — только в хранилище ОС. Тихий рестарт несёт
/// endpoint движку — его модели появляются в переключателе чата.
#[tauri::command]
pub fn endpoint_add(
    app: AppHandle,
    chat: State<'_, Chat>,
    name: String,
    base_url: String,
    key: String,
) -> Result<Vec<ProviderRow>, String> {
    let file = crate::providers_store::file(data_dir(&app));
    let key = key.trim().to_string();
    let models = endpoint_models(base_url.trim(), &key)?;
    if models.is_empty() {
        return Err("endpoint не отдал ни одной модели — проверьте базу URL".to_string());
    }
    let added = crate::providers_store::add_endpoint(&file, &name, &base_url, models)?;
    if !key.is_empty() {
        crate::providers::save(&crate::providers_store::key_id(&added.id), &key)?;
    }
    chat.restart()?;
    provider_list(app, chat)
}

/// Удалить свой endpoint: запись и её ключ уходят, движок после тихого
/// рестарта модели endpoint'а больше не отдаёт.
#[tauri::command]
pub fn endpoint_remove(app: AppHandle, chat: State<'_, Chat>, id: String) -> Result<Vec<ProviderRow>, String> {
    let file = crate::providers_store::file(data_dir(&app));
    crate::providers_store::remove_endpoint(&file, &id)?;
    let _ = crate::providers::remove(&crate::providers_store::key_id(&id));
    chat.restart()?;
    provider_list(app, chat)
}

/// «Нет ключа» у выбранного провайдера модели: причина строкой или None —
/// вопрос можно нести движку.
pub fn provider_key_missing(app: &AppHandle, chat: &State<'_, Chat>, model_id: &str) -> Option<String> {
    key_missing(&crate::providers_store::file(data_dir(app)), chat.endpoint(), model_id)
}

/// Тот же вопрос без типов окна: папка данных и адрес движка — аргументы,
/// её же зовёт проверка затвора (tests/providers_store.rs). Своему endpoint'у
/// ключ не обязателен; провайдеру движка хватает ключа в хранилище ОС или его
/// собственной активации (ключ в окружении, локальный сервер — провайдер в
/// списке ядра).
pub fn key_missing(
    file: &std::path::Path,
    engine: Option<crate::opencode::client::Endpoint>,
    model_id: &str,
) -> Option<String> {
    let provider = model_id.split('/').next().unwrap_or_default();
    if provider.is_empty() {
        return None;
    }
    let held = crate::providers_store::at(file);
    if crate::providers_store::endpoint(&held, provider).is_some() {
        return None;
    }
    if crate::providers::status(provider).unwrap_or(false) {
        return None;
    }
    if let Some(endpoint) = engine {
        let listed = Api::new(&endpoint)
            .providers()
            .ok()
            .and_then(|raw| raw.as_array().map(|list| list.clone()))
            .unwrap_or_default()
            .iter()
            .any(|one| one.get("id").and_then(serde_json::Value::as_str) == Some(provider));
        if listed {
            return None;
        }
    }
    Some(format!(
        "нет ключа — задайте в настройках (провайдер «{provider}»)"
    ))
}

/// Полный путь папки данных (вкладка «Папка данных»): показывает, где лежит
/// state.json и плагины. Смену пути окно не делает (Решено №9) — папку задаёт
/// запуск приложения: переменная проверок или папка данных Tauri.
#[tauri::command]
pub fn data_folder(app: AppHandle) -> Result<String, String> {
    let folder = std::env::var_os(crate::state::DATA_DIR_VAR)
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| data_dir(&app));
    Ok(folder.to_string_lossy().to_string())
}