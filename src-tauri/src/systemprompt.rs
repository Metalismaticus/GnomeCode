//! Системный промт (B9): текст инструкций владельца — файл
//! `instructions.md` в папке данных; путь включается в конфиг движка
//! (`instructions`, официальный ключ opencode.json) при каждом запуске.
//! Индивидуальный промт на конкретный чат движком пока не поддерживается —
//! честно видно в интерфейсе (заметка в поле).

use std::fs;
use std::path::{Path, PathBuf};

use crate::plugins::install;

const FILE_NAME: &str = "instructions.md";

/// Файл инструкций в папке данных.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, FILE_NAME)
}

/// Прочитать текст инструкций: нет файла — пусто.
pub fn read(file_path: &Path) -> String {
    fs::read_to_string(file_path).unwrap_or_default()
}

/// Сохранить текст инструкций: папку создаёт; пустой текст удаляет файл
/// (промт сброшен). Путь к файлу уходит в конфиг движка при старте
/// (provider_launch → OPENCODE_CONFIG_CONTENT.instructions).
pub fn write(file_path: &Path, text: &str) -> Result<(), String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        match fs::remove_file(file_path) {
            Ok(()) => return Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
            Err(e) => return Err(format!("файл инструкций не удалён {}: {e}", file_path.display())),
        }
    }
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file_path, trimmed)
        .map_err(|e| format!("инструкции не записаны {}: {e}", file_path.display()))
}

#[cfg(test)]
mod tests {
    use super::{read, write};
    use std::path::PathBuf;

    struct TempDir(std::path::PathBuf);

    impl TempDir {
        fn new(name: &str) -> TempDir {
            let path = std::env::temp_dir().join(format!("gnomecode-sysprompt-{}-{name}", std::process::id()));
            std::fs::create_dir_all(&path).expect("временная папка создана");
            TempDir(path)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Запись → чтение; пустой текст удаляет файл (промт сброшен).
    #[test]
    fn write_read_and_reset() {
        let data = TempDir::new("roundtrip");
        let file_path = data.0.join("instructions.md");

        write(&file_path, "Ты — аккуратный помощник проекта.").expect("инструкции записаны");
        assert_eq!(read(&file_path), "Ты — аккуратный помощник проекта.");

        write(&file_path, "   ").expect("пустой текст — сброс без ошибки");
        assert!(!file_path.is_file(), "файл инструкций удалён при сбросе");
    }
}
