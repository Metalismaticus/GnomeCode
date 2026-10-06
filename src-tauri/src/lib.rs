// Команды окна: только вызовы моста, вся логика — в `opencode`, `project` и `state`.
// Каждая команда через Result, ошибки наружу, не panic
// (docs/TESTING.md, «Здоровье кода»).

pub mod compare;
pub mod opencode;
pub mod plugins;
pub mod project;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;

use opencode::{Chat, WindowSink};
use plugins::commands::{catalog_list, plugin_connect, plugin_decide, plugin_disconnect, plugin_install, plugin_list, plugin_run, plugin_set_enabled, plugin_set_rule, plugin_toolset_connect, plugin_toolset_delete, plugin_toolset_save, plugin_toolsets, plugin_uninstall, plugin_updates_note};
use plugins::commands::data_dir;
use plugins::permissions::Grants;
use plugins::registry::Registry;
use project::Project;
use state::{AppState, StatePatch, Store};

use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// Состояние окна: сессия, титул чата, папка, тема. React знает структуру, не файл.
#[tauri::command]
fn state_get(store: State<'_, Arc<Store>>) -> Result<AppState, String> {
    Ok(store.load())
}

/// Правка состояния: названные поля, остальные мои — тема чат и папку не затирает.
#[tauri::command]
fn state_patch(patch: StatePatch, store: State<'_, Arc<Store>>) -> Result<AppState, String> {
    store.patch(&patch)
}

/// Выбрать папку проекта системным диалогом. `None` — владелец передумал.
#[tauri::command]
async fn project_pick_folder(
    app: AppHandle,
    project: State<'_, Project>,
    store: State<'_, Arc<Store>>,
) -> Result<Option<String>, String> {
    // Диалог системный: свой обход диска интерфейсу не нужен (docs/orders, Tauri 2).
    let picked = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or("Папка не выбрана".to_string())?;
    let path = picked
        .into_path()
        .map_err(|reason| format!("Папка не выбрана: {reason}"))?;
    project.set(path.clone());
    let root = path.to_string_lossy().to_string();
    store
        .patch(&StatePatch {
            project: Some(root.clone()),
            ..StatePatch::default()
        })
        .map_err(|reason| format!("папку выбрали, но запомнить не удалось: {reason}"))?;
    Ok(Some(root))
}

/// Одна папка проекта → её узлы. Дети подпапок приходят тем же вызовом по клику.
#[tauri::command]
fn project_read_tree(path: String) -> Result<Vec<project::Node>, String> {
    project::read_tree(std::path::Path::new(&path))
}

/// Отправить сообщение в сессию OpenCode. Ответ придёт событиями в ленту окна.
/// Прикреплённые файлы читает мост: движку уходит их содержимое, а в ленте видно имена.
#[tauri::command]
fn chat_send(
    chat: State<'_, Chat>,
    project: State<'_, Project>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
    text: String,
    files: Option<Vec<String>>,
) -> Result<(), String> {
    let files = files.unwrap_or_default();
    let sent = project::request(project.root().as_deref(), &text, &files)?;
    let model = store.load().chat_model;
    chat.send(&sent.shown, &sent.prompt, &sent.files, model)?;
    // Скоуп «Once» (docs/SPEC/plugins.md, сцена E): соединение служит текущему
    // запросу — следующий вопрос снимает плагин с чата, установка не трогается.
    registry.take_once();
    Ok(())
}

/// Каталог моделей: свежий с opencode.ai или из кэша (`compare.json` в папке
/// данных, узор `catalog_list`); доступность у провайдера решает движок.
#[tauri::command]
fn compare_list(app: AppHandle, chat: State<'_, Chat>) -> Result<compare::Snapshot, String> {
    let mut snapshot =
        compare::load(compare::CATALOG_URL, compare::PRICES_URL, &compare::file(data_dir(&app)))?;
    compare::availability(chat.endpoint(), &mut snapshot);
    Ok(snapshot)
}

/// То же с перечитыванием сайта: узор «Обновить» каталога плагинов — один путь.
#[tauri::command]
fn compare_refresh(app: AppHandle, chat: State<'_, Chat>) -> Result<compare::Snapshot, String> {
    compare_list(app, chat)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            catalog_list,
            chat_send,
            compare_list,
            compare_refresh,
            plugin_connect,
            plugin_decide,
            plugin_disconnect,
            plugin_install,
            plugin_list,
            plugin_run,
            plugin_set_enabled,
            plugin_set_rule,
            plugin_toolset_connect,
            plugin_toolset_delete,
            plugin_toolset_save,
            plugin_toolsets,
            plugin_uninstall,
            plugin_updates_note,
            project_pick_folder,
            project_read_tree,
            state_get,
            state_patch
        ])
        .setup(|app| {
            // Данные окна: что переживает перезапуск приложения. Папку данных даёт
            // переменная окружения (проверки и копии), иначе — папка данных Tauri.
            let store = Arc::new(Store::at(Store::location(
                std::env::var(state::DATA_DIR_VAR)
                    .ok()
                    .map(PathBuf::from),
                app.path()
                    .app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir()),
            )));
            let saved = store.load();
            app.manage(Arc::clone(&store));
            let project = Project::default();
            // Папка прошлого запуска: дерево файлов и отправка открываются уже готовы.
            if let Some(root) = saved.project {
                project.set(PathBuf::from(root));
            }
            app.manage(project);
            // Движок поднимается при старте окна, лента — тот же канал, что у проверки;
            // свой чат прошлого запуска возвращается по сохранённой сессии.
            app.manage(Chat::start(
                store,
                Arc::new(WindowSink(app.handle().clone())),
            ));
            // Автообновление плагинов (пункт 4 партии): фоновый поток — сеть не
            // блокирует запуск, окон ничего не открывает. Тихое обновление требует
            // рестарта (движок читает плагины только при старте), сломанное — отката.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                use plugins::updates;
                let chat = handle.state::<Chat>();
                let folder = std::env::var(state::DATA_DIR_VAR)
                    .ok()
                    .map(PathBuf::from)
                    .unwrap_or_else(|| handle.path().app_data_dir().unwrap_or_else(|_| std::env::temp_dir()));
                let done = updates::check_and_update(
                    plugins::install::CATALOG_URL,
                    &plugins::install::plugins_dir(),
                    &plugins::install::registry_file(folder.clone()),
                    &updates::file(folder.clone()),
                );
                // Сбой проверки (каталог, диск) — молча: работаем на текущих.
                let Ok(done) = done else { return };
                let _ = updates::follow_restart(
                    &done.applied,
                    &plugins::install::plugins_dir(),
                    &plugins::install::registry_file(folder.clone()),
                    &updates::file(folder.clone()),
                    updates::log_file(),
                    &mut || chat.restart(),
                );
                // Сбой отката — молча: прежняя пометка «сломано» уже в updates.json.
            });
            // Реестр плагинов чата: что владелец подключил кнопкой «+».
            app.manage(Registry::default());
            // Слой прав вызовов плагинов: правила этого чата, память окна.
            app.manage(Grants::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GnomeCode failed to start");
}
