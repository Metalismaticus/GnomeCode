//! Реестр плагинов, подключённых к чату: что владелец подключил кнопкой «+».
//!
//! Хранится в окне и на диск не пишется: подключение переживает перерисовку чата,
//! но не перезапуск приложения — данные пользователя в проекте ещё нет
//! (docs/TESTING.md, «Данные пользователя»). Выключение плагина без записи
//! реестра — тоже память окна.

use std::sync::Mutex;

/// Подключённые к чату плагины по идентификатору движка, в порядке подключения.
#[derive(Default)]
pub struct Registry {
    connected: Mutex<Vec<String>>,
    /// Выключенные из интерфейса плагины без записи реестра (у их установщика
    /// папки файла нет): как подключение — память окна. У записанных в реестр
    /// выключение хранит сам файл (`installed.json`, `manage::set_disabled`).
    disabled: Mutex<Vec<String>>,
}

impl Registry {
    /// Подключить плагин: повторное подключение ничего не меняет.
    pub fn connect(&self, id: &str) {
        if let Ok(mut held) = self.connected.lock() {
            if !held.iter().any(|known| known == id) {
                held.push(id.to_string());
            }
        }
    }

    /// Список подключённых — его показывает шапка и по нему плагины отмечаются в списке.
    pub fn connected(&self) -> Vec<String> {
        self.connected.lock().map(|held| held.clone()).unwrap_or_default()
    }

    /// Выключить плагин, который не в реестре установленного: без файла —
    /// некуда писать состояние. Включение — убрать из списка.
    pub fn disable(&self, id: &str) {
        if let Ok(mut held) = self.disabled.lock() {
            if !held.iter().any(|known| known == id) {
                held.push(id.to_string());
            }
        }
    }

    pub fn enable(&self, id: &str) {
        if let Ok(mut held) = self.disabled.lock() {
            held.retain(|known| known != id);
        }
    }

    /// Выключенные без записи — к ним сводка при склейке списка (catalog::merged).
    pub fn disabled(&self) -> Vec<String> {
        self.disabled.lock().map(|held| held.clone()).unwrap_or_default()
    }

    /// Плагин удалён: ни подключённым, ни выключенным он больше не числится.
    pub fn forget(&self, id: &str) {
        if let Ok(mut held) = self.connected.lock() {
            held.retain(|known| known != id);
        }
        self.enable(id);
    }
}