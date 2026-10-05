// Разбор одной папки в строку дерева. Глубже не идём: дети приходят тем же вызовом
// по клику на стрелку, поэтому обход не знает рекурсии и не боится цикла ссылок.

use std::fs;
use std::path::Path;

use crate::project::{Kind, Node, MAX_ENTRIES};

/// Служебные и тяжёлые папки, которых в дереве нет. Начинающиеся с точки
/// (`.git`, `.idea`, `.vscode`, `.env`) пропускаются тем же правилом, что и скрытые.
const SKIPPED: [&str; 3] = ["node_modules", "target", "dist"];

/// Точка в начале имени — служебное или скрытое, дерево его не показывает.
/// Windows: атрибут «скрытый» сюда не попадает, его читать нечем — это про имя.
fn is_hidden(name: &str) -> bool {
    name.starts_with('.') || SKIPPED.contains(&name.to_lowercase().as_str())
}

/// Папки перед файлами, внутри — по имени без учёта регистра: сравнение папок Windows
/// регистр не различает, дерево не должно ему подчиняться.
fn before(a: &Node, b: &Node) -> std::cmp::Ordering {
    match (a.kind, b.kind) {
        (Kind::Dir, Kind::File) => std::cmp::Ordering::Less,
        (Kind::File, Kind::Dir) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    }
}

/// Узлы одной папки: что показывать дереву. Пустая папка — пустой список,
/// интерфейс пишет в этом случае «Папка пуста» (спека, п.4).
///
/// `loaded` у всех узлов `false`: содержимое приходит только по запросу этой же
/// папки, заранее взятого содержимого нет.
pub fn read_tree(dir: &Path) -> Result<Vec<Node>, String> {
    if !dir.is_dir() {
        return Err(format!("Папка не найдена: {}", dir.display()));
    }
    let entries =
        fs::read_dir(dir).map_err(|reason| format!("Папка не читается: {}: {reason}", dir.display()))?;

    let mut nodes = Vec::new();
    for entry in entries {
        // Одна недоступная папка не должна ронять всё дерево: она просто не в списке.
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().to_string();
        if is_hidden(&name) {
            continue;
        }
        // `file_type` не идёт по ссылке: узел дерева — то, что лежит в папке.
        let kind = match entry.file_type() {
            Ok(file_type) if file_type.is_dir() => Kind::Dir,
            Ok(file_type) if file_type.is_file() => Kind::File,
            _ => continue,
        };
        let path = entry.path();
        nodes.push(Node {
            name,
            path: path.to_string_lossy().to_string(),
            kind,
            loaded: false,
        });
    }

    nodes.sort_by(before);
    // Очень большой каталог не должен вешать дерево: показываем первые MAX_ENTRIES.
    nodes.truncate(MAX_ENTRIES);
    Ok(nodes)
}
