//! Сессии движка поверх Api: список живых сессий и правило возврата к своей
//! («Один полный цикл»: сессия переживает рестарт нашего приложения, рестарт
//! движка при этом не нужен — замер 2026-10-05, сессии живут в базе движка).
//!
//! Формат элемента списка знает только это место (ADR-0001): лента получает
//! идентификатор, а не JSON движка.

use serde_json::Value;

use super::client::Api;
use crate::state::{StatePatch, Store};

/// Титул новой сессии: наш, один на приложение — знает только это место.
const TITLE: &str = "GnomeCode";

/// Сессия из списка живых: ленте нужен только её идентификатор.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionItem {
    pub id: String,
}

/// Элемент списка: сессия без идентификатора в ленте нечего возвращать — пропускаем.
fn parse_item(raw: &Value) -> Option<SessionItem> {
    Some(SessionItem {
        id: raw.get("id")?.as_str()?.to_string(),
    })
}

/// Разбор списка сессий из ответа движка: не список — пусто, без паники.
pub fn parse_list(raw: &Value) -> Vec<SessionItem> {
    match raw {
        Value::Array(list) => list.iter().filter_map(parse_item).collect(),
        _ => Vec::new(),
    }
}

/// Правило возврата: сохранённый идентификатор есть в списке живых — она же,
/// нет (удалена, движок пуст) — None: приложение поднимет новую сессию.
pub fn resumed<'a>(list: &'a [SessionItem], saved: &str) -> Option<&'a SessionItem> {
    list.iter().find(|item| item.id == saved)
}

/// Живые сессии движка: `GET /api/session` через мост, форму элемента разбирает
/// [`parse_list`] — формат списка знает только этот модуль (ADR-0001).
pub fn sessions(api: &Api) -> Result<Vec<SessionItem>, String> {
    let raw = api.sessions_raw()?;
    Ok(parse_list(&raw))
}

/// Занять сессию ленты: вернуться к сохранённой прошлого запуска приложения или
/// поднять новую. Новую запоминаем — именно она откроется при следующем запуске.
/// Память на диске подвести может, лента продолжает: следующий запуск поднимет
/// новую сессию, а не перемрёт из-за не записанной темы или папки.
pub fn acquire(api: &Api, saved: Option<String>, store: Option<&Store>) -> Result<String, String> {
    let found = saved.and_then(|saved| {
        sessions(api)
            .ok()
            .and_then(|list| resumed(&list, &saved).map(|item| item.id.clone()))
    });
    if let Some(id) = found {
        return Ok(id);
    }
    let id = api.create_session(TITLE)?;
    if let Some(store) = store {
        let patch = StatePatch {
            session: Some(id.clone()),
            ..StatePatch::default()
        };
        let _ = store.patch(&patch);
    }
    Ok(id)
}
