//! Аутентификация движка (auth.json): какие провайдеры подключены в самом
//! OpenCode (`opencode auth login` или `/connect` в TUI). GnomeCode файл
//! только читает — управляет им движок; секреты наружу не отдаём, наружу
//! только факт подключения («через движок ✓» в настройках).

use std::collections::BTreeSet;
use std::path::PathBuf;

/// Файл аутентификации движка: XDG_DATA_HOME уважается (изоляция проверок),
/// иначе `~/.local/share/opencode/auth.json` — там его держит движок.
pub fn file() -> PathBuf {
    std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|home| PathBuf::from(home).join(".local").join("share"))
                .unwrap_or_default()
        })
        .join("opencode")
        .join("auth.json")
}

/// Провайдеры, подключённые в самом движке: ключи файла — их идентификаторы
/// (`{"opencode-go": {...}, "anthropic": {...}}`). Файла нет или он кривой —
/// пустое множество: «не подключён никто», не ошибка.
pub fn connected() -> BTreeSet<String> {
    let Ok(bytes) = std::fs::read(file()) else {
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

#[cfg(test)]
mod tests {
    use super::{connected, file};
    use std::path::PathBuf;

    struct TempDir(PathBuf);

    impl TempDir {
        /// Своя папка данных на процесс теста: file() уважает XDG_DATA_HOME,
        /// данные владельца не трогаются (docs/TESTING.md, «Данные пользователя»).
        fn isolate(name: &str) -> TempDir {
            let base = std::env::temp_dir().join(format!(
                "gnomecode-engine-auth-{}-{name}",
                std::process::id()
            ));
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

    /// Один тест на модуль: оба сценария трогают XDG_DATA_HOME, а env общий на
    /// потоки — параллельные тесты гонялись бы за переменной (упало и так).
    /// Ключи auth.json — идентификаторы провайдеров; кривой файл и отсутствие —
    /// пустое множество, не ошибка.
    #[test]
    fn connected_reads_provider_ids() {
        let _temp = TempDir::isolate("connected");
        std::fs::write(
            file(),
            r#"{"opencode-go": {"type": "api", "key": "sk"}, "anthropic": {"type": "oauth"}}"#,
        )
        .expect("auth.json записан");
        let providers = connected();
        assert!(providers.contains("opencode-go"));
        assert!(providers.contains("anthropic"));
        assert_eq!(providers.len(), 2);

        std::fs::write(file(), b"{ broken").expect("кривой файл записан");
        assert!(connected().is_empty(), "кривой auth.json — никого");

        std::fs::remove_file(file()).expect("файл убран");
        assert!(connected().is_empty(), "файла нет — никого");
    }
}
