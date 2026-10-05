// Сборка запроса: в ленту владельцу уходит вопрос с именами приложенных файлов,
// движку — сам вопрос и содержимое этих файлов по путям от папки проекта.
// Абсолютный путь наружу не уходит: движку не нужно знать, где лежит проект на диске.

use std::path::{Component, Path, PathBuf};

use crate::project::read_source;

/// Заголовок блока с файлами в тексте движка.
const FILES_HEADING: &str = "Файлы проекта:";

/// Что уходит в ленту окна и что уходит движку: имена файлов интересуют владельца,
/// содержимое — модель, поэтому строки разные.
#[derive(Debug)]
pub struct Sent {
    pub shown: String,
    pub prompt: String,
}

/// Запрос владельца с приложенными файлами. Без файлов вопрос уходит без изменений.
pub fn request(root: Option<&Path>, text: &str, files: &[String]) -> Result<Sent, String> {
    if files.is_empty() {
        return Ok(Sent { shown: text.to_string(), prompt: text.to_string() });
    }
    let root = root.ok_or("Файлы проекта приложены, а папка проекта не выбрана".to_string())?;

    let mut blocks = Vec::new();
    let mut names = Vec::new();
    for file in files {
        let (path, relative) = within(root, Path::new(file))?;
        blocks.push(format!("--- {relative} ---\n{}", read_source(&path)?));
        names.push(relative);
    }

    Ok(Sent {
        shown: format!("{}\n\nФайлы: {}", text.trim(), names.join(", ")),
        prompt: format!("{}\n\n{FILES_HEADING}\n\n{}", text.trim(), blocks.join("\n\n")),
    })
}

/// Файл должен лежать в папке проекта: пути из интерфейса приходят из дерева,
/// а читать что угодно с диска по строке из окна мост не должен. Возвращает путь
/// и его же от папки проекта — через «/» так его читает и движок, и владелец.
fn within(root: &Path, path: &Path) -> Result<(PathBuf, String), String> {
    let whole = parts(path);
    let base = parts(root);
    let inside = whole.len() > base.len()
        && whole[..base.len()]
            .iter()
            .zip(&base)
            .all(|(part, base)| part.eq_ignore_ascii_case(base));
    if !inside {
        return Err(format!("Файл вне папки проекта: {}", path.display()));
    }
    Ok((path.to_path_buf(), whole[base.len()..].join("/")))
}

/// Компоненты пути строками: так «C:\a\b» и «C:/a/b» сравниваются одинаково —
/// разделитель приходит из интерфейса, а на Windows он обратный. «.» и «..»
/// сворачиваются на словах, а точка, уводящая выше корня, оставляет след «..»,
/// который не совпадёт ни с одной папкой проекта: путь «проект\src\..\..\файл»
/// читает файл рядом с проектом, и текстом он на проект похож.
fn parts(path: &Path) -> Vec<String> {
    let mut folded: Vec<String> = Vec::new();
    for part in path.components() {
        match part {
            Component::RootDir | Component::Prefix(_) => {}
            Component::CurDir => {}
            Component::ParentDir => match folded.last() {
                Some(last) if last != ".." => drop(folded.pop()),
                _ => folded.push("..".to_string()),
            },
            Component::Normal(name) => folded.push(name.to_string_lossy().to_string()),
        }
    }
    folded
}
