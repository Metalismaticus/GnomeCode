//! Файлы проекта: чтение папки в дерево, чтение файла в контекст, сборка запроса.
//!
//! Здесь единственное место, которое знает про файловую систему проекта; интерфейс
//! получает готовые узлы и не разбирает папки сам (ADR-0001, CONCEPT «Архитектура»).
//! Всё наружу — `Result`: ошибки читаются словами, `panic` здесь нет.

pub mod prompt;
pub mod source;
pub mod tree;

use std::path::PathBuf;
use std::sync::Mutex;

pub use prompt::request;
pub use source::read_source;
pub use tree::read_tree;

/// Предел элементов в одной папке: очень большой каталог не должен вешать дерево.
pub const MAX_ENTRIES: usize = 500;

/// Предел содержимого одного файла в контексте запроса: дальше модель всё равно не читает.
pub const MAX_SOURCE_BYTES: usize = 64 * 1024;

/// Что за узел дерева — папка или файл.
#[derive(Clone, Copy, PartialEq, Eq, Debug, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Dir,
    File,
}

/// Строка дерева: имя для показа, полный путь — чтобы читать содержимое и потомков.
#[derive(Clone, Debug, serde::Serialize)]
pub struct Node {
    pub name: String,
    pub path: String,
    pub kind: Kind,
    /// Содержимое этой папки уже приходило одним вызовом и лежит у интерфейса.
    /// Узлы из [`tree::read_tree`] всегда `false`: содержимое берут по клику.
    pub loaded: bool,
}

/// Выбранная папка проекта: её знают команда отправки и команда дерева.
#[derive(Default)]
pub struct Project {
    root: Mutex<Option<PathBuf>>,
}

impl Project {
    /// Папка проекта, если её выбирали.
    pub fn root(&self) -> Option<PathBuf> {
        self.root.lock().ok().and_then(|root| root.clone())
    }

    /// Запомнить папку проекта.
    pub fn set(&self, root: PathBuf) {
        if let Ok(mut held) = self.root.lock() {
            *held = Some(root);
        }
    }
}