// Файловая система проекта: разбор папки в дерево и чтение файла в контекст запроса.
//
// Папка — временная, в `std::env::temp_dir`: данные владельца в `%APPDATA%/GnomeCode`
// проверка не трогает (docs/TESTING.md, «Данные пользователя»).

use std::fs;
use std::path::{Path, PathBuf};

use gnomecode_lib::project::{read_tree, read_source, request, Kind};

const QUESTION: &str = "Что здесь происходит?";

/// Папка с деревом: две подпапки, файлы на обоих уровнях и то, что дерево не показывает.
/// Своя папка на каждый вызов: тесты идут параллельно и общая мешала бы друг другу.
fn sample(tag: &str) -> PathBuf {
    let root = std::env::temp_dir().join(format!("gnomecode_project_tree_{tag}"));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(root.join("src/components")).expect("временная папка создана");
    fs::create_dir_all(root.join(".git")).expect("скрытая папка создана");
    fs::write(root.join("package.json"), "{ \"name\": \"gnomecode\" }").expect("файл записан");
    fs::write(root.join("src/bridge.ts"), "export const bridge = 1;").expect("файл записан");
    fs::write(root.join("src/components/Composer.tsx"), "export const Composer = 2;").expect("файл записан");
    fs::write(root.join(".git/config"), "[core]").expect("файл записан");
    fs::write(root.join(".env"), "SECRET=1").expect("файл записан");
    root
}

/// Имена узлов одного уровня: тем видно и порядок, и что пропущено.
fn names_of(dir: &Path) -> Vec<String> {
    read_tree(dir).expect("папка читается").into_iter().map(|node| node.name).collect()
}

#[test]
fn tree_lists_folders_before_files_and_skips_hidden() {
    let root = sample("sort");
    assert_eq!(
        names_of(&root),
        vec!["src", "package.json"],
        "папки идут перед файлами, скрытое и служебное не показываются"
    );
}

#[test]
fn second_level_is_visible_on_its_own() {
    let root = sample("second");
    let second = read_tree(&root.join("src")).expect("вложенная папка читается");
    let listed: Vec<(String, Kind)> =
        second.iter().map(|node| (node.name.clone(), node.kind.clone())).collect();
    assert_eq!(
        listed,
        vec![
            ("components".to_string(), Kind::Dir),
            ("bridge.ts".to_string(), Kind::File),
        ],
        "глубина 2 видна целиком: папка перед файлом, имя у узла с путём"
    );
    assert!(
        second.iter().all(|node| node.path.starts_with(root.to_str().unwrap_or(""))),
        "у узла полный путь — по нему читать потомков и сам файл"
    );
    assert!(
        second.iter().all(|node| !node.loaded),
        "пришедшие узлы ещё не раскрыты: содержимого папки в ответе нет"
    );
}

#[test]
fn missing_path_is_an_error_with_words() {
    let missing = std::env::temp_dir().join("gnomecode_project_tree_нет_такой");
    let reason = read_tree(&missing).expect_err("несуществующая папка — ошибка, а не пустота");
    assert!(
        reason.contains("Папка не найдена"),
        "ошибка читается словами, а не пустым списком: {reason:?}"
    );
    assert!(
        reason.contains("gnomecode_project_tree_нет_такой"),
        "в ошибке назван путь, который не открылся: {reason:?}"
    );
}

#[test]
fn file_source_is_read_and_truncation_is_told() {
    let root = sample("source");
    let source = read_source(&root.join("src/bridge.ts")).expect("файл читается");
    assert_eq!(source, "export const bridge = 1;", "содержимое доходит до интерфейса");
    assert!(
        read_source(&root.join("src/нет.ts")).is_err(),
        "файла нет — ошибка, а не пустой текст"
    );
    let huge = root.join("src/big.ts");
    fs::write(&huge, "я".repeat(70 * 1024)).expect("большой файл записан");
    let cut = read_source(&huge).expect("большой файл читается");
    assert!(cut.contains("64"), "обрезка помечается в тексте: {}", &cut[cut.len().saturating_sub(40)..]);
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn request_carries_attached_files_into_the_prompt() {
    let root = sample("attached");
    let files = vec![root.join("src/bridge.ts").to_string_lossy().to_string()];
    let sent = request(Some(&root), QUESTION, &files).expect("запрос собирается");

    assert!(
        sent.shown.contains("bridge.ts") && sent.shown.contains(QUESTION),
        "строка вопроса в ленте называет вопрос и приложенный файл: {:?}",
        sent.shown
    );
    assert!(
        sent.prompt.contains("src/bridge.ts") && sent.prompt.contains("export const bridge = 1;"),
        "движку уходит содержимое файла по относительному пути: {:?}",
        sent.prompt
    );
    assert!(
        !sent.prompt.contains(&root.to_string_lossy().to_string()),
        "абсолютный путь наружу не уходит — движок получает путь от папки проекта"
    );
    assert_eq!(
        sent.files,
        vec!["src/bridge.ts".to_string()],
        "файлы вопроса идут полем, а не разбором строки «Файлы: …» текстом: {:?}",
        sent.files
    );
}

#[test]
fn request_without_files_carries_no_sources() {
    let root = sample("no_files");
    let no_files: &[String] = &[];
    let sent = request(Some(&root), QUESTION, no_files).expect("запрос без файлов собирается");
    assert!(
        sent.files.is_empty(),
        "без приложенных файлов источников у вопроса нет: {:?}",
        sent.files
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn without_files_the_question_goes_unchanged() {
    let root = sample("empty");
    let no_files: &[String] = &[];
    let sent = request(Some(&root), QUESTION, no_files).expect("запрос без файлов собирается");
    assert_eq!(sent.shown, QUESTION, "без файлов строка вопроса та же");
    assert_eq!(sent.prompt, QUESTION, "без файлов движку уходит сам вопрос");
}

#[test]
fn path_out_of_the_project_folder_is_refused_even_when_it_looks_inside() {
    let root = sample("escape");
    let outside = root.parent().expect("у папки есть родитель").join("gnomecode_project_tree_escape_сосед.txt");
    fs::write(&outside, "SECRET=1").expect("файл за папкой проекта записан");

    for path in [
        root.join("src/../..").join(outside.file_name().expect("имя файла")),
        root.join("src/components/../../..").join(outside.file_name().expect("имя файла")),
        root.join("..").join(outside.file_name().expect("имя файла")),
    ] {
        let reason = request(Some(&root), QUESTION, &[path.to_string_lossy().to_string()])
            .expect_err("путь, уходящий из папки проекта, отклоняется");
        assert!(
            reason.contains("вне папки проекта"),
            "отказ называет причину словами: {reason:?}"
        );
        assert!(
            !reason.contains("SECRET"),
            "содержимое файла за папкой проекта не уходит в отказе: {reason:?}"
        );
    }
    let _ = fs::remove_file(&outside);
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn dots_inside_the_project_folder_are_simplified_not_refused() {
    let root = sample("dots");
    let sent = request(Some(&root), QUESTION, &[root.join("src/../src/bridge.ts").to_string_lossy().to_string()])
        .expect("путь, остающийся в папке проекта, принимается");

    assert!(
        sent.prompt.contains("--- src/bridge.ts ---"),
        "движку уходит свёрнутый путь, а не с точками: {:?}",
        sent.prompt
    );
    assert!(
        sent.prompt.contains("export const bridge = 1;"),
        "содержимое файла на месте: {:?}",
        sent.prompt
    );
    let _ = fs::remove_dir_all(&root);
}

#[test]
fn request_without_project_says_what_is_missing() {
    let outside = "C:\\projects\\v\\main.rs".to_string();
    let reason = request(None, QUESTION, &[outside]).expect_err("нет папки проекта");
    assert!(
        reason.contains("Файлы проекта") || reason.contains("папк"),
        "ошибка называет, чего не хватает: {reason:?}"
    );
}

