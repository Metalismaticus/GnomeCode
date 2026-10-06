//! Плагин и его команды — что интерфейс показывает на экране. Движковые поля
//! (`source`, `features`) сюда не переносятся: ленте и шапке они не нужны, а
//! формат движка не должен растекаться по типам (ADR-0001).

/// Категория и её правило — то, что карточка знает о правилах плагина (Configure).
use std::collections::BTreeMap;

/// Команда плагина: полное имя — как его зовёт движок, подпись — то, что на кнопке.
#[derive(Clone, Debug, serde::Serialize)]
pub struct Command {
    /// Полное имя в списке команд движка: `плагин:команда`.
    pub name: String,
    /// Имя команды без имени плагина — оно и стоит на кнопке в шапке.
    pub label: String,
    /// Что команда делает — подсказка кнопки.
    pub description: String,
}

/// Плагин проекта: одна команда — одна кнопка, поэтому команды приходят списком.
#[derive(Clone, Debug, serde::Serialize)]
pub struct Plugin {
    /// Идентификатор плагина у движка: им он подписывает свои команды.
    pub id: String,
    /// Готов ли плагин работать: `active` или `failed` с причиной.
    pub state: String,
    /// Причина неудачи — словами, пусто у рабочего плагина.
    pub error: String,
    /// Команды этого плагина из общего списка движка.
    pub commands: Vec<Command>,
    /// Подключён ли плагин к этому чату — по реестру чата.
    pub connected: bool,
    /// Поля карточки раздела «Плагины» (docs/SPEC/plugins.md, сцена A) — их даёт
    /// реестр установленного; у плагина движка их нет, поэтому Option и пропускаются,
    /// форма движка не растекается (ADR-0001).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Права вида «Категория: значение» — пусто, если реестр их не помнит.
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub permissions: Vec<String>,
    /// Выключен владельцем: кнопки команд уходят из чатов, установка не тронута.
    /// Плагин движка не выключен никогда: его реестр не задевает.
    pub disabled: bool,
    /// Правила категорий из rules.json: `категория → allow/ask/deny`; нет — все
    /// категории по умолчанию `ask` (src-tauri/src/plugins/rules.rs).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rules: Option<BTreeMap<String, String>>,
    /// Скоуп подключения к этому чату (сцена E): `once`, `chat`, `project` или
    /// `global` — полоса у подключённой строки показывает его предвыбранным.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub scope: Option<String>,
    /// Что updates.json помнит об обновлении плагина: версии «от → до», пометка
    /// и новые права; нет — обновления не было или оно давнее (updates.rs).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub update: Option<Update>,
}

/// Чем кончилось обновление плагина (updates.json, updates.rs).
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UpdateStatus {
    /// Обновилось молча: права не менялись, файл заменён при запуске.
    Applied,
    /// Изменившиеся права: файл прежней версии, сводка прав до включения (сцена K).
    Held,
    /// Плагина нет в каталоге: проверить новую версию нечем.
    Outside,
    /// Новая версия не запустилась у движка: откат на предыдущую.
    Broken,
}

/// Запись об обновлении: версии «от → до» и новые права, если изменились —
/// то, что карточка вкладки Updates показывает и что сводка прав переносит.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Update {
    /// Версия, с которой обновлялись: та, что была в реестре установленного.
    pub from: String,
    /// Версия каталога, до которой обновили (или хотели, если обновление держится).
    pub to: String,
    /// Чем кончилось.
    pub status: UpdateStatus,
    /// Новые права декларации «Категория: значение» — для сводки до включения;
    /// пусты, если права не менялись.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub permissions: Vec<String>,
}

/// Состояние движка «плагина работает».
pub const ACTIVE: &str = "active";