// Команды каркаса: UI пока не зовёт их — появятся с мостом к OpenCode (Этап 1).
// Каждая команда — через Result, ошибки наружу, не panic (docs/TESTING.md, «Здоровье кода»).

#[tauri::command]
fn app_version() -> Result<String, String> {
    Ok(env!("CARGO_PKG_VERSION").to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_version])
        .run(tauri::generate_context!())
        .expect("GnomeCode failed to start");
}
