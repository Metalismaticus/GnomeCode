// Команды окна: только вызовы моста, вся логика — в `opencode`. Каждая команда через
// Result, ошибки наружу, не panic (docs/TESTING.md, «Здоровье кода»).

pub mod opencode;

use std::sync::Arc;

use opencode::{Chat, WindowSink};
use tauri::{Manager, State};

#[tauri::command]
fn app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

/// Отправить сообщение в сессию OpenCode. Ответ придёт событиями в ленту окна.
#[tauri::command]
fn chat_send(chat: State<'_, Chat>, text: String) -> Result<(), String> {
    chat.send(&text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_version, chat_send])
        .setup(|app| {
            // Движок поднимается при старте окна, лента — тот же канал, что у проверки.
            app.manage(Chat::start(Arc::new(WindowSink(app.handle().clone()))));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("GnomeCode failed to start");
}
