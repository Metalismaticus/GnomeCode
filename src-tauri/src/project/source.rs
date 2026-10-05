// Чтение файла в контекст запроса. Большой файл обрезается, и обрезка сказана словами:
// движок должен знать, что дальше он не видел, и переспросить.

use std::fs;
use std::path::Path;

use crate::project::MAX_SOURCE_BYTES;

/// Содержимое файла как есть. Не найден — ошибка словами, а не пустой текст:
/// пустой файл и ненайденный не должны выглядеть одинаково.
pub fn read_source(path: &Path) -> Result<String, String> {
    if !path.is_file() {
        return Err(format!("Файл не найден: {}", path.display()));
    }
    let bytes =
        fs::read(path).map_err(|reason| format!("Файл не читается: {}: {reason}", path.display()))?;
    if bytes.len() <= MAX_SOURCE_BYTES {
        return String::from_utf8(bytes).map_err(|_| format!("Файл не текст: {}", path.display()));
    }

    // Режем по границе символа: текст, обрезанный на полуслове, ломает и поиск по нему.
    let mut cut = MAX_SOURCE_BYTES;
    while cut > 0 && !starts_char(&bytes[cut]) {
        cut -= 1;
    }
    let mut text = String::from_utf8_lossy(&bytes[..cut]).into_owned();
    // Предел читается из одного места, обрезка в тексте — из того же.
    text.push_str(&format!("\n[обрезано: {} КБ]", MAX_SOURCE_BYTES / 1024));
    Ok(text)
}

/// Байт по этому смещению — начало символа UTF-8.
fn starts_char(byte: &u8) -> bool {
    byte & 0b1100_0000 != 0b1000_0000
}
