//! Живой движок OpenCode: подъём на своём порту, сессия, падение и подъём снова.
//!
//! Данные движка изолированы: XDG_DATA_HOME и XDG_CONFIG_HOME уходят во временную
//! папку, иначе проверка создавала бы сессии в базе владельца (docs/TESTING.md,
//! «Данные пользователя»). Изолированный движок не знает авторизации владельца и
//! живой ответ модели не даст — это ожидаемо, ключи владельца не наш вход.
//!
//! Проверку гоняет `tests/checks/opencode_engine.py`.

use std::sync::atomic::{AtomicBool, Ordering};

use gnomecode_lib::opencode::client::Api;
use gnomecode_lib::opencode::engine::{locate, Engine};

static ISOLATED: AtomicBool = AtomicBool::new(false);

/// Изолировать данные движка один раз на весь процесс: переменные окружения общие
/// у всех тестов, второй раз ставить их нельзя — первый вызов уже сработал бы.
fn isolate_data() {
    if ISOLATED.swap(true, Ordering::SeqCst) {
        return;
    }
    let base = std::env::temp_dir().join(format!("gnomecode-engine-{}", std::process::id()));
    for key in ["XDG_DATA_HOME", "XDG_CONFIG_HOME"] {
        std::fs::create_dir_all(base.join(key)).expect("временная папка движка создана");
        std::env::set_var(key, base.join(key));
    }
}

#[test]
fn engine_answers_survives_a_crash_and_comes_back_on_the_same_port() {
    let found = match locate() {
        Ok(exe) => exe,
        Err(reason) => {
            panic!("движок не найден: {reason}");
        }
    };
    assert!(
        found.is_file(),
        "движок по найденному пути — файл: {}",
        found.display()
    );

    isolate_data();
    let mut engine = Engine::start().expect("движок поднялся и /api/config ответил");
    let port = engine.port();
    let endpoint = engine.endpoint();
    let session = Api::new(&endpoint)
        .create_session("Проверка движка")
        .expect("сессия создана на живом движке");
    assert!(
        !session.is_empty(),
        "живой движок вернул идентификатор сессии: {session:?}"
    );

    engine.stop();
    assert!(
        !engine.alive(),
        "после убийства движок не должен считаться живым"
    );
    engine
        .restart()
        .expect("движок поднялся снова после падения");
    assert_eq!(engine.port(), port, "адрес после перезапуска не меняется");
    assert!(engine.alive(), "перезапущенный движок жив");
    let again = Api::new(&engine.endpoint())
        .create_session("После перезапуска")
        .expect("после перезапуска движок снова отвечает");
    assert!(
        !again.is_empty(),
        "сессия после перезапуска создана: {again:?}"
    );
}
