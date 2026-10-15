//! Git-статус проекта (вкладка «Git» правой панели): ветка, изменённые файлы,
//! последние коммиты. Вызовы `git` — массивами аргументов, без шелла; папка
//! проекта — рабочая. Git не установлен или папка не репозиторий — честный отказ.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

/// Сколько коммитов показывает вкладка: ориентир по истории, не полный лог.
const LOG_COUNT: &str = "8";

/// Что вкладка «Git» показывает о репозитории.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub branch: String,
    /// Изменённые файлы: буква статуса porcelain («M», «??») и путь от корня.
    pub changes: Vec<Change>,
    /// Последние коммиты: короткий хэш и тема.
    pub commits: Vec<Commit>,
}

/// Строка `git status --porcelain`: статус и путь.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Change {
    pub status: String,
    pub path: String,
}

/// Строка `git log --oneline`: хэш и тема.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub hash: String,
    pub subject: String,
}

/// Статус репозитория в папке проекта. Ошибки git — словами наружу:
/// «git не установлен» и «папка не репозиторий» владелец различает.
pub fn status(root: &Path) -> Result<GitStatus, String> {
    let branch_line = git(root, &["status", "--porcelain", "-b"], "статус")?;
    let (branch, changes) = parse_status(&branch_line);
    let log = git(root, &["log", "--oneline", "-n", LOG_COUNT], "история")?;
    Ok(GitStatus {
        branch,
        changes,
        commits: parse_log(&log),
    })
}

/// Разбор вывода `git status --porcelain -b`: первая строка — «## ветка…»
/// (с апстримом — «ветка…origin/ветка», берём до «...»), дальше — файлы.
pub fn parse_status(output: &str) -> (String, Vec<Change>) {
    let mut lines = output.lines();
    let head = lines.next().unwrap_or_default();
    let branch = head
        .strip_prefix("## ")
        .unwrap_or_default()
        .split("...")
        .next()
        .unwrap_or_default()
        .trim()
        .to_string();
    let changes = lines
        .filter(|line| line.len() >= 4)
        .map(|line| Change {
            status: line[..2].trim().to_string(),
            path: line[3..].trim().to_string(),
        })
        .collect();
    (branch, changes)
}

/// Разбор вывода `git log --oneline`: «хэш тема» по строке на коммит.
pub fn parse_log(output: &str) -> Vec<Commit> {
    output
        .lines()
        .filter_map(|line| line.split_once(' '))
        .map(|(hash, subject)| Commit {
            hash: hash.to_string(),
            subject: subject.to_string(),
        })
        .collect()
}

/// Один вызов git в папке проекта: без шелла, ошибки — словами с командой.
fn git(root: &Path, args: &[&str], what: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(root)
        .output()
        .map_err(|reason| format!("git не запустился (проверьте установку Git): {reason}"))?;
    if !output.status.success() {
        let reason = String::from_utf8_lossy(&output.stderr);
        let reason = reason.trim();
        if reason.contains("not a git repository") {
            return Err("папка проекта не репозиторий — вкладке Git нечего показать".to_string());
        }
        return Err(format!("git не ответил ({what}): {reason}"));
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[cfg(test)]
mod tests {
    use super::{parse_log, parse_status, Change, Commit};

    /// Porcelain: ветка с апстримом отрезается от «...», статусы и пути на местах.
    #[test]
    fn porcelain_parsing() {
        let output = "## main...origin/main [ahead 1]\n M src/lib.rs\n?? new-file.txt\nA  docs/x.md\n";
        let (branch, changes) = parse_status(output);
        assert_eq!(branch, "main");
        assert_eq!(
            changes,
            vec![
                Change { status: "M".into(), path: "src/lib.rs".into() },
                Change { status: "??".into(), path: "new-file.txt".into() },
                Change { status: "A".into(), path: "docs/x.md".into() },
            ]
        );
    }

    /// Пустой репозиторий: только ветка, файлов нет; лог — хэш и тема.
    #[test]
    fn empty_and_log() {
        let (branch, changes) = parse_status("## main\n");
        assert_eq!(branch, "main");
        assert!(changes.is_empty());
        assert_eq!(
            parse_log("a1b2c3d тема коммита\ne4f5a6b вторая\n"),
            vec![
                Commit { hash: "a1b2c3d".into(), subject: "тема коммита".into() },
                Commit { hash: "e4f5a6b".into(), subject: "вторая".into() },
            ]
        );
    }
}
