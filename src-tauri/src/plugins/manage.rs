//! Действия карточки раздела «Плагинов» над записью реестра установленного:
//! выключение/включение (Enable/Disable) и удаление с файлом плагина (Uninstall,
//! после подтверждения интерфейса). Плагин движка вне реестра сюда не попадает:
//! у него записи нет, интерфейс не показывает ему эти кнопки
//! (docs/SPEC/plugins.md, сцена A).

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

use super::install::CatalogEntry;

/// Форма записи в файле реестра: как хранится `installed.json` (id → запись).
type Records = BTreeMap<String, CatalogEntry>;

fn read(registry: &Path) -> Records {
    fs::read(registry)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write(registry: &Path, records: &Records) -> Result<(), String> {
    let json = serde_json::to_string_pretty(records)
        .map_err(|e| format!("реестр установленного не собрался в JSON: {e}"))?;
    if let Some(parent) = registry.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(registry, json)
        .map_err(|e| format!("реестр установленного не записан {}: {e}", registry.display()))
}

/// Отметить запись выключенной или включённой. Ответ — была ли запись в реестре:
/// её отсутствие не ошибка, команда тогда ведёт выключение в реестре чата
/// (in-memory, как подключение). Плагин с записью помнит выключение и в файле.
pub fn set_disabled(id: &str, disabled: bool, registry: &Path) -> Result<bool, String> {
    let mut records = read(registry);
    let Some(record) = records.get_mut(id) else {
        return Ok(false);
    };
    record.disabled = disabled;
    write(registry, &records)?;
    Ok(true)
}

/// Удалить плагин: запись реестра и файл в папке плагинов движка. Отсутствие
/// файла не ошибка (движок мог его уже отцепить); нет записи — не удаляли,
/// ошибка: интерфейс не зовёт эту кнопку у плагина вне реестра.
pub fn remove(id: &str, registry: &Path, plugins_dir: &Path) -> Result<(), String> {
    let mut records = read(registry);
    let Some(record) = records.remove(id) else {
        return Err(format!("в реестре установленного нет записи о плагине «{id}»"));
    };
    write(registry, &records)?;
    let file = plugins_dir.join(format!("{}.ts", record.id));
    if file.exists() {
        fs::remove_file(&file)
            .map_err(|e| format!("файл плагина не удалён {}: {e}", file.display()))?;
    }
    Ok(())
}
