//! Реестр плагинов, подключённых к чату: что владелец подключил кнопкой «+».
//!
//! Хранится в окне и на диск не пишется: подключение переживает перерисовку чата,
//! но не перезапуск приложения — данные пользователя в проекте ещё нет
//! (docs/TESTING.md, «Данные пользователя»).

use std::sync::Mutex;

/// Подключённые к чату плагины по идентификатору движка, в порядке подключения.
#[derive(Default)]
pub struct Registry {
    connected: Mutex<Vec<String>>,
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
}