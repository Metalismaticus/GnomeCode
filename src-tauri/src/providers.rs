//! Ключи провайдеров (docs/specs/2026-10-06-12-nastrojki.md): Windows
//! Credential Manager через крейт `keyring` v3 — хранит ОС, свои файлы и
//! state.json ключ не получают. На экране ключ не возвращается: наружу только
//! «задан/не задан» и статус проверки ([`status`]). Сервис задаёт окно,
//! имя записи — идентификатор провайдера движка (`zhipuai`).

use keyring::Entry;

/// Имя сервиса хранилища окна: одна запись на провайдера, имя — его id.
pub const SERVICE: &str = "GnomeCode";

/// Ключ провайдера: запись по его id в названном сервисе.
fn entry(service: &str, provider: &str) -> Entry {
    Entry::new(service, provider).expect("имена сервиса и ключа корректны")
}

/// Записать ключ: перезапись существующего — норма («Заменить ключ»).
pub fn save(provider: &str, secret: &str) -> Result<(), String> {
    entry(SERVICE, provider)
        .set_password(secret)
        .map_err(|e| format!("ключ «{provider}» не записан в хранилище Windows: {e}"))
}

/// Удалить ключ: нет записи — уже чисто, а не ошибка («Убрать» дважды).
pub fn remove(provider: &str) -> Result<(), String> {
    match entry(SERVICE, provider).delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("ключ «{provider}» не удалён из хранилища Windows: {e}")),
    }
}

/// Есть ли ключ: на экране — «задан ✓» / «ключ не задан»; сам секрет не читается.
pub fn status(provider: &str) -> Result<bool, String> {
    // get_password: заданный ключ объявят, пустой секрет считают «не задан».
    match entry(SERVICE, provider).get_password() {
        Ok(secret) => Ok(!secret.is_empty()),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(format!("заметка о ключе «{provider}» не доступна: {e}")),
    }
}

/// Заметки о ключе в названном сервисе: те же ходы, что у окна, но во временном
/// сервисе проверки — Credential Manager реален, данные владельца не трогаются
/// (docs/TESTING.md, «Данные пользователя»). Секрет не читается.
pub mod scratch {
    use super::entry;

    /// Записать ключ во временный сервис.
    pub fn save(service: &str, provider: &str, secret: &str) -> Result<(), String> {
        entry(service, provider)
            .set_password(secret)
            .map_err(|e| format!("ключ «{provider}» не записан в хранилище Windows: {e}"))
    }

    /// Удалить ключ временного сервиса: «нет записи» — уже чисто.
    pub fn remove(service: &str, provider: &str) -> Result<bool, String> {
        match entry(service, provider).delete_credential() {
            Ok(()) => Ok(true),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(format!("ключ «{provider}» не удалён из хранилища Windows: {e}")),
        }
    }

    /// Статус записи временного сервиса: «задан» / «не задан».
    pub fn status(service: &str, provider: &str) -> Result<bool, String> {
        match entry(service, provider).get_password() {
            Ok(secret) => Ok(!secret.is_empty()),
            Err(keyring::Error::NoEntry) => Ok(false),
            Err(e) => Err(format!("заметка о ключе «{provider}» не доступна: {e}")),
        }
    }
}

pub mod tests {
    //! Ключ на временной записи: Credential Manager — реальное хранилище
    //! ОС, поэтому имя записи своё у проверки (docs/TESTING.md, команда).

    /// Записан → статус «задан» → удалён → статус «не задан».
    #[test]
    fn saved_key_is_reported_and_removal_clears_it() {
        let provider = "gnomecode-check-keyring";
        super::remove(provider).expect("чистый старт: записи нет и это не ошибка");
        assert_eq!(
            super::status(provider).expect("заметка чистого хранилища"),
            false,
            "у записи без ключа статус «не задан»"
        );

        super::save(provider, "sk-test-123").expect("ключ записан в Credential Manager");
        assert_eq!(
            super::status(provider).expect("заметка записанного ключа"),
            true,
            "у записи с ключом статус «задан»"
        );

        super::remove(provider).expect("ключ удалён");
        assert_eq!(
            super::status(provider).expect("заметка после удаления"),
            false,
            "после удаления статус «не задан»"
        );

        // Убрать дважды: «нет записи» — норма.
        super::remove(provider).expect("повторное удаление без записи — не ошибка");
    }

    /// Незаданная связь не путает записи: статус другого провайдера untouched.
    #[test]
    fn other_providers_are_unaffected() {
        let mine = "gnomecode-check-keyring-a";
        let other = "gnomecode-check-keyring-b";
        super::remove(mine).expect("чистый старт");
        super::remove(other).expect("чистый старт");

        super::save(mine, "sk-a").expect("ключ первого записан");
        assert_eq!(
            super::status(other).expect("заметка соседней записи"),
            false,
            "ключ своего провайдера не задел чужого"
        );
        super::remove(mine).expect("чистый выход");
    }
}
