//! Переименование и удаление чатов (замечание владельца 2026-10-10: «переименование,
//! удаление, архивация» в меню строки сайдбара): `PATCH /api/session/{id}` меняет
//! заголовок в движке, `DELETE /api/session/{id}` убирает сессию из списка —
//! живые замеры v2.0.26 (2026-10-11): оба отвечают 204.
//!
//! Сервер здесь — loopback этого же теста: команды идут по тому пути, что в
//! продукте (`Api`), а не через отдельную функцию проверки.

use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

mod common;

use common::{json_head, read_request};
use gnomecode_lib::opencode::client::{Api, Endpoint};

/// Заголовки ответа на снятие/удаление: 204 с пустым телом — как живой сервер.
fn empty_head() -> String {
    "HTTP/1.1 204 No Content\r\nContent-Length: 0\r\n\r\n".to_string()
}

/// Сервер проверки: список сессий, заголовок одной из них и признак удаления.
/// Путь запроса пишем в лог — по нему видно, куда ушла команда.
fn serve(port: Arc<Mutex<u16>>, seen: Arc<Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    *port.lock().expect("порт") = listener.local_addr().expect("адрес").port();
    thread::spawn(move || {
        for socket in listener.incoming() {
            let Ok(mut socket) = socket else { return };
            let seen = Arc::clone(&seen);
            thread::spawn(move || {
                let request = read_request(&mut socket);
                let line = request.lines().next().unwrap_or_default().to_string();
                if let Ok(mut log) = seen.lock() {
                    // Весь запрос целиком: тело PATCH несёт новое название.
                    log.push(request.clone());
                }
                use std::io::Write;
                let deleted = seen
                    .lock()
                    .map(|log| log.iter().any(|one| one.starts_with("DELETE")))
                    .unwrap_or(false);
                if line.starts_with("PATCH /api/session/ses_one ")
                    || line.starts_with("DELETE /api/session/ses_one ")
               {
                    let _ = socket.write_all(empty_head().as_bytes());
                    return;
                }
                // Список после удаления — пустой, до удаления — две сессии.
                let body = if deleted {
                    r#"{"data":[]}"#.to_string()
                } else {
                    r#"{"data":[{"id":"ses_one","title":"Первая","time":{"updated":1760000000000}},{"id":"ses_two","title":"Вторая","time":{"updated":1760000001000}}]}"#.to_string()
                };
                let _ = socket.write_all(json_head(&body).as_bytes());
                thread::sleep(Duration::from_millis(50));
            });
        }
    });
}

/// Переименование: PATCH с новым заголовком уходит движку, ошибки нет.
#[test]
fn rename_sends_patch_with_the_new_title() {
    let port = Arc::new(Mutex::new(0u16));
    let seen = Arc::new(Mutex::new(Vec::new()));
    serve(Arc::clone(&port), Arc::clone(&seen));
    while *port.lock().expect("порт") == 0 {
        thread::sleep(Duration::from_millis(10));
    }
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());
    let api = Api::new(&endpoint);

    api.rename_session("ses_one", "Новое название").expect("переименование ушло");

    let log = seen.lock().expect("лог запросов").clone();
    assert!(
        log.iter().any(|one| one.starts_with("PATCH /api/session/ses_one ")),
        "переименование — PATCH по пути сессии: {log:?}"
    );
    // Тело запроса дочитывает read_request полностью — заголовок уже в логе.
    assert!(
        log.iter()
            .any(|one| one.contains("PATCH") && one.contains("Новое название")),
        "новое название чата уходит в теле PATCH: {log:?}"
    );
}

/// Удаление: DELETE уходит движку, следующая выборка списка уже без сессии.
#[test]
fn delete_removes_the_session_from_the_next_list() {
    let port = Arc::new(Mutex::new(0u16));
    let seen = Arc::new(Mutex::new(Vec::new()));
    serve(Arc::clone(&port), Arc::clone(&seen));
    while *port.lock().expect("порт") == 0 {
        thread::sleep(Duration::from_millis(10));
    }
    let endpoint = Endpoint::local(*port.lock().expect("порт"), "test-pass".to_string());
    let api = Api::new(&endpoint);

    let before = gnomecode_lib::opencode::session::sessions(&api).expect("список до удаления");
    assert_eq!(before.len(), 2, "до удаления обе сессии в списке");

    api.delete_session("ses_one").expect("удаление ушло");

    let log = seen.lock().expect("лог запросов").clone();
    assert!(
        log.iter().any(|one| one.starts_with("DELETE /api/session/ses_one ")),
        "удаление — DELETE по пути сессии: {log:?}"
    );
    let after = gnomecode_lib::opencode::session::sessions(&api).expect("список после удаления");
    assert!(
        after.iter().all(|one| one.id != "ses_one"),
        "удалённой сессии в списке нет: {after:?}"
    );
}
