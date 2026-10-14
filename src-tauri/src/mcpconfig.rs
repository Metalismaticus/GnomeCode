//! MCP-серверы конфигурации движка (B6): секция `"mcp"` в opencode.json
//! владельца — список, включение/выключение, добавление local/remote.
//!
//! Формат движка: `{ "mcp": { "имя": { "type": "local"|"remote", "enabled":
//! bool, "command": [...]|"url": … } } }`. Конфиг переписывается целиком
//! (канонический JSON): комментарии в файле владельца не сохраняются —
//! ограничение честно видно в интерфейсе. Движок читает MCP при старте —
//! после правки нужен рестарт (команда окна его делает).
//!
//! Чужие ключи конфига не трогаются: правится только секция `mcp`.

use serde_json::{json, Value};
use std::path::Path;

/// Прочитать конфиг: файла нет или он не JSON — пустой объект (список пуст,
/// а первая правка начнёт файл с чистого листа — данные движка не тронуты).
fn read_config(path: &Path) -> Value {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_else(|| json!({}))
}

/// Записать конфиг: канонический pretty-JSON, папку создаёт.
fn write_config(path: &Path, value: &Value) -> Result<(), String> {
    let text = serde_json::to_string_pretty(value)
        .map_err(|e| format!("конфиг не собрался в JSON: {e}"))?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("папка конфига не создалась {}: {e}", parent.display()))?;
    }
    std::fs::write(path, text)
        .map_err(|e| format!("конфиг не записан {}: {e}", path.display()))
}

/// Секция mcp конфига: карта имя → элемент; не объект — пусто.
fn section(config: &Value) -> serde_json::Map<String, Value> {
    config
        .get("mcp")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

/// MCP-сервер глазами интерфейса: имя, тип, включённость и деталь (команда
/// локального или адрес удалённого) — одной строкой для списка настроек.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServer {
    pub name: String,
    /// `local` или `remote`.
    pub kind: String,
    pub enabled: bool,
    /// Команда локального (через пробел) или адрес удалённого.
    pub detail: String,
}

/// Список серверов конфига.
pub fn servers(path: &Path) -> Vec<McpServer> {
    section(&read_config(path))
        .iter()
        .map(|(name, item)| {
            let kind = item.get("type").and_then(Value::as_str).unwrap_or("local");
            let detail = match kind {
                "remote" => item
                    .get("url")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string(),
                _ => item
                    .get("command")
                    .and_then(Value::as_array)
                    .map(|list| {
                        list.iter()
                            .filter_map(Value::as_str)
                            .collect::<Vec<_>>()
                            .join(" ")
                    })
                    .unwrap_or_default(),
            };
            McpServer {
                name: name.clone(),
                kind: kind.to_string(),
                enabled: item.get("enabled").and_then(Value::as_bool).unwrap_or(true),
                detail,
            }
        })
        .collect()
}

/// Записать секцию mcp обратно в конфиг, чужие ключи не тронув.
fn write_section(path: &Path, mcp: serde_json::Map<String, Value>) -> Result<(), String> {
    let mut config = read_config(path);
    if !config.is_object() {
        config = json!({});
    }
    config["mcp"] = Value::Object(mcp);
    write_config(path, &config)
}

/// Включить или выключить сервер: правится только поле `enabled`.
pub fn set_enabled(path: &Path, name: &str, enabled: bool) -> Result<(), String> {
    let mut config = read_config(path);
    let mut mcp = section(&config);
    let Some(item) = mcp.get_mut(name) else {
        return Err(format!("сервера «{name}» нет в конфигурации"));
    };
    item["enabled"] = json!(enabled);
    config["mcp"] = Value::Object(mcp);
    write_config(path, &config)
}

/// Добавить сервер: `remote` — по адресу, `local` — по команде (через пробел).
pub fn add(path: &Path, name: &str, kind: &str, detail: &str) -> Result<(), String> {
    let name = name.trim();
    if name.is_empty() {
        return Err("имя сервера пустое".to_string());
    }
    let mut config = read_config(path);
    let mut mcp = section(&config);
    if mcp.contains_key(name) {
        return Err(format!("сервер «{name}» уже есть в конфигурации"));
    }
    let item = match kind {
        "remote" => {
            if !detail.starts_with("http://") && !detail.starts_with("https://") {
                return Err("адрес remote-сервера должен начинаться с http(s)://".to_string());
            }
            json!({ "type": "remote", "url": detail, "enabled": true })
        }
        _ => {
            let parts: Vec<&str> = detail.split_whitespace().collect();
            if parts.is_empty() {
                return Err("укажите команду локального сервера".to_string());
            }
            json!({ "type": "local", "command": parts, "enabled": true })
        }
    };
    mcp.insert(name.to_string(), item);
    write_section(path, mcp)
}

/// Удалить сервер из конфига.
pub fn remove(path: &Path, name: &str) -> Result<(), String> {
    let mut config = read_config(path);
    let mut mcp = section(&config);
    if mcp.remove(name).is_none() {
        return Err(format!("сервера «{name}» нет в конфигурации"));
    }
    write_section(path, mcp)
}

#[cfg(test)]
mod tests {
    use super::{add, remove, servers, set_enabled};
    use std::path::PathBuf;

    struct TempConfig(std::path::PathBuf);

    impl TempConfig {
        fn with_text(text: &str) -> TempConfig {
            let path = std::env::temp_dir().join(format!(
                "gnomecode-mcp-{}-{}.json",
                std::process::id(),
                text.len()
            ));
            std::fs::write(&path, text).expect("конфиг записан");
            TempConfig(path)
        }
    }

    impl Drop for TempConfig {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }

    /// Добавление, включение/выключение и удаление: чужие ключи конфига
    /// (модель, провайдеры) не трогаются, формат — local/remote.
    #[test]
    fn mcp_section_roundtrip_preserves_other_keys() {
        let held = TempConfig::with_text(
            r#"{"model": "glm-5.3", "provider": {"zhipuai": {}}, "mcp": {}}"#,
        );
        let path = held.0.clone();

        add(&path, "fs", "local", "bun x mcp-fs").expect("local добавлен");
        add(&path, "docs", "remote", "https://mcp.example.com").expect("remote добавлен");
        assert!(add(&path, "fs", "local", "other").is_err(), "дубль имени — отказ");

        set_enabled(&path, "fs", false).expect("выключен");
        let list = servers(&path);
        assert_eq!(list.len(), 2);
        let fs = list.iter().find(|one| one.name == "fs").expect("fs на месте");
        assert!(!fs.enabled && fs.kind == "local" && fs.detail == "bun x mcp-fs");

        remove(&path, "docs").expect("remote удалён");
        let list = servers(&path);
        assert_eq!(list.len(), 1, "остался только local");

        let text = std::fs::read_to_string(&path).expect("конфиг прочитан");
        assert!(
            text.contains("glm-5.3") && text.contains("zhipuai"),
            "чужие ключи конфига не тронуты: {text}"
        );
    }

    /// Битый конфиг: серверы не читаются (пусто), первая правка начинает
    /// секцию заново — данные движка в таком файле всё равно не читаемы.
    #[test]
    fn broken_config_starts_clean() {
        let held = TempConfig::with_text("{ не json");
        assert!(servers(&held.0).is_empty(), "битый конфиг — серверов нет");
        add(&held.0, "fs", "local", "bun x mcp-fs").expect("правка создаёт валидный JSON");
        let text = std::fs::read_to_string(&held.0).expect("конфиг переписан");
        assert!(text.contains("\"mcp\""), "секция mcp создана: {text}");
    }
}
