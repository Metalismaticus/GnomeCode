//! Импорт существующей конфигурации OpenCode (CE-1): при старте окна пакеты
//! из `opencode.json` владельца попадают в реестр установленного как
//! «импортированные, отключённые» — включение каждого проходит сцену H.
//!
//! Правила юнита: ре-импорт добавляет только новые записи, ключ дедупликации
//! — имя npm-пакета (1.2); существующие записи не перезаписываются; проектные
//! opencode.json не трогаются — источник только глобальный (Ф-1). Жизненным
//! циклом импортированного ведёт сам движок: файла и репозитория у нас нет,
//! автообновление такие записи не трогает (1.1) — переход под управление
//! реестра каталога (П-1) сделает сборка реестра (T5), когда появится индекс.
//!
//! Сбой чтения конфига — тихий пропуск (S2): старт окна не блокируется.

use std::fs;
use std::path::{Path, PathBuf};

use super::install::{self, CatalogEntry, Source};

/// Глобальная конфигурация владельца: наблюдаемый путь OpenCode на Windows
/// (Ф-1) — `%USERPROFILE%\.config\opencode\opencode.json`; нет — fallback
/// `%APPDATA%\opencode\opencode.json`. Файла нет нигде — импорта нет.
pub fn config_path() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(home) = std::env::var_os("USERPROFILE") {
        candidates.push(
            PathBuf::from(home)
                .join(".config")
                .join("opencode")
                .join("opencode.json"),
        );
    }
    if let Some(app) = std::env::var_os("APPDATA") {
        candidates.push(
            PathBuf::from(app)
                .join("opencode")
                .join("opencode.json"),
        );
    }
    candidates.into_iter().find(|path| path.is_file())
}

/// Что вышло из разбора конфига: имена пакетов для реестра и отброшенные
/// записи с причиной (F-DX-10) — окно первого запуска покажет «Распознано
/// N из M» по этим двум спискам.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Parsed {
    /// Имена npm-пакетов — кандидаты в реестр.
    pub packages: Vec<String>,
    /// Отброшенные: запись и причина словами.
    pub skipped: Vec<(String, String)>,
}

/// Разбор конфига: ключ `plugin` — список; строки без пути и версии — имена
/// npm-пакетов, остальное — пропуск с причиной. Не JSON и ключа нет — пустой
/// разбор: импортировать нечего, а не ошибка.
pub fn parse(text: &str) -> Parsed {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(text) else {
        return Parsed {
            packages: vec![],
            skipped: vec![(
                "opencode.json".to_string(),
                "файл не читается как JSON".to_string(),
            )],
        };
    };
    let Some(list) = value.get("plugin").and_then(serde_json::Value::as_array) else {
        return Parsed {
            packages: vec![],
            skipped: vec![],
        };
    };
    let mut parsed = Parsed {
        packages: vec![],
        skipped: vec![],
    };
    for entry in list {
        let Some(raw) = entry.as_str() else {
            parsed.skipped.push((
                entry.to_string(),
                "запись не строка — не имя npm-пакета".to_string(),
            ));
            continue;
        };
        let name = raw.trim();
        if is_npm_name(name) {
            if !parsed.packages.iter().any(|known| known == name) {
                parsed.packages.push(name.to_string());
            }
        } else if name.contains('/') && !name.starts_with('@') {
            parsed.skipped.push((
                raw.to_string(),
                "локальный путь — движок грузит его сам".to_string(),
            ));
        } else {
            parsed.skipped.push((
                raw.to_string(),
                "не похоже на имя npm-пакета".to_string(),
            ));
        }
    }
    parsed
}

/// Имя npm-пакета: `имя` или `@область/имя`, строчные латиница-цифры-дефисы.
fn is_npm_name(name: &str) -> bool {
    let (scope, bare) = match name.strip_prefix('@') {
        Some(rest) => match rest.split_once('/') {
            Some((scope, bare)) => (Some(scope), bare),
            None => return false,
        },
        None => (None, name),
    };
    if let Some(scope) = scope {
        if scope.is_empty() || !clean_npm(scope) {
            return false;
        }
    }
    !bare.is_empty() && clean_npm(bare)
}

fn clean_npm(part: &str) -> bool {
    part.chars()
        .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || matches!(c, '-' | '_' | '.'))
}

/// Записать импортированные пакеты в реестр: только новые (1.2), каждая —
/// «установлена, отключена» (CE-1). Ответ — сколько добавлено.
pub fn record_new(registry: &Path, packages: &[String]) -> Result<usize, String> {
    let mut known = install::records(registry);
    let mut added = 0usize;
    for name in packages {
        if known.contains_key(name) {
            continue;
        }
        known.insert(
            name.clone(),
            CatalogEntry {
                id: name.clone(),
                name: name.clone(),
                description: "импортирован из вашей конфигурации OpenCode".to_string(),
                author: String::new(),
                version: String::new(),
                repo: String::new(),
                entry: String::new(),
                permissions: vec![],
                commands: vec![],
                disabled: true,
                source: Source::Imported,
            },
        );
        added += 1;
    }
    if added > 0 {
        install::save_records(registry, &known)?;
    }
    Ok(added)
}

/// Пакеты, добавленные последним ходом импорта при старте: экран первого
/// запуска и тост «Найден новый плагин» показывают свежее (при следующем
/// запуске ре-импорт их не добавляет — признак снимается сам).
static LAST_ADDED: std::sync::Mutex<Vec<String>> = std::sync::Mutex::new(Vec::new());

/// Пакеты, дописанные при старте этого запуска окна и всё ещё выключенные.
pub fn fresh_disabled(registry: &Path) -> Vec<String> {
    let Ok(fresh) = LAST_ADDED.lock() else {
        return vec![];
    };
    fresh
        .iter()
        .filter(|id| {
            install::records(registry)
                .get(id.as_str())
                .is_some_and(|entry| entry.source == Source::Imported && entry.disabled)
        })
        .cloned()
        .collect()
}

/// Ход импорта при старте: конфиг есть — разобрать и дописать новое; нет —
/// тихий ноль. Ответ для журнала: сколько записей добавлено. Свежим считается
/// только дописанное — повторный запуск признак снимает.
pub fn run(config: Option<&Path>, registry: &Path) -> usize {
    let Some(config) = config else {
        return 0;
    };
    let Ok(text) = fs::read_to_string(config) else {
        return 0;
    };
    let parsed = parse(&text);
    let known_before: std::collections::BTreeSet<String> =
        install::records(registry).keys().cloned().collect();
    let added = record_new(registry, &parsed.packages).unwrap_or(0);
    let fresh: Vec<String> = parsed
        .packages
        .iter()
        .filter(|id| !known_before.contains(id.as_str()))
        .cloned()
        .collect();
    if let Ok(mut last) = LAST_ADDED.lock() {
        *last = fresh;
    }
    added
}
