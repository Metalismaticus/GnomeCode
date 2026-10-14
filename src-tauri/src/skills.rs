//! Скиллы владельца (B7): свои инструкции движку в глобальной папке команд
//! OpenCode — `config/opencode/command/*.md` (XDG_CONFIG_HOME уважается —
//! изоляция проверок). Файл скилла: markdown с frontmatter `description`,
//! имя файла = имя скилла. Движок читает команды при старте — после правки
//! нужен рестарт (команда окна его делает).

use std::fs;
use std::path::{Path, PathBuf};

use crate::plugins::install;

const DIR_PARTS: [&str; 2] = ["opencode", "command"];

/// Папка команд движка: рядом с плагинами (`plugins_dir`), те же правила.
pub fn command_dir() -> PathBuf {
    let mut path = install::plugins_dir();
    path.pop(); // …/opencode/plugins → …/opencode
    for part in DIR_PARTS {
        path.push(part);
    }
    path
}

/// Скилл для списка настроек: имя, описание и текст инструкции.
#[derive(Debug, Clone, PartialEq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub text: String,
}

/// Имя файла скилла: транслитерация кириллицы + латиница/цифры/дефис
/// (владелец называет скиллы по-русски — «Конвертация 3D» → konvertaciya-3d).
fn slug(name: &str) -> Option<String> {
    let lowered = name.trim().to_lowercase();
    let mut translit = String::with_capacity(lowered.len());
    for c in lowered.chars() {
        let latin = match c {
            'а' => "a", 'б' => "b", 'в' => "v", 'г' => "g", 'д' => "d", 'е' | 'ё' => "e",
            'ж' => "zh", 'з' => "z", 'и' | 'й' => "i", 'к' => "k", 'л' => "l", 'м' => "m",
            'н' => "n", 'о' => "o", 'п' => "p", 'р' => "r", 'с' => "s", 'т' => "t",
            'у' => "u", 'ф' => "f", 'х' => "h", 'ц' => "c", 'ч' => "ch", 'ш' => "sh",
            'щ' => "sch", 'ъ' | 'ь' => "", 'ы' => "y", 'э' => "e", 'ю' => "yu",
            'я' => "ya",
            other => { translit.push(other); continue; }
        };
        translit.push_str(latin);
    }
    let clean: String = translit
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let slug: String = clean.split('-').filter(|p| !p.is_empty()).collect::<Vec<_>>().join("-");
    (!slug.is_empty() && slug.len() <= 64).then_some(slug)
}

/// Описание из frontmatter markdown: строка `description: …` в начале файла.
fn description_of(text: &str) -> String {
    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("description:") {
            return rest.trim().to_string();
        }
    }
    String::new()
}

/// Список скиллов: *.md из папки команд, отсортировано по имени; имя — имя
/// файла без расширения, текст целиком (редактор получает то, что на диске).
pub fn list() -> Vec<Skill> {
    let dir = command_dir();
    let Ok(files) = fs::read_dir(&dir) else {
        return vec![];
    };
    let mut skills: Vec<Skill> = files
        .flatten()
        .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "md"))
        .filter_map(|entry| {
            let name = entry.path().file_stem()?.to_string_lossy().to_string();
            let text = fs::read_to_string(entry.path()).ok()?;
            Some(Skill {
                description: description_of(&text),
                text,
                name,
            })
        })
        .collect();
    skills.sort_by(|a, b| a.name.cmp(&b.name));
    skills
}

/// Один скилл, если есть.
pub fn get(name: &str) -> Option<Skill> {
    let slug = slug(name)?;
    let path = command_dir().join(format!("{slug}.md"));
    let text = fs::read_to_string(path).ok()?;
    Some(Skill {
        description: description_of(&text),
        text: text.clone(),
        name: slug,
    })
}

/// Сохранить скилл (создать или перезаписать): имя в slug, описание — в
/// frontmatter перед текстом инструкции. Папку создаёт на первом скилле.
pub fn save(name: &str, description: &str, text: &str) -> Result<String, String> {
    let slug = slug(name).ok_or_else(|| "имя скилла — латиница, цифры и дефис".to_string())?;
    let dir = command_dir();
    fs::create_dir_all(&dir)
        .map_err(|e| format!("папка команд не создалась {}: {e}", dir.display()))?;
    let mut content = String::new();
    content.push_str("---\n");
    content.push_str(&format!("description: {}\n", description.trim()));
    content.push_str("---\n");
    content.push_str(text.trim_start());
    fs::write(dir.join(format!("{slug}.md")), content)
        .map_err(|e| format!("скилл не записан {}: {e}", slug))?;
    Ok(slug)
}

/// Удалить скилл: нет файла — уже чисто.
pub fn remove(name: &str) -> Result<(), String> {
    let Some(slug) = slug(name) else {
        return Err("имя скилла — латиница, цифры и дефис".to_string());
    };
    let path = command_dir().join(format!("{slug}.md"));
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("скилл не удалён {}: {e}", path.display())),
    }
}

/// Путь папки команд наружу (настройки: «где лежат скиллы»).
pub fn dir_display() -> PathBuf {
    command_dir()
}

/// Тихий тест-хелпер: скилл существует?
pub fn exists(name: &str) -> bool {
    slug(name)
        .is_some_and(|slug| Path::new(&command_dir()).join(format!("{slug}.md")).is_file())
}

#[cfg(test)]
mod tests {
    use super::{command_dir, get, list, remove, save, slug};
    use std::path::PathBuf;

    struct TempDir(std::path::PathBuf);

    impl TempDir {
        /// Своя папка конфига на процесс теста: command_dir() уважает
        /// XDG_CONFIG_HOME, данные владельца не трогаются (docs/TESTING.md).
        fn isolate(name: &str) -> TempDir {
            let base = std::env::temp_dir().join(format!(
                "gnomecode-skills-{}-{name}",
                std::process::id()
            ));
            std::fs::create_dir_all(&base).expect("временная папка создана");
            std::env::set_var("XDG_CONFIG_HOME", &base);
            TempDir(base)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    /// Slug: латиница/цифры/дефис, кириллица и пробелы — в дефисы; пустое — None.
    #[test]
    fn slug_is_safe() {
        assert_eq!(slug("Конвертация 3D").as_deref(), Some("konvertaciya-3d"));
        assert_eq!(slug("My-Skill_2").as_deref(), Some("my-skill-2"));
        assert_eq!(slug("   "), None);
    }

    /// Сохранение → список и чтение; описание в frontmatter; правка перезаписывает;
    /// удаление убирает. Файлы — во временной папке конфига, владелец не тронут.
    #[test]
    fn save_list_edit_remove_roundtrip() {
        let _config = TempDir::isolate("roundtrip");
        let name = "img-to-3d";

        let slug = save(name, "Картинка в 3D модель", "Инструкция: конвертируй изображение в 3D через внешний инструмент.")
            .expect("скилл сохранён");
        assert_eq!(slug, name);
        assert!(
            command_dir().join(format!("{name}.md")).is_file(),
            "файл скилла в папке команд конфига"
        );

        let held = list().into_iter().find(|one| one.name == name).expect("скилл в списке");
        assert_eq!(held.description, "Картинка в 3D модель");
        assert!(held.text.contains("Инструкция"), "текст инструкции на месте");

        let read = get(name).expect("скилл читается по имени");
        assert!(read.text.contains("description: Картинка в 3D модель"), "описание в frontmatter");

        save(name, "Обновлённое описание", "Новая инструкция.").expect("правка сохранена");
        let edited = get(name).expect("скилл читается после правки");
        assert!(edited.text.contains("Обновлённое описание"));

        remove(name).expect("скилл удалён");
        assert!(!list().iter().any(|one| one.name == name), "удалённый не в списке");
    }
}
