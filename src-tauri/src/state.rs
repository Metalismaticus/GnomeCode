//! Данные окна, которые переживают перезапуск приложения («Один полный цикл»):
//! открытая сессия движка, титул чата, папка проекта, тема, пины и недавние
//! плагинов. Один файл JSON в папке
//! данных (`GNOMECODE_DATA_DIR` извне или папка данных Tauri); каждая правка —
//! чтение, подмена поля, запись под Mutex: правка темы чат и папку не затирает.
//!
//! Окно трогает состояние только через мост (`state_get`/`state_patch` в lib.rs):
//! интерфейс знает структуру, а не файл и папку данных (ADR-0001).
//!
//! `chat_title` — это титул для сайдбара: первый вопрос владельца. Титул, отданный
//! движку при создании сессии («GnomeCode»), никому ничего не говорит — его окно
//! не показывает.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};

/// Папка данных снаружи продукта: проверки и копии ставят эту переменную,
/// иначе папку даёт Tauri (`app_data_dir`, docs/TESTING.md, «Данные пользователя»).
pub const DATA_DIR_VAR: &str = "GNOMECODE_DATA_DIR";

/// Имя файла состояния в папке данных.
const FILE_NAME: &str = "state.json";

/// Тема окна: то, что переключатель назвал в последний раз.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

/// Выбранная модель чата (панель «Сравнение моделей»): имя стоит на бейдже шапки,
/// идентификатор `лаборатория/модель` уходит движку с запросом. Одно поле — два
/// чтения, поэтому пара внутри типа, а не два объекта рядом.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatModel {
    pub name: String,
    pub id: String,
}

/// Что окно помнит о себе.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    /// Открытая сессия движка: на рестарте приложения лента берёт её из списка
    /// живых сессий (opencode/session.rs), а не создаёт новую.
    pub session: Option<String>,
    /// Титул чата для сайдбара: первый вопрос в нём.
    pub chat_title: Option<String>,
    /// Папка проекта: её знают дерево файлов и отправка сразу после старта окна.
    pub project: Option<String>,
    /// Тема окна: включённый переключатель.
    pub theme: Option<Theme>,
    /// Пины плагинов (⭐ в списке плагинов): слова самого владельца — общие для всех
    /// проектов (сцена F спеки плагинов), порядок — как пиновал, новый сверху.
    pub plugin_favorites: Option<Vec<String>>,
    /// Недавние подключения плагинов к чату: зачем список — подключить привычный
    /// инструмент за два клика (сцена F); порядок — как подключали, свежий сверху.
    pub plugin_recent: Option<Vec<String>>,
    /// Модель текущего чата, выбранная в панели «Сравнение моделей»: бейдж шапки
    /// показывает имя, запрос движку несёт идентификатор. Нет — умолчание нового
    /// чата (`DEFAULT_MODEL` интерфейса, `src/appstate.ts`).
    pub chat_model: Option<ChatModel>,
    /// Время начала текущего чата (unix-миллисекунды): группы дат сайдбара
    /// строятся по нему; пишется тем же патчем, что и титул первого вопроса.
    pub chat_time: Option<i64>,
    /// Модель по умолчанию для новых чатов: свой выбор настроек. Нет —
    /// умолчание интерфейса (`DEFAULT_MODEL`, `src/appstate.ts`); serde-умолчание
    /// старые state.json без поля не ломает.
    pub default_model: Option<ChatModel>,
    /// Чаты, убранные в архив (идентификаторы сессий ядра): в сайдбаре их нет,
    /// сами сессии в ядре живы — архив живёт в состоянии окна, список ядра
    /// не трогает (замечание владельца 2026-10-10: «архивация и т.д.»).
    /// serde-умолчание старые state.json без поля не ломает.
    #[serde(default)]
    pub archived_chats: Option<Vec<String>>,
    /// Закреплённые чаты (замечание владельца 14.10: «сверху избранное — раздел
    /// для закрепления»): раздел поверх групп дат, строка уходит меню «Закрепить».
    /// serde-умолчание старые state.json без поля не ломает.
    #[serde(default)]
    pub pinned_chats: Option<Vec<String>>,
}

/// Правка состояния: названные поля меняются, остальные остаются как были.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatePatch {
    pub session: Option<String>,
    pub chat_title: Option<String>,
    pub project: Option<String>,
    pub theme: Option<Theme>,
    pub plugin_favorites: Option<Vec<String>>,
    pub plugin_recent: Option<Vec<String>>,
    pub chat_model: Option<ChatModel>,
    pub chat_time: Option<i64>,
    /// Модель по умолчанию для новых чатов (окно настроек).
    pub default_model: Option<ChatModel>,
    /// Архив чатов: весь список идентификаторов — патч меняет его целиком
    /// (добавить или вернуть один id считает интерфейс, владелец их видит).
    pub archived_chats: Option<Vec<String>>,
    /// Закреплённые чаты: весь список идентификаторов, как архив.
    pub pinned_chats: Option<Vec<String>>,
}

impl AppState {
    /// Подмена полей патчем: у патча — то, что поменяли, у состояния — прошлое.
    fn patched(&self, patch: &StatePatch) -> AppState {
        AppState {
            session: patch.session.clone().or_else(|| self.session.clone()),
            chat_title: patch.chat_title.clone().or_else(|| self.chat_title.clone()),
            project: patch.project.clone().or_else(|| self.project.clone()),
            theme: patch.theme.or(self.theme),
            plugin_favorites: patch.plugin_favorites.clone().or_else(|| self.plugin_favorites.clone()),
            plugin_recent: patch.plugin_recent.clone().or_else(|| self.plugin_recent.clone()),
            chat_model: patch.chat_model.clone().or_else(|| self.chat_model.clone()),
            chat_time: patch.chat_time.or(self.chat_time),
            default_model: patch.default_model.clone().or_else(|| self.default_model.clone()),
            archived_chats: patch.archived_chats.clone().or_else(|| self.archived_chats.clone()),
            pinned_chats: patch.pinned_chats.clone().or_else(|| self.pinned_chats.clone()),
        }
    }
}

/// Хранилище под Mutex: файл читается один раз при открытии, правки — через patch.
pub struct Store {
    file: PathBuf,
    state: Mutex<AppState>,
}

impl Store {
    /// Файл состояния по папке данных: имя переменной окружения для проверок и копий,
    /// иначе папка данных приложения — часть могли передать и `None`.
    pub fn location(data_dir: Option<PathBuf>, fallback: PathBuf) -> PathBuf {
        let dir = data_dir.unwrap_or(fallback);
        dir.join(FILE_NAME)
    }

    /// Открыть хранилище: потерянный или испорченный файл — пустое состояние,
    /// окно открывается как в первый раз и ничего не паникует.
    pub fn at(file: PathBuf) -> Store {
        let state = match fs::read(&file) {
            Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_default(),
            Err(_) => AppState::default(),
        };
        Store {
            file,
            state: Mutex::new(state),
        }
    }

    /// Текущее состояние.
    pub fn load(&self) -> AppState {
        self.state
            .lock()
            .map(|held| held.clone())
            .unwrap_or_default()
    }

    /// Подменить названные поля и сохранить файл: правка темы чат и папку не затирает.
    pub fn patch(&self, patch: &StatePatch) -> Result<AppState, String> {
        let mut held = self
            .state
            .lock()
            .map_err(|_| "хранилище состояния занято".to_string())?;
        *held = held.patched(patch);
        self.write(&held)?;
        Ok(held.clone())
    }

    /// Запись файла состояния; папка данных создаётся на первом сохранении.
    fn write(&self, state: &AppState) -> Result<(), String> {
        let json = serde_json::to_string(state)
            .map_err(|e| format!("состояние не собралось в JSON: {e}"))?;
        let parent = self.file.parent().unwrap_or_else(|| std::path::Path::new("."));
        fs::create_dir_all(parent)
            .map_err(|e| format!("папка данных не создалась {}: {e}", parent.display()))?;
        fs::write(&self.file, json)
            .map_err(|e| format!("файл состояния не записан {}: {e}", self.file.display()))
    }
}
