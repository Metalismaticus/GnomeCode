// Команды окна: только вызовы моста, вся логика — в `opencode` и `project`.
// Каждая команда через Result, ошибки наружу, не panic
// (docs/TESTING.md, «Здоровье кода»).

pub mod opencode;
pub mod project;

use std::sync::Arc;

use opencode::{Chat, WindowSink};
use project::Project;

use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command]
fn app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// Выбрать папку проекта системным диалогом. `None` — владелец передумал.
#[tauri::command]
async fn project_pick_folder(
    app: AppHandle,
    project: State<'_, Project>,
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
    Ok(Some(path.to_string_lossy().to_string()))
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
    text: String,
    files: Option<Vec<String>>,
) -> Result<(), String> {
    let files = files.unwrap_or_default();
    let sent = project::request(project.root().as_deref(), &text, &files)?;
    chat.send(&sent.shown, &sent.prompt)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            app_version,
            chat_send,
            project_pick_folder,
            project_read_tree
        ])
        .setup(|app| {
            // Движок поднимается при старте окна, лента — тот же канал, что у проверки.
            app.manage(Chat::start(Arc::new(WindowSink(app.handle().clone()))));
            // Папка проекта живёт до следующего выбора: её читают дерево и отправка.
            app.manage(Project::default());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GnomeCode failed to start");
}
