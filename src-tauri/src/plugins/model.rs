//! Плагин и его команды — что интерфейс показывает на экране. Движковые поля
//! (`source`, `features`) сюда не переносятся: ленте и шапке они не нужны, а
//! формат движка не должен растекаться по типам (ADR-0001).

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
}

/// Состояние движка «плагина работает».
pub const ACTIVE: &str = "active";