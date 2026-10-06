//! Правила плагинов: категории прав (`Read`, `Write`, `Network`, `Terminal`) со
//! значениями `allow` / `ask` / `deny` (docs/BATCH.md, пункт 3; docs/SPEC/plugins.md,
//! «Утверждённый UX одобрения» — denied-категории не спрашиваются никогда).
//!
//! Файл правил — `rules.json` в папке данных, отдельный от реестра установленного:
//! переустановка перетёрла бы поле в записи, а старые реестры без поля читаются.
//! Отсутствие файла или правила — норма: категория без правила ведёт себя как `ask`
//! («Спрашивать при первом использовании»). Читается на каждом вызове — смена
//! правила в Configure действует на следующий вызов без перезапуска.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use super::install;

const RULES_NAME: &str = "rules.json";

/// Категории прав панели Configure — порядок и на экране (PluginConfig.tsx).
pub const CATEGORIES: [&str; 4] = ["Read", "Write", "Network", "Terminal"];

/// Значения правила категории: allowed молча, ask окном, deny никогда.
pub const VALUES: [&str; 3] = ["allow", "ask", "deny"];

/// Правило категории по умолчанию: у спеки «права не объявлены — всё через Ask».
pub const DEFAULT: &str = "ask";

/// Файл правил в папке данных: путь собирает `install::data_file`, имя — одно здесь.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, RULES_NAME)
}

/// Что помнят правила: `id плагина → категория → значение`.
pub type Rules = BTreeMap<String, BTreeMap<String, String>>;

/// Правила из файла: испорченный или потерянный — пустые, как у реестра установленного.
pub fn at(file: &Path) -> Rules {
    fs::read(file)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Rules>(&bytes).ok())
        .unwrap_or_default()
}

/// Записать правило категории плагина: чтение, подмена своего, запись.
/// Значение и категорию проверяет команда окна ([`super::commands::plugin_set_rule`]).
pub fn set(file: &Path, plugin: &str, category: &str, value: &str) -> Result<(), String> {
    let mut rules = at(file);
    rules
        .entry(plugin.to_string())
        .or_default()
        .insert(category.to_string(), value.to_string());
    let json = serde_json::to_string_pretty(&rules)
        .map_err(|e| format!("правила не собрались в JSON: {e}"))?;
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file, json).map_err(|e| format!("правила не записаны {}: {e}", file.display()))
}

/// Правило категории плагина, если выставлено.
pub fn value_of<'a>(rules: &'a Rules, plugin: &str, category: &str) -> Option<&'a str> {
    rules.get(plugin)?.get(category).map(String::as_str)
}

/// Решение слоя прав по вызову.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    /// Запрещено правилом: строка «⚠ … denied», вызова не будет никогда.
    Deny,
    /// Исполняется молча: грант чата или правило allow.
    Run,
    /// Окно одобрения: правило ask или правила нет.
    Ask,
}

/// Решение по правилу и гранту чата, в порядке спеки: deny старше всего —
/// denied-категории не спрашиваются никогда, даже с выданным грантом чата;
/// allow исполняет молча; грант чата — то же; ask и отсутствие правила — окно.
pub fn decide(rule: Option<&str>, granted: bool) -> Decision {
    match rule {
        Some("deny") => Decision::Deny,
        Some("allow") => Decision::Run,
        _ if granted => Decision::Run,
        _ => Decision::Ask,
    }
}
