//! Хранилище состояния окна: файл state.json в папке данных, правка одного поля
//! остальное не трогает, испорченный файл — дефолты без паники. Путь и структура —
//! открытый (`state::`, ADR-0001: интерфейс знает структуру, не файл).
//!
//! Данные — во временной папке, базу владельца проверки не трогают
//! (docs/TESTING.md, «Данные пользователя»). Гоняет `tests/checks/state_files.py`.

use std::path::PathBuf;

use gnomecode_lib::state::{AppState, Store, StatePatch, Theme};

/// Свой файл состояния во временной папке: тесты одного процесса идут параллельно.
fn scratch(name: &str) -> PathBuf {
    let file = std::env::temp_dir().join(format!(
        "gnomecode-state-{name}-{}.json",
        std::process::id()
    ));
    let _ = std::fs::remove_file(&file);
    file
}

/// Сессия и тема переживают «перезапуск приложения» (новое чтение того же файла),
/// правка темы чат и папку не затирает.
#[test]
fn state_survives_restart_and_theme_patch_keeps_the_rest() {
    let file = scratch("patched");
    let running = Store::at(file.clone());
    running
        .patch(&StatePatch {
            session: Some("ses_predshop".to_string()),
            ..StatePatch::default()
        })
        .expect("сессия запомнилась");
    running
        .patch(&StatePatch {
            theme: Some(Theme::Light),
            ..StatePatch::default()
        })
        .expect("тема запомнилась");

    let reopened = Store::at(file);
    let state = reopened.load();
    assert_eq!(
        state.session.as_deref(),
        Some("ses_predshop"),
        "после перезапуска открытая сессия на месте: {state:?}"
    );
    assert_eq!(
        state.theme,
        Some(Theme::Light),
        "после перезапуска тема на месте: {state:?}"
    );
    assert_eq!(
        state.chat_title, None,
        "титул чата титула первого вопроса не выдаётся заранее: {state:?}"
    );
    assert_eq!(state.project, None, "папку не выбирали — поле пусто: {state:?}");
}

/// Пины и недавние плагинов переживают «перезапуск приложения», правка одного
/// поля остальное не трогает — та же форма, что у темы и папки.
#[test]
fn plugin_pins_and_recent_survive_restart() {
    let file = scratch("plugins");
    let running = Store::at(file.clone());
    running
        .patch(&StatePatch {
            plugin_favorites: Some(vec!["git".to_string(), "docs".to_string()]),
            ..StatePatch::default()
        })
        .expect("пины запомнились");
    running
        .patch(&StatePatch {
            plugin_recent: Some(vec!["docs".to_string()]),
            ..StatePatch::default()
        })
        .expect("недавние запомнились");

    let reopened = Store::at(file);
    let state = reopened.load();
    assert_eq!(
        state.plugin_favorites,
        Some(vec!["git".to_string(), "docs".to_string()]),
        "пины плагинов после перезапуска: {state:?}"
    );
    assert_eq!(
        state.plugin_recent,
        Some(vec!["docs".to_string()]),
        "недавние подключения после перезапуска: {state:?}"
    );
    assert_eq!(
        state.theme, None,
        "правки плагинов не задевают чат и папку: {state:?}"
    );
}

/// Потерянный и испорченный файл — пустое состояние, окно открывается заново без паники.
#[test]
fn absent_or_broken_file_gives_defaults_without_panic() {
    assert_eq!(
        Store::at(scratch("missing")).load(),
        AppState::default(),
        "файла нет — состояние пустое"
    );
    let file = scratch("garbage");
    std::fs::write(&file, "{\"session\": сломан".as_bytes()).expect("мусор записан");
    assert_eq!(
        Store::at(file).load(),
        AppState::default(),
        "испорченный файл — состояние пустое, не паника"
    );
}

/// Папка данных: переменная окружения для проверок ходит своей папкой, иначе —
/// папка данных приложения (docs/TESTING.md, «Данные пользователя»).
#[test]
fn data_dir_variable_points_into_its_folder() {
    assert_eq!(
        Store::location(Some(PathBuf::from("C:\\копии")), PathBuf::from("C:\\приложение")),
        PathBuf::from("C:\\копии\\state.json"),
        "переменная окружения указывает папку данных"
    );
    assert_eq!(
        Store::location(None, PathBuf::from("C:\\приложение")),
        PathBuf::from("C:\\приложение\\state.json"),
        "без переменной — папка данных приложения"
    );
}
