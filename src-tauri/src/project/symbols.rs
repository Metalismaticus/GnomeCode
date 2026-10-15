//! Символы приложенных файлов (вкладка «Символы» правой панели): имена функций,
//! классов, структур и типов по строкам файла. Лёгкий разбор по префиксам строк —
//! без языковых серверов: панель показывает ориентир по файлу, а не точный AST.

use std::path::Path;

use serde::Serialize;

/// Символ файла: что это, как зовётся, на какой строке (1-based, как в редакторе).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Symbol {
    pub file: String,
    pub kind: String,
    pub name: String,
    pub line: usize,
}

/// Кап символов одного файла: огромный сгенерированный файл не должен тонуть в списке.
const MAX_PER_FILE: usize = 200;

/// Символы одного файла: путь — для строки списка, содержимое уже прочитано.
pub fn of_source(file: &str, source: &str) -> Vec<Symbol> {
    let ext = Path::new(file)
        .extension()
        .and_then(|one| one.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut symbols = Vec::new();
    for (index, line) in source.lines().enumerate() {
        if symbols.len() >= MAX_PER_FILE {
            break;
        }
        let trimmed = line.trim_start();
        if let Some((kind, name)) = match_symbol(&ext, trimmed) {
            symbols.push(Symbol {
                file: file.to_string(),
                kind: kind.to_string(),
                name,
                line: index + 1,
            });
        }
    }
    symbols
}

/// Один разобранный префикс: (вид словами, имя). Хвост имени — до скобки/пробела.
fn named(kind: &str, rest: &str) -> Option<(String, String)> {
    let rest = rest.trim_start();
    let name: String = rest
        .chars()
        .take_while(|c| c.is_alphanumeric() || matches!(c, '_' | '$'))
        .collect();
    (!name.is_empty()).then(|| (kind.to_string(), name))
}

/// Префиксы по расширению: rust/ts-js-jsx/py — самые частые в проектах движка.
fn match_symbol(ext: &str, line: &str) -> Option<(String, String)> {
    match ext {
        "rs" => {
            for (prefix, kind) in [
                ("pub fn ", "функция"),
                ("fn ", "функция"),
                ("pub struct ", "структура"),
                ("struct ", "структура"),
                ("pub enum ", "перечисление"),
                ("enum ", "перечисление"),
                ("pub trait ", "трейт"),
                ("trait ", "трейт"),
                ("impl ", "имплементация"),
            ] {
                if let Some(rest) = line.strip_prefix(prefix) {
                    // impl<T> Trait for Type — берём последний сегмент имени до «{»/«where».
                    let head = rest.split(['{', '(', ':']).next().unwrap_or_default().trim();
                    let name = head
                        .split_whitespace()
                        .last()
                        .unwrap_or_default()
                        .trim_end_matches('<')
                        .to_string();
                    if !name.is_empty() {
                        return Some((kind.to_string(), name));
                    }
                }
            }
            None
        }
        "ts" | "tsx" | "js" | "jsx" | "mjs" => {
            for (prefix, kind) in [
                ("export function ", "функция"),
                ("export async function ", "функция"),
                ("function ", "функция"),
                ("async function ", "функция"),
                ("export class ", "класс"),
                ("class ", "класс"),
                ("export interface ", "интерфейс"),
                ("interface ", "интерфейс"),
                ("export type ", "тип"),
                ("type ", "тип"),
                ("export const ", "константа"),
            ] {
                if let Some(rest) = line.strip_prefix(prefix) {
                    // const X = () => … — имя до знака «=» или скобки.
                    let head = rest.split(['=', '(', ':', '<']).next().unwrap_or_default();
                    return named(kind, head);
                }
            }
            None
        }
        "py" => {
            for (prefix, kind) in [("def ", "функция"), ("class ", "класс")] {
                if let Some(rest) = line.strip_prefix(prefix) {
                    let head = rest.split('(').next().unwrap_or_default();
                    return named(kind, head);
                }
            }
            None
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::{of_source, Symbol};

    /// Rust: функции, структуры, трейты и impl — имена и номера строк.
    #[test]
    fn rust_symbols() {
        let source = "use std::fs;\n\npub struct Config {\n    pub name: String,\n}\n\npub fn read(path: &str) -> Config {\n    Config { name: path.to_string() }\n}\n\nimpl Config {\n    pub fn new() -> Self {\n        Self { name: String::new() }\n    }\n}\n";
        let symbols = of_source("src/config.rs", source);
        assert_eq!(
            symbols,
            vec![
                Symbol { file: "src/config.rs".into(), kind: "структура".into(), name: "Config".into(), line: 3 },
                Symbol { file: "src/config.rs".into(), kind: "функция".into(), name: "read".into(), line: 7 },
                Symbol { file: "src/config.rs".into(), kind: "имплементация".into(), name: "Config".into(), line: 11 },
                Symbol { file: "src/config.rs".into(), kind: "функция".into(), name: "new".into(), line: 12 },
            ]
        );
    }

    /// TypeScript: функции, классы, типы; const-стрелка — константа.
    #[test]
    fn ts_symbols() {
        let source = "export interface Row {\n  id: string;\n}\n\nexport type Kind = string;\n\nexport function fold(a: string): string {\n  return a;\n}\n\nexport const pick = () => 1;\n";
        let symbols = of_source("src/row.ts", source);
        assert_eq!(
            symbols,
            vec![
                Symbol { file: "src/row.ts".into(), kind: "интерфейс".into(), name: "Row".into(), line: 1 },
                Symbol { file: "src/row.ts".into(), kind: "тип".into(), name: "Kind".into(), line: 5 },
                Symbol { file: "src/row.ts".into(), kind: "функция".into(), name: "fold".into(), line: 7 },
                Symbol { file: "src/row.ts".into(), kind: "константа".into(), name: "pick".into(), line: 11 },
            ]
        );
    }

    /// Python и чужое расширение: def/class берутся, неизвестное — пусто.
    #[test]
    fn py_and_unknown() {
        let source = "class Doc:\n    def read(self):\n        pass\n";
        let symbols = of_source("doc.py", source);
        assert_eq!(symbols[0].kind, "класс");
        assert_eq!(symbols[0].name, "Doc");
        assert_eq!(symbols[1].kind, "функция");
        assert_eq!(symbols[1].name, "read");
        assert!(of_source("readme.md", "- список:\n  - пункт").is_empty());
    }
}
