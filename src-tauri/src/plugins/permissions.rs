//! Слой прав вызовов плагинов: утверждённый UX «Спрашивать при первом
//! использовании» (docs/SPEC/plugins.md, «Утверждённый UX одобрения»).
//!
//! Деклараций прав у плагинов проекта пока нет — вызов без декларации считается
//! чувствительным и спрашивает владельца всегда. Правило «для этого чата» —
//! память окна: по UX живёт до перезапуска приложения, а данные пользователя в
//! проекте ещё не пишутся (docs/TESTING.md, «Данные пользователя»). Правила
//! «для проекта» из того же окна и глобальные в настройках — Этап 2
//! (docs/BLOCKED.md, «Решено»).
//!
//! Слой прав решает ДО вызова движка: собственный permission-слой OpenCode не
//! слушает наружу — `POST /api/session/{id}/permission` на живом сервере
//! возвращает решение сам, не спрося никого (замер 2026-10-05).

use std::collections::HashSet;
use std::sync::Mutex;

/// Правила этого чата: ключ — полное имя команды у движка (`docs:search`).
#[derive(Default)]
pub struct Grants {
    allowed: Mutex<HashSet<String>>,
}

impl Grants {
    /// Владелец разрешил команду этому чату: она больше не спрашивает (кусок 4c).
    pub fn allow(&self, command: &str) {
        if let Ok(mut held) = self.allowed.lock() {
            held.insert(command.to_string());
        }
    }

    /// Чувствительный ли вызов: правило не выдано — спрашивать окном.
    pub fn sensitive(&self, command: &str) -> bool {
        !self
            .allowed
            .lock()
            .is_ok_and(|held| held.contains(command))
    }
}
