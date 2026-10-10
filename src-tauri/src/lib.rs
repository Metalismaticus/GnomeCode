// Команды окна: только вызовы моста, вся логика — в `opencode`, `project` и `state`.
// Каждая команда через Result, ошибки наружу, не panic
// (docs/TESTING.md, «Здоровье кода»).

pub mod compare;
pub mod opencode;
pub mod plugins;
pub mod project;
pub mod providers;
pub mod providers_store;
pub mod state;
pub mod stats;

use std::path::PathBuf;
use std::sync::Arc;

use opencode::{Chat, Sink, WindowSink};
use plugins::commands::{catalog_list, data_folder, endpoint_add, endpoint_remove, key_remove, key_save, key_status, plugin_connect, plugin_decide, plugin_disconnect, plugin_install, plugin_list, plugin_run, plugin_set_enabled, plugin_set_rule, plugin_toolset_connect, plugin_toolset_delete, plugin_toolset_save, plugin_toolsets, plugin_uninstall, plugin_updates_note, provider_list, provider_set_enabled, settings_defaults, settings_set_default};
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

/// Системные действия окна без рамки (docs/ROADMAP.md, «Окно без рамки: своя шапка»):
/// своя шапка интерфейса зовёт их через мост, `WebviewWindow` — окно вызвавшей
/// кнопки, его даёт сам Tauri. Обёртки над методами окна, своей логики нет.
#[tauri::command]
fn window_minimize(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    webview_window.minimize().map_err(|reason| reason.to_string())
}

#[tauri::command]
fn window_toggle_maximize(webview_window: tauri::WebviewWindow) -> Result<bool, String> {
    let was_maximized = webview_window
        .is_maximized()
        .map_err(|reason| reason.to_string())?;
    if was_maximized {
        webview_window
            .unmaximize()
            .map_err(|reason| reason.to_string())?;
    } else {
        webview_window
            .maximize()
            .map_err(|reason| reason.to_string())?;
    }
    Ok(!was_maximized)
}

#[tauri::command]
fn window_close(webview_window: tauri::WebviewWindow) -> Result<(), String> {
    webview_window.close().map_err(|reason| reason.to_string())
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
    app: AppHandle,
    chat: State<'_, Chat>,
    project: State<'_, Project>,
    registry: State<'_, Registry>,
    store: State<'_, Arc<Store>>,
    text: String,
    files: Option<Vec<String>>,
) -> Result<(), String> {
    let files = files.unwrap_or_default();
    let sent = project::request(project.root().as_deref(), &text, &files)?;
    // Модель запроса: своя модель чата, иначе — модель по умолчанию настроек
    // (docs/specs/2026-10-06-12-nastrojki.md, «Модель по умолчанию»); нет и её —
    // как раньше, модели движка.
    let saved = store.load();
    let model = saved.chat_model.or(saved.default_model);
    // У провайдера модели нет ключа — в ленте строка «нет ключа — задайте в
    // настройках», запрос движку не уходит (критерий провайдеров, 2026-10-09):
    // лента знает отказ через ответ команды (useFeed показывает его строкой).
    if let Some(choice) = &model {
        if let Some(reason) = plugins::commands::provider_key_missing(&app, &chat, &choice.id) {
            return Err(reason);
        }
    }
    chat.send(&sent.shown, &sent.prompt, &sent.files, model)?;
    // Скоуп «Once» (docs/SPEC/plugins.md, сцена E): соединение служит текущему
    // запросу — следующий вопрос снимает плагин с чата, установка не трогается.
    registry.take_once();
    Ok(())
}

/// «Новый чат»: лента чистится событием `reset`, движку поднимается новая
/// сессия — прошлый чат остаётся в списке сессий движка, не удаляется.
#[tauri::command]
fn chat_new(chat: State<'_, Chat>) -> Result<(), String> {
    chat.new_chat()
}

/// Живой список чатов ядра для сайдбара: титулы и время обновления одним
/// запросом (спека сайдбара §7); форму элемента знает только `session.rs`
/// (ADR-0001). Движок не поднят — ошибка наружу: сайдбар живёт тем, что уже
/// передало окно, поломки нет.
#[tauri::command]
fn chat_list(chat: State<'_, Chat>) -> Result<Vec<opencode::session::ChatRow>, String> {
    let endpoint = chat
        .endpoint()
        .ok_or_else(|| "Движок OpenCode не запущен: список чатов недоступен".to_string())?;
    opencode::session::chats(&opencode::client::Api::new(&endpoint))
}

/// Недошедшие до вебвью строки ленты: интерфейс просит их после первой
/// подписки — движок успел сказать «поднимается…» до того, как окно появилось.
#[tauri::command]
fn feed_replay(replay: State<'_, Arc<WindowSink>>) -> Result<(), String> {
    replay.replay();
    Ok(())
}

/// Каталог моделей: свежий с opencode.ai или из кэша (`compare.json` в папке
/// данных, узор `catalog_list`); доступность у провайдера решает движок.
///
/// Кэш-первый и асинхронно: у приветствия (`EmptyChat`) и панели таблица
/// открывается сразу с диска, сеть ходит только «Обновить» (`compare_refresh`)
/// — иначе первый рендер стоял на скачивании каталога (~11 МБ) и хлопьях
/// availability, замер 2026-10-07: 3,9 + 3,3 с тёплой сети, до 60 с медленной.
#[tauri::command]
async fn compare_list(app: AppHandle, chat: State<'_, Chat>) -> Result<compare::Snapshot, String> {
    let path = compare::file(data_dir(&app));
    let mut snapshot = if let Some(cached) = compare::fresh_cache(&path) {
        cached
    } else {
        // Кэша нет (первый запуск): каталог с сайта, он же в кэш этого запуска.
        compare::load(compare::CATALOG_URL, compare::PRICES_URL, &path)?
    };
    let disabled = providers_store::at(&providers_store::file(data_dir(&app))).disabled;
    compare::availability(chat.endpoint(), &mut snapshot, &disabled);
    Ok(snapshot)
}

/// То же с перечитыванием сайта: узор «Обновить» каталога плагинов — один путь.
/// Асинхронно по той же причине, что `compare_list`: сеть не замораживает окно.
#[tauri::command]
async fn compare_refresh(app: AppHandle, chat: State<'_, Chat>) -> Result<compare::Snapshot, String> {
    let path = compare::file(data_dir(&app));
    let mut snapshot = compare::load(compare::CATALOG_URL, compare::PRICES_URL, &path)?;
    let disabled = providers_store::at(&providers_store::file(data_dir(&app))).disabled;
    compare::availability(chat.endpoint(), &mut snapshot, &disabled);
    Ok(snapshot)
}

/// Сводка расхода для раздела «Статистика»: суммы по stats.jsonl считает
/// stats.rs одним вызовом — экран тысяч строк не видит. Цены берутся только
/// из кэша сравнения (`compare::fresh_cache`), сеть не зовётся: «Обновить
/// цены» остаётся кнопкой панели сравнения.
#[tauri::command]
fn stats_summary(app: AppHandle, period: String) -> Result<stats::Summary, String> {
    let prices = compare::fresh_cache(&compare::file(data_dir(&app)));
    stats::summary(&stats::file(), &period, prices.as_ref())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    crate::opencode::mark_start();
    crate::opencode::log_startup("процесс запущен");
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            catalog_list,
            chat_list,
            chat_new,
            chat_send,
            compare_list,
            compare_refresh,
            feed_replay,
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
            endpoint_add,
            endpoint_remove,
            key_save,
            key_remove,
            key_status,
            provider_list,
            provider_set_enabled,
            data_folder,
            settings_defaults,
            settings_set_default,
            state_get,
            state_patch,
            stats_summary,
            window_minimize,
            window_toggle_maximize,
            window_close
        ])
        .setup(|app| {
            crate::opencode::log_startup("setup начат");
            // Данные окна: что переживает перезапуск приложения. Папку данных даёт
            // переменная окружения (проверки и копии), иначе — папка данных Tauri.
            let data_folder = std::env::var(state::DATA_DIR_VAR)
                .ok()
                .map(PathBuf::from)
                .unwrap_or_else(|| {
                    app.path()
                        .app_data_dir()
                        .unwrap_or_else(|_| std::env::temp_dir())
                });
            let store = Arc::new(Store::at(Store::location(
                Some(data_folder.clone()),
                data_folder.clone(),
            )));
            // Конфиг провайдеров (providers.json) движок читает из этой папки на
            // каждом подъёме: endpoint'ы и включённость — свежими после рестарта.
            crate::opencode::engine::set_config_folder(data_folder.clone());
            // stats.jsonl живёт в той же папке данных — один источник пути.
            crate::stats::set_folder(data_folder);
            let saved = store.load();
            app.manage(Arc::clone(&store));
            let project = Project::default();
            // Папка прошлого запуска: дерево файлов и отправка открываются уже готовы.
            if let Some(root) = saved.project {
                project.set(PathBuf::from(root));
            }
            app.manage(project);
            // Движок поднимается в фоне, лента — тот же канал, что у проверки;
            // свой чат прошлого запуска возвращается по сохранённой сессии.
            // Подписчик окна один экземпляр: же буфер недошедших строк реплеится
            // командой `feed_replay` после первой подписки интерфейса.
            let window_sink = Arc::new(WindowSink::new(app.handle().clone()));
            app.manage(Arc::clone(&window_sink));
            app.manage(Chat::start(
                store,
                window_sink as Arc<dyn Sink>,
            ));
            crate::opencode::log_startup("setup закончен");
            // Автообновление плагинов (пункт 4 партии): фоновый поток — сеть не
            // блокирует запуск, окон ничего не открывает. Тихое обновление требует
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
