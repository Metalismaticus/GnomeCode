//! Автообновление плагинов при запуске: индекс каталога
//! сравнивается с реестром установленного, версии различаются — плагин получает
//! новую версию; права не менялись — молча, изменились — сводка прав до включения
//! (docs/SPEC/plugins.md, сцена K, файл прежней версии не заменяется).
//!
//! Итог проверки — `updates.json` в папке данных: `id → {от, до, статус, права() }`
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
    /// Записи по плагинам: `id → {от, до, статус, права() }`.
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

/// «Новее» по semver (DX-решение юнита: version в реестре — semver): тройка
/// мажор/минор/патч сравнивается численно, prerelease — по правилам semver.
/// Разобрать не вышло (версия до реестра, кривая запись) — прежнее правило
/// «различаются»: незнакомая форма не замораживает обновление.
pub fn newer(from: &str, to: &str) -> bool {
    match (semver(from), semver(to)) {
        // Вопрос «новее ли to, чем from» — сравнение в сторону to.
        (Some(a), Some(b)) => b > a,
        _ => from != to,
    }
}

/// Разобранная версия: числовая тройка и prerelease-идентификаторы.
/// Порядок — semver §11: тройка численно; релиз старше prerelease той же
/// тройки; идентификаторы слева направо, числовые младше буквенных.
#[derive(Debug, Clone, PartialEq, Eq)]
struct Semver {
    numbers: (u64, u64, u64),
    /// Пусто — релиз.
    pre: Vec<PreId>,
}

impl Ord for Semver {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        use std::cmp::Ordering;
        match self.numbers.cmp(&other.numbers) {
            Ordering::Equal => {}
            not_equal => return not_equal,
        }
        match (self.pre.is_empty(), other.pre.is_empty()) {
            // Релиз (без prerelease) старше prerelease той же тройки.
            (true, true) => Ordering::Equal,
            (true, false) => Ordering::Greater,
            (false, true) => Ordering::Less,
            (false, false) => self.pre.cmp(&other.pre),
        }
    }
}

impl PartialOrd for Semver {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// Идентификатор prerelease: числовой или буквенный (semver §9).
#[derive(Debug, Clone, PartialEq, Eq)]
enum PreId {
    Num(u64),
    Text(String),
}

impl Ord for PreId {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        use std::cmp::Ordering;
        match (self, other) {
            (PreId::Num(a), PreId::Num(b)) => a.cmp(b),
            // Числовой идентификатор младше буквенного.
            (PreId::Num(_), PreId::Text(_)) => Ordering::Less,
            (PreId::Text(_), PreId::Num(_)) => Ordering::Greater,
            (PreId::Text(a), PreId::Text(b)) => a.cmp(b),
        }
    }
}

impl PartialOrd for PreId {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        Some(self.cmp(other))
    }
}

/// Разбор semver: `MAJOR.MINOR.PATCH[-pre][+build]`, ведущее «v» прощается,
/// build-метаданные приоритета не меняют (semver §10) — отбрасываются.
fn semver(text: &str) -> Option<Semver> {
    let body = text.trim().trim_start_matches(['v', 'V']);
    let (body, _build) = body.split_once('+').unwrap_or((body, ""));
    let (numbers, pre) = body.split_once('-').unwrap_or((body, ""));
    let mut parts = numbers.split('.');
    let major = parts.next()?.parse::<u64>().ok()?;
    let minor = parts.next()?.parse::<u64>().ok()?;
    let patch = parts.next()?.parse::<u64>().ok()?;
    if parts.next().is_some() {
        return None;
    }
    let pre = if pre.is_empty() {
        Vec::new()
    } else {
        pre.split('.')
            .map(|id| {
                if !id.is_empty() && id.chars().all(|c| c.is_ascii_digit()) {
                    id.parse::<u64>().map(PreId::Num).map_err(|_| ())
                } else if id.is_empty()
                    || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
                {
                    Err(())
                } else {
                    Ok(PreId::Text(id.to_string()))
                }
            })
            .collect::<Result<Vec<PreId>, _>>()
            .ok()?
    };
    Some(Semver {
        numbers: (major, minor, patch),
        pre,
    })
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
    cache: &Path,
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
        // Импортированные из opencode.json вне каталога: жизненным циклом
        // ведёт движок — автообновление их не трогает (1.1). Переход под
        // управление реестра (П-1) придёт со сборкой реестра (T5).
        if entry.source == install::Source::Imported {
            continue;
        }
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
                        removed: vec![],
                    },
                );
            }
            continue;
        };
        if !newer(&entry.version, &fresh.version) {
            continue;
        }
        // Diff прав (T2): что новая версия добавляет и что убирает. Обновление
        // держится только на ДОБАВЛЕННЫХ правах — появился запрос на новое,
        // владелец решает до включения (K-1); стало меньше — безопаснее, едет тихо.
        let (added, removed) = diff(&entry, fresh);
        if added.is_empty() {
            // Новых прав нет: тихое обновление молча — запасной файл, замена,
            // реестр. Окна одобрения нет ни при каком праве.
            backup(plugins_dir, &entry.id);
            install::install(fresh, &install::raw_base(source), plugins_dir, registry, cache)?;
            notes.records.insert(
                entry.id.clone(),
                Update {
                    from: entry.version.clone(),
                    to: fresh.version.clone(),
                    status: UpdateStatus::Applied,
                    permissions: vec![],
                    removed,
                },
            );
            applied.push(entry.id.clone());
        } else {
            // Права добавились: файл остаётся до сводки (сцена K) — обновление
            // перенесут тем же «Разрешить», что и установку из каталога.
            notes.records.insert(
                entry.id.clone(),
                Update {
                    from: entry.version.clone(),
                    to: fresh.version.clone(),
                    status: UpdateStatus::Held,
                    permissions: added,
                    removed,
                },
            );
        }
    }
    save(file_path, &notes)?;
    Ok(Checked { notes, applied })
}

/// Diff прав версий (T2): что декларация добавила и что убрала — строками
/// «Категория: значение», как их знает карточка и сводка прав.
pub fn diff(old: &CatalogEntry, fresh: &CatalogEntry) -> (Vec<String>, Vec<String>) {
    let was = permissions_of(old);
    let now = permissions_of(fresh);
    let added = now.iter().filter(|one| !was.contains(one)).cloned().collect();
    let removed = was.iter().filter(|one| !now.contains(one)).cloned().collect();
    (added, removed)
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
        let broken: Vec<String>= applied
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
    } else if before <= text.len() {
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

/// Откат в клик (CE-3, T3/ET2): версия из кэша GnomeCode возвращается на место
/// файла с проверкой хэша кэш-записи (F5), а декларация той версии — в реестр:
/// восстанавливаются и права, не только номер (1.3). Версии до кэша — отказ:
/// кнопке отката в интерфейсе активна ровно `vcache::has`.
pub fn rollback_to(
    id: &str,
    version: &str,
    plugins_dir: &Path,
    registry: &Path,
    cache: &Path,
) -> Result<(), String> {
    let cached = super::vcache::get(cache, id, version).ok_or_else(|| {
        format!("версии {version} нет в кэше GnomeCode — откат невозможен (версия до кэша)")
    })?;
    let actual = super::vcache::sha256_hex(cached.content.as_bytes());
    if actual != cached.sha256 {
        return Err(
            "хэш кэш-записи не сошёлся: файл кэша повреждён — откат отменён".to_string(),
        );
    }
    let ts = plugins_dir.join(format!("{id}.ts"));
    fs::write(&ts, &cached.content)
        .map_err(|e| format!("файл отката не записан {}: {e}", ts.display()))?;
    install::restore(registry, &cached.entry)
}

#[cfg(test)]
mod tests {
    use super::newer;

    /// Граничные пары semver (eng-условие юнита): тройка численно, prerelease
    /// по правилам semver, неразбираемые версии — прежнее «различаются».
    #[test]
    fn semver_newer_boundaries() {
        // Тройка численно: 2.10 не младше 2.9 — строковое сравнение путало.
        assert!(newer("2.9.0", "2.10.0"), "2.10.0 новее 2.9.0");
        assert!(!newer("2.10.0", "2.9.0"), "2.9.0 не новее 2.10.0");
        // Равные версии обновлением не считаются.
        assert!(!newer("1.4.2", "1.4.2"), "та же версия — не новее");
        // Порядок по сегментам: сначала мажор, потом минор, потом патч.
        assert!(newer("1.9.9", "2.0.0"));
        assert!(newer("2.0.0", "2.0.1"));
        // Ведущее «v» прощается: реестр мог записать и так.
        assert!(newer("v1.2.3", "1.2.4"));

        // Prerelease младше релиза той же тройки (semver §11).
        assert!(newer("2.1.0-beta.1", "2.1.0"), "релиз новее prerelease");
        assert!(!newer("2.1.0", "2.1.0-beta.1"));
        // Prerelease растёт: числа численно, короткий набор младше длинного.
        assert!(newer("2.1.0-beta.1", "2.1.0-beta.2"));
        assert!(newer("2.1.0-beta", "2.1.0-beta.1"));
        // Буквенные идентификаторы лексически, числовые младше буквенных.
        assert!(newer("1.0.0-alpha", "1.0.0-beta"));
        assert!(newer("1.0.0-1", "1.0.0-alpha"));

        // Build-метаданные приоритета не меняют.
        assert!(!newer("1.0.0+build.1", "1.0.0+build.2"));

        // Неразбираемые — прежнее правило «различаются»: версии до реестра
        // не замораживают обновление.
        assert!(newer("abc", "def"), "кривые версии: различаются — обновляемся");
        assert!(newer("1.0.0", "дрянная-версия"));
        assert!(!newer("abc", "abc"));
    }
}
