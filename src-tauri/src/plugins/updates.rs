//! Автообновление плагинов при запуске (docs/BATCH.md, пункт 4): индекс каталога
//! сравнивается с реестром установленного, версии различаются — плагин получает
//! новую версию; права не менялись — молча, изменились — сводка прав до включения
//! (docs/SPEC/plugins.md, сцена K, файл прежней версии не заменяется).
//!
//! Итог проверки — `updates.json` в папке данных: `id → {от, до, статус, права}`
//! и пометка последней проверки каталога. Проверка — фоновый поток (lib.rs):
//! сеть старт окна не блокирует. Сводку прав ждущего обновления открывает сам
//! интерфейс при старте — `plugin_updates_note` несёт удержанные записи
//! (решение владельца 2026-10-06); в разделе сводка ждёт до решения по кнопке
//! карточки.
//!
//! Обновление сломало плагин: перед заменой файл складывается рядом как
//! `<файл>.bak`; после рестарта журнал движка читается прибавкой — «failed to
//! load» рядом с именем файла означает, что новая версия не загрузилась: запасной
//! файл возвращается, версия в реестре откатывается, остаётся пометка «сломано».
//! Журнал экранирует пути и пишет их короткой формой — ищем по имени файла.

use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};

use super::catalog::permissions_of;
use super::install::{self, CatalogEntry};
use super::model::Update;
pub use super::model::UpdateStatus;
const UPDATES_NAME: &str = "updates.json";
const REQUEST_SECONDS: u64 = 30;

/// Файл обновлений в папке данных: путь собирает `install::data_file`, имя — одно здесь.
pub fn file(fallback: PathBuf) -> PathBuf {
    install::data_file(fallback, UPDATES_NAME)
}

/// Что updates.json помнит: записи по плагинам и пометка последней проверки.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Updates {
    /// Каталог не ответил на последней проверке — причина словами; нет — отвечал.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog: Option<String>,
    /// Записи по плагинам: `id → {от, до, статус, права}`.
    #[serde(default)]
    pub records: BTreeMap<String, Update>,
}

/// Файл обновлений: испорченный или потерянный — пустой, как у правил (rules.rs).
pub fn at(file_path: &Path) -> Updates {
    fs::read(file_path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<Updates>(&bytes).ok())
        .unwrap_or_default()
}

/// Файл обновлений: собрать в JSON и записать — обновления живёт в папке данных,
/// команде окна надо обновить пометку после «Разрешить» сводки обновления.
pub fn save(file_path: &Path, updates: &Updates) -> Result<(), String> {
    let json = serde_json::to_string_pretty(updates)
        .map_err(|e| format!("обновления не собрались в JSON: {e}"))?;
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
    }
    fs::write(file_path, json)
        .map_err(|e| format!("обновления не записаны {}: {e}", file_path.display()))
}

/// «Новее» — версии различаются: semver-парсер не заводится, индекс пишет
/// владелец, у которого это поле — единственное место об изменениях.
pub fn newer(from: &str, to: &str) -> bool {
    from != to
}

/// Удержанное правами обновление с id плагина — то, что окну нужно от записи
/// updates.json до решения: сводка новых прав при старте открывается по ней
/// (сцена K), тихие и сломанные записи окон не открывают.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Held {
    pub id: String,
    #[serde(flatten)]
    pub update: Update,
}

/// Ответ окна о проверке обновлений: пометка каталога — строке вкладки Updates,
/// удержанные — сводке, которую интерфейс открывает сам при старте. Файл
/// читается без движка: пока движок поднимался, held уже доходит до окна.
#[derive(Debug, PartialEq, Serialize)]
pub struct UpdatesNote {
    /// «каталог недоступен — работаем на текущих»; нет — каталог отвечал.
    pub note: Option<String>,
    /// Записи «ждёт прав»: сводка открывается по ним без клика.
    pub held: Vec<Held>,
}

/// Удержанные правами записи файла обновлений.
pub fn held(notes: &Updates) -> Vec<Held> {
    notes
        .records
        .iter()
        .filter(|(_, one)| one.status == UpdateStatus::Held)
        .map(|(id, one)| Held {
            id: id.clone(),
            update: one.clone(),
        })
        .collect()
}

/// Итог проверки при запуске: файл обновлений и те плагины, что обновились
/// молча (движку после них нужен тихий рестарт — он читает плагины при старте).
#[derive(Debug, Clone, PartialEq)]
pub struct Checked {
    /// Записи в updates.json после проверки.
    pub notes: Updates,
    /// Обновившиеся молча: id плагинов с заменённым файлом.
    pub applied: Vec<String>,
}

/// Проверка версий при запуске: индекс каталога против реестра установленного.
/// `source` — полный адрес индекса; записи пишутся в updates.json, файлы с
/// изменившимися правами не трогаются до сводки. Недоступный каталог — не сбой:
/// работаем на текущих, остаётся пометка в разделе.
pub fn check_and_update(
    source: &str,
    plugins_dir: &Path,
    registry: &Path,
    file_path: &Path,
) -> Result<Checked, String> {
    let mut notes = at(file_path);
    let index = match install::fetch(source) {
        Ok(list) => list,
        Err(reason) => {
            notes.catalog = Some(reason);
            save(file_path, &notes)?;
            return Ok(Checked {
                notes,
                applied: vec![],
            });
        }
    };
    notes.catalog = None;
    let mut applied = vec![];
    for entry in install::installed(registry) {
        let Some(fresh) = index.iter().find(|one| one.id == entry.id) else {
            // Плагина нет в индексе: обновлять нечем, оставляем пометку, а не
            // прошлое обновление — прежнюю историю может перечитать владелец.
            if !notes.records.contains_key(&entry.id) {
                notes.records.insert(
                    entry.id.clone(),
                    Update {
                        from: entry.version.clone(),
                        to: String::new(),
                        status: UpdateStatus::Outside,
                        permissions: vec![],
                    },
                );
            }
            continue;
        };
        if !newer(&entry.version, &fresh.version) {
            continue;
        }
        if permissions_of(fresh) == permissions_of(&entry) {
            // Права не менялись: тихое обновление молча — запасной файл, замена,
            // реестр. Окна одобрения нет ни при каком праве.
            backup(plugins_dir, &entry.id);
            install::install(fresh, &install::raw_base(source), plugins_dir, registry)?;
            notes.records.insert(
                entry.id.clone(),
                Update {
                    from: entry.version.clone(),
                    to: fresh.version.clone(),
                    status: UpdateStatus::Applied,
                    permissions: vec![],
                },
            );
            applied.push(entry.id.clone());
        } else {
            // Права изменились: файл остаётся до сводки (сцена K) — обновление
            // перенесут тем же «Разрешить», что и установку из каталога.
            notes.records.insert(
                entry.id.clone(),
                Update {
                    from: entry.version.clone(),
                    to: fresh.version.clone(),
                    status: UpdateStatus::Held,
                    permissions: permissions_of(fresh),
                },
            );
        }
    }
    save(file_path, &notes)?;
    Ok(Checked { notes, applied })
}

/// Обновление, чью версию уже установили («Разрешить» сводки прав из вкладки
/// Updates — обычный plugin_install), — помечено «обновлено»: ждать больше
/// нечего, а карточка покажет новую версию от реестра. Установленная версия
/// равна целевой — права приняты.
pub fn refresh(notes: &mut Updates, installed: &[CatalogEntry]) {
    for entry in installed {
        let Some(note) = notes.records.get_mut(&entry.id) else {
            continue;
        };
        if note.status == UpdateStatus::Held && note.to == entry.version {
            note.status = UpdateStatus::Applied;
            note.permissions = vec![];
        }
    }
}

/// Запасной файл перед тихим обновлением: `<файл>.bak` рядом — остаётся, пока
/// новая версия не подтвердится у движка. Ошибка запасного не мешает обновлению.
fn backup(plugins_dir: &Path, id: &str) {
    let file_path = plugins_dir.join(format!("{id}.ts"));
    if file_path.exists() {
        let _ = fs::copy(&file_path, plugins_dir.join(format!("{id}.ts.bak")));
    }
}

/// Работа после тихого обновления: рестарт, проверка журнала движка, откат.
/// Рестарт делает лента (`Chat::restart`) или проверка подставляет свой —
/// движок читает плагины только при старте. Возвращает плагины, у которых новая
/// версия не загрузилась (журнал — прибавка, а не прошлые запуски).
pub fn follow_restart(
    applied: &[String],
    plugins_dir: &Path,
    registry: &Path,
    file_path: &Path,
    log: Option<PathBuf>,
    restart: &mut dyn FnMut() -> Result<(), String>,
) -> Result<Vec<String>, String> {
    if applied.is_empty() {
        return Ok(vec![]);
    }
    // Прибавка журнала: до рестарта запомнить длину — прошлые запуски чужеродны
    // и не должны быть приняты за работу новых версий. Журнала ещё нет (первый
    // старт движка) — длина unlucky ноль, вся его запись и есть прибавка.
    let before = fs::read(&log.as_deref().unwrap_or(Path::new("нет")))
        .map(|bytes| bytes.len())
        .unwrap_or(0);
    restart()?;
    let mut broken = vec![];
    if let Some(log) = log.as_deref() {
        broken = verify(log, before, applied);
        if !broken.is_empty() {
            for id in broken.iter() {
                rollback(id, plugins_dir, registry, file_path)?;
            }
            // Прежние файлы снова на месте: движка ознакомить с ними заново.
            restart()?;
        }
    }
    Ok(broken)
}

/// Ждать, пока рестарт отчитается о файлах, и собрать неудавшиеся.
fn verify(log: &Path, before: usize, applied: &[String]) -> Vec<String> {
    let deadline = Instant::now() + Duration::from_secs(REQUEST_SECONDS);
    loop {
        let added = journal_added(log, before);
        let broken: Vec<String> = applied
            .iter()
            .filter(|name| failure_of(&added, name).is_some())
            .map(String::clone)
            .collect();
        let loaded: Vec<&String> = applied
            .iter()
            .filter(|name| added.contains("loading plugin") && added.contains(name.as_str()))
            .collect();
        if broken.len() + loaded.len() >= applied.len() || Instant::now() > deadline {
            return broken;
        }
        std::thread::sleep(Duration::from_millis(300));
    }
}

/// Прибавка журнала с момента рестарта: журнал ротируется — если стал короче
/// запомненного, прибавки нет; нулевая длина «до» (первый старт движка) —
/// вся запись и есть прибавка. Экранирование путей расчищено, имена файлов
/// в короткой форме остаются сами собой.
pub fn journal_added(log: &Path, before: usize) -> String {
    let text = fs::read_to_string(log).unwrap_or_default();
    let added = if before == 0 {
        text.as_str()
    } else if before < text.len() {
        &text[before..]
    } else {
        ""
    };
    added.replace("\\\\", "\\")
}

/// Сломанная загрузка: «failed to load» на строке с именем файла.
fn failure_of<'a>(journal: &'a str, name: &str) -> Option<&'a str> {
    journal.lines().find(|line| {
        line.contains("failed to load") && line.contains(name)
    })
}

/// Журнал движка: где начинается файл opencode.log (данные движка, XDG_DATA_HOME
/// уважается — у проверок и копий свой дом; иначе запись владельца).
pub fn log_file() -> Option<PathBuf> {
    let data = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            std::env::var_os("USERPROFILE")
                .map(|home| PathBuf::from(home).join(".local").join("share"))
                .unwrap_or_default()
        });
    Some(data.join("opencode").join("log").join("opencode.log"))
}

/// Вернуть обновившемуся плагину прежнюю версию: запасной файл на место, версия
/// в реестре — та, что была до обновления, и пометка «сломано» (крайний случай).
pub fn rollback(
    id: &str,
    plugins_dir: &Path,
    registry: &Path,
    file_path: &Path,
) -> Result<(), String> {
    let backup = plugins_dir.join(format!("{id}.ts.bak"));
    if !backup.exists() {
        return Err(format!("запасного файла нет {}: откат невозможен", backup.display()));
    }
    let ts = plugins_dir.join(format!("{id}.ts"));
    fs::rename(&backup, &ts)
        .map_err(|e| format!("запасной файл не вернулся {backup:?} → {ts:?}: {e}"))?;
    let mut notes = at(file_path);
    let Some(note) = notes.records.get_mut(id) else {
        return Err(format!("в updates.json нет записи о плагине «{id}»"));
    };
    install::revert(registry, id, &note.from)?;
    note.status = UpdateStatus::Broken;
    save(file_path, &notes)
}
