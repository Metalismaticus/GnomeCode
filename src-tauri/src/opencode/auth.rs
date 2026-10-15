//! Аутентификация движка: какие провайдеры подключены в самом OpenCode
//! (`opencode auth login` или `/connect` в TUI). GnomeCode хранилище движка
//! только читает — управляет им движок; секреты наружу не отдаём, наружу
//! только факт подключения («через движок ✓» в настройках).
//!
//! Хранилищ два (версии движка): новые держат credential'ы в SQLite
//! (`opencode.db`, таблица `credential`, колонка `integration_id`), старые —
//! в `auth.json` (ключи файла — id провайдеров). Читаем оба, объединяем.
//! Учётка OpenCode (OAuth-вход) покрывает семейство провайдеров opencode:
//! OpenCode, OpenCode Go, Zen. Живёт она в двух местах (замер v2.0.30,
//! 2026-10-15): старые движки — таблица `account`, новые — credential с
//! `integration_id = 'opencode'` (отдельного ключа у семейства не существует,
//! так что такой credential — всегда учётка).

use std::collections::BTreeSet;
use std::path::PathBuf;

use rusqlite::OpenFlags;

/// Папка данных движка: XDG_DATA_HOME уважается (изоляция проверок),
/// иначе `~/.local/share/opencode` — там его держит движок.
fn data_dir() -> PathBuf {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|home| PathBuf::from(home).join(".local").join("share"))
                .unwrap_or_default()
        })
        .join("opencode")
}

/// Старое хранилище: auth.json, ключи файла — id провайдеров.
fn from_json() -> BTreeSet<String> {
    let path = data_dir().join("auth.json");
    let Ok(bytes) = std::fs::read(path) else {
        return BTreeSet::new();
    };
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return BTreeSet::new();
    };
    value
        .as_object()
        .map(|map| map.keys().cloned().collect())
        .unwrap_or_default()
}

/// База движка только чтением; занята движком — читается параллельно (WAL),
/// не открылась — None, не ошибка.
fn open_db() -> Option<rusqlite::Connection> {
    let conn =
        rusqlite::Connection::open_with_flags(data_dir().join("opencode.db"), OpenFlags::SQLITE_OPEN_READ_ONLY)
            .ok()?;
    let _ = conn.busy_timeout(std::time::Duration::from_millis(300));
    Some(conn)
}

/// Новое хранилище: `SELECT DISTINCT integration_id FROM credential`.
fn from_db() -> BTreeSet<String> {
    let Some(conn) = open_db() else {
        return BTreeSet::new();
    };
    let mut set = BTreeSet::new();
    let Ok(mut stmt) = conn.prepare("SELECT DISTINCT integration_id FROM credential") else {
        return set;
    };
    let Ok(rows) = stmt.query_map([], |row| row.get::<_, Option<String>>(0)) else {
        return set;
    };
    for row in rows.flatten() {
        if let Some(id) = row {
            set.insert(id);
        }
    }
    set
}

/// Учётка OpenCode подключена (таблица `account` — OAuth-вход в движке).
fn account_connected() -> bool {
    let Some(conn) = open_db() else {
        return false;
    };
    conn.query_row("SELECT COUNT(*) FROM account", [], |row| {
        row.get::<_, i64>(0)
    })
    .map(|count| count > 0)
    .unwrap_or(false)
}

/// Провайдеры, подключённые в самом движке: объединение обоих хранилищ.
pub fn connected() -> BTreeSet<String> {
    let mut set = from_json();
    set.extend(from_db());
    set
}

/// Семейство opencode покрыто учёткой: она в таблице `account` (старые движки)
/// или в credential с `integration_id = 'opencode'` (v2.0.30).
fn family_connected() -> bool {
    account_connected() || connected().contains("opencode")
}

/// Покрыт ли провайдер аутентификацией движка: точное вхождение в хранилищах
/// или семейство opencode под учёткой (OpenCode, OpenCode Go, Zen — модели
/// работают под токеном учётной записи, ключа у них не существует).
pub fn covers(provider_id: &str) -> bool {
    if provider_id.starts_with("opencode") && family_connected() {
        return true;
    }
    connected().contains(provider_id)
}

#[cfg(test)]
mod tests {
    use super::{connected, covers, data_dir, family_connected};
    use rusqlite::Connection;
    use std::path::PathBuf;

    struct TempDir(PathBuf);

    impl TempDir {
        /// Своя папка данных на процесс теста: data_dir() уважает XDG_DATA_HOME,
        /// данные владельца не трогаются (docs/TESTING.md, «Данные пользователя»).
        fn isolate(name: &str) -> TempDir {
            let base = std::env::temp_dir().join(format!(
                "gnomecode-engine-auth-{}-{name}",
                std::process::id()
            ));
            // data_dir() = base/opencode — папку создаём сразу: тесты пишут
            // auth.json и базу в неё.
            std::fs::create_dir_all(base.join("opencode")).expect("папка данных создана");
            std::env::set_var("XDG_DATA_HOME", &base);
            TempDir(base)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Один тест на модуль: сценарии трогают XDG_DATA_HOME, а env общий на
    /// потоки — параллельные тесты гонялись бы за переменной. auth.json и
    /// база объединяются; учётка opencode покрывает семейство opencode-*;
    /// кривой файл и отсутствие хранилищ — пусто, не ошибка.
    #[test]
    fn connected_reads_both_stores() {
        let _temp = TempDir::isolate("both");
        // auth.json: провайдер.
        std::fs::write(
            data_dir().join("auth.json"),
            r#"{"anthropic": {"type": "oauth"}}"#,
        )
        .expect("auth.json записан");
        let providers = connected();
        assert!(providers.contains("anthropic"));

        // База: credential с integration_id — объединяется с auth.json.
        let conn = Connection::open(data_dir().join("opencode.db")).expect("база создана");
        conn.execute(
            "CREATE TABLE credential (id text PRIMARY KEY, integration_id text, label text NOT NULL, value text NOT NULL)",
            [],
        )
        .expect("таблица создана");
        conn.execute(
            "INSERT INTO credential (id, integration_id, label, value) VALUES ('c1', 'zai-coding-plan', 'Z.AI Coding Plan', 'sk')",
            [],
        )
        .expect("credential вставлен");
        let providers = connected();
        assert!(providers.contains("zai-coding-plan"), "база движка прочитана");
        assert!(providers.contains("anthropic"), "auth.json не потерян");

        // Семейство opencode без точного id: без учётки не покрыто —
        // OpenCode Go и Zen отдельного ключа не имеют.
        assert!(!covers("opencode-go"), "без учётки семейство не покрыто");

        // v2.0.30: учётка — credential с integration_id «opencode»,
        // таблица account пуста. Семейство покрыто и так.
        conn.execute(
            "INSERT INTO credential (id, integration_id, label, value) VALUES ('c2', 'opencode', 'Personal', 'tok')",
            [],
        )
        .expect("credential учётки вставлен");
        assert!(covers("opencode-go"), "credential «opencode» покрывает OpenCode Go");
        assert!(covers("opencode"), "credential «opencode» покрывает самого OpenCode");
        assert!(family_connected(), "семейство покрыто credential'ом");

        // Старое хранилище учётки (таблица account) тоже покрывает семейство.
        conn.execute(
            "CREATE TABLE account (email text NOT NULL, url text NOT NULL, access_token text NOT NULL)",
            [],
        )
        .expect("таблица account создана");
        conn.execute(
            "INSERT INTO account (email, url, access_token) VALUES ('me@example.com', 'https://opencode.ai', 'tok')",
            [],
        )
        .expect("account вставлен");
        assert!(covers("opencode-go"), "учётка opencode покрывает OpenCode Go");
        assert!(covers("opencode"), "учётка покрывает самого OpenCode");

        // Пустые хранилища — пустое множество, не ошибка. Соединение закрываем
        // до удаления базы: открытый handle держит файл занятым.
        std::fs::remove_file(data_dir().join("auth.json")).expect("auth.json убран");
        drop(conn);
        std::fs::remove_file(data_dir().join("opencode.db")).expect("база убран");
        assert!(connected().is_empty(), "нет хранилищ — никого");
    }
}
