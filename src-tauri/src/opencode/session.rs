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

/// Сессия из списка живых: ленте нужен идентификатор, сайдбару — титул и время
/// обновления. Форму элемента разбирает один раз [`parse_item`] — и возврат к
/// своей сессии, и строки сайдбара читают один и тот же разбор (ADR-0001).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SessionItem {
    pub id: String,
    /// Название чата, как его отдал список движка; не назвал — пустое.
    pub title: String,
    /// Время обновления (unix-миллисекунды, `time.updated`); нет — ничего.
    pub updated: Option<u64>,
}

/// Строка сайдбара из списка ядра (`chat_list`): интерфейс читает титул и
/// время, идентификатор ведёт клик по строке — открытие старого чата
/// переключает сессию по нему (слова владельца 2026-10-10, «чаты все
/// неактивные»; решение «id не нужен» отменено). Форму элемента знает только
/// этот разбор (ADR-0001).
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct ChatRow {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated: Option<u64>,
}

/// Элемент списка: сессия без идентификатора в ленте нечего возвращать — пропускаем.
/// Титул и время — что отдал список: выдумывать и дополнять их здесь нечем.
fn parse_item(raw: &Value) -> Option<SessionItem> {
    Some(SessionItem {
        id: raw.get("id")?.as_str()?.to_string(),
        title: raw
            .get("title")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        updated: raw
            .get("time")
            .and_then(|time| time.get("updated"))
            .and_then(Value::as_u64),
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

/// Строки сайдбара из списка живых сессий (`chat_list`): тот же разбор
/// [`parse_list`], наружу уходят титул и время — превью в списке ядра нет,
/// строки без второй линии (спека сайдбара §7).
pub fn chats(api: &Api) -> Result<Vec<ChatRow>, String> {
    Ok(parse_list(&api.sessions_raw()?)
        .into_iter()
        .map(|item| ChatRow {
            id: item.id,
            title: item.title,
            updated: item.updated,
        })
        .collect())
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{parse_list, resumed};

    /// Форма элемента списка живая (замер движка, `tests/session_resume.rs`):
    /// титул и `time.updated` доезжают до строки сайдбара, сессия без титула и
    /// времени — тоже в списке (умолчания), а не выброшена.
    #[test]
    fn item_form_title_and_updated() {
        let raw = json!([
            {"id": "ses_a", "title": "Разбор мебели", "time": {"updated": 1_760_000_000_000u64}},
            {"id": "ses_b"}
        ]);
        let list = parse_list(&raw);
        assert_eq!(list.len(), 2, "обе сессии разобраны: {list:?}");
        assert_eq!(list[0].title, "Разбор мебели", "титул элемента доехал");
        assert_eq!(
            list[0].updated,
            Some(1_760_000_000_000),
            "время обновления доехало"
        );
        assert_eq!(list[1].title, "", "без титула — пустая строка, не выброс");
        assert_eq!(list[1].updated, None, "без времени — пусто, а не ноль");
        // Возврат к своей сессии ищет по идентификатору — титул и время не мешают.
        assert_eq!(
            resumed(&list, "ses_b").map(|item| item.id.as_str()),
            Some("ses_b")
        );
    }

    /// Не список и элемент без идентификатора — пусто, без паники: форма ответа
    /// движка меняется, сайдбар остаётся живым тем, что есть.
    #[test]
    fn broken_forms_stay_empty() {
        assert!(parse_list(&json!(5)).is_empty(), "не список — пусто");
        assert!(
            parse_list(&json!([{"title": "без id"}])).is_empty(),
            "элемент без идентификатора не доходит"
        );
    }
}
