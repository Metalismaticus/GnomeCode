//! Реестр плагинов, подключённых к чату: что владелец подключил кнопкой «+».
//!
//! Хранится в окне и на диск не пишется: подключение переживает перерисовку чата,
//! но не перезапуск приложения — данные пользователя в проекте ещё нет
//! (docs/TESTING.md, «Данные пользователя»). Выключение плагина без записи
//! реестра — тоже память окна.
//!
//! Перезапуск окна — прокси «нового чата»: скоупы проекта и глобальные хранит
//! файл (scopes.rs), поэтому кнопки возвращаются, а «этот чат» — нет. Снятый
//! с чата плагин держится снятым до перезапуска тем же правилом: opt-out —
//! память окна, файл скоупов он не трогает.

use std::sync::Mutex;

/// Подключённые к чату плагины по идентификатору движка, в порядке подключения.
#[derive(Default)]
pub struct Registry {
    connected: Mutex<Vec<String>>,
    /// Выключенные из интерфейса плагины без записи реестра (у их установщика
    /// папки файла нет): как подключение — память окна. У записанных в реестр
    /// выключение хранит сам файл (`installed.json`, `manage::set_disabled`).
    disabled: Mutex<Vec<String>>,
    /// Снятые с чата в этом окне: их скоуп не возвращает кнопки до перезапуска.
    opt_out: Mutex<Vec<String>>,
    /// Подключённые «Once»: соединение служит текущему запросу, следующий
    /// вопрос снимает их с чата (сцена E).
    once: Mutex<Vec<String>>,
}

impl Registry {
    /// Зарегистрировать выбор подключения (сцена E, клик строки или полосы
    /// скоупов). Явный скоуп (`explicit`) обновляет реестр даже у уже
    /// подключённой строки: «Once» обязан сняться после следующего вопроса
    /// (`take_once`), «Chat» после перезапуска обязан вернуть реестр, когда он
    /// пуст. Идемпотентен только клик строки без скоупа — полосу открывает он.
    pub fn choose(&self, id: &str, kind: &str, explicit: bool, already: bool) {
        if !explicit && already {
            return;
        }
        if kind == "once" {
            self.mark_once(id);
        } else {
            self.connect(id);
        }
    }

    /// Подключить плагин: повторное подключение ничего не меняет, снятие с чата
    /// в этом окне забывается — владелец подключил заново явно.
    pub fn connect(&self, id: &str) {
        if let Ok(mut held) = self.opt_out.lock() {
            held.retain(|known| known != id);
        }
        if let Ok(mut held) = self.connected.lock() {
            if !held.iter().any(|known| known == id) {
                held.push(id.to_string());
            }
        }
    }

    /// Подключить «Once»: тот же реестр чата плюс пометка — следующий вопрос
    /// снимет плагин (`take_once`).
    pub fn mark_once(&self, id: &str) {
        self.connect(id);
        if let Ok(mut held) = self.once.lock() {
            if !held.iter().any(|known| known == id) {
                held.push(id.to_string());
            }
        }
    }

    /// Снять с чата после следующего вопроса: список «Once» чистится, плагин
    /// уходит из подключённых. Возвращает снятые id — команде chat_send для
    /// счёта ничего не нужно, пусто — «Once»-подключений не было.
    pub fn take_once(&self) -> Vec<String> {
        let taken = self.once.lock().map(|mut held| std::mem::take(&mut *held)).unwrap_or_default();
        for id in &taken {
            if let Ok(mut held) = self.connected.lock() {
                held.retain(|known| known != id);
            }
        }
        taken
    }

    /// Список подключённых — его показывает шапка и по нему плагины отмечаются в списке.
    pub fn connected(&self) -> Vec<String> {
        self.connected.lock().map(|held| held.clone()).unwrap_or_default()
    }

    /// Подключённые «Once» — скоуп строки в полосе (once предвыбран).
    pub fn once_ids(&self) -> Vec<String> {
        self.once.lock().map(|held| held.clone()).unwrap_or_default()
    }

    /// Снять плагин с чата без деинсталляции (панель «Plugins in this chat»):
    /// подключение уходит и запоминается снятым — скоуп проекта или глобальный
    /// не вернёт кнопки в этом окне, файл скоупов не трогается.
    pub fn opt_out_of(&self, id: &str) {
        if let Ok(mut held) = self.connected.lock() {
            held.retain(|known| known != id);
        }
        if let Ok(mut held) = self.once.lock() {
            held.retain(|known| known != id);
        }
        if let Ok(mut held) = self.opt_out.lock() {
            if !held.iter().any(|known| known == id) {
                held.push(id.to_string());
            }
        }
    }

    /// Снятые с чата в этом окне — к ним команда plugin_list прибавляет скоупы.
    pub fn opted_out(&self) -> Vec<String> {
        self.opt_out.lock().map(|held| held.clone()).unwrap_or_default()
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

    /// Плагин удалён: ни подключённым, ни выключенным, ни снятым он больше не числится.
    pub fn forget(&self, id: &str) {
        if let Ok(mut held) = self.connected.lock() {
            held.retain(|known| known != id);
        }
        if let Ok(mut held) = self.opt_out.lock() {
            held.retain(|known| known != id);
        }
        if let Ok(mut held) = self.once.lock() {
            held.retain(|known| known != id);
        }
        self.enable(id);
    }
}
