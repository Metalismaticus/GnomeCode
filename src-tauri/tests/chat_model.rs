//! Выбранная модель меняет запрос чату (docs/BATCH.md, пункт 10;
//! docs/specs/2026-10-06-10-compare.md): «Выбрать» в панели сравнения пишет
//! выбор в state.json, следующий вопрос движку несёт `providerID`/`modelID`,
//! а без выбора запрос уходит как раньше — на модели движка по умолчанию.
//!
//! Мост здесь настоящий (`Chat`, `Store`), движок — лупбек из `common`: тела
//! запросов складываются в список, их читает сам тест. Данные — во временных
//! папках, базы владельца проверки не касаются. Гоняет `tests/checks/chat_model.py`.

mod common;

use std::io::Write;
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use common::{chunked_head, json_head, read_request, ListSink, Loopback};
use gnomecode_lib::opencode::client::Endpoint;
use gnomecode_lib::opencode::{Chat, Sink};
use gnomecode_lib::state::{ChatModel, Store, StatePatch};

const WAIT: Duration = Duration::from_secs(10);

/// Модель, которую выбрал владелец: имя из каталога стоит на бейдже шапки,
/// идентификатор `лаборатория/модель` уходит движку с запросом.
fn choice() -> ChatModel {
    ChatModel {
        name: "North Mini Code".to_string(),
        id: "cohere/north-mini-code-1-0".to_string(),
    }
}

/// Свой файл состояния на тест: тесты одного процесса идут параллельно.
fn scratch(name: &str) -> PathBuf {
    let file = std::env::temp_dir().join(format!("gnomecode-model-{name}-{}.json", std::process::id()));
    let _ = std::fs::remove_file(&file);
    file
}

/// Лупбек, который запоминает то, что мост послал `POST /prompt`: тело запроса
/// — единственное место, где видно, моделью ли пошёл вопрос.
fn serve() -> (Endpoint, Arc<Mutex<Vec<String>>>) {
    let listener = TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let endpoint = Endpoint::local(listener.local_addr().expect("адрес").port(), "test-pass".to_string());
    let bodies: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let held = Arc::clone(&bodies);
    thread::spawn(move || {
        for socket in listener.incoming().flatten() {
            let mut socket = socket;
            let bodies = Arc::clone(&held);
            thread::spawn(move || {
                let request = read_request(&mut socket);
                let line = request.lines().next().unwrap_or_default().to_string();
                if line.contains("/prompt") {
                    bodies.lock().expect("список тел").push(request);
                }
                let reply = if line.starts_with("POST /api/session ") {
                    json_head(r#"{"data":{"id":"ses_fixture"}}"#)
                } else if line.contains("/prompt") {
                    json_head(r#"{"data":{"id":"msg_fixture"}}"#)
                } else {
                    chunked_head().to_string()
                };
                let _ = socket.write_all(reply.as_bytes());
                let _ = socket.flush();
                if reply.starts_with("HTTP/1.1 200 OK\r\nContent-Type: text/event-stream") {
                    // Поток событий держится открытым, пока идёт проверка.
                    thread::sleep(Duration::from_secs(30));
                }
            });
        }
    });
    (endpoint, bodies)
}

fn wait_prompt(bodies: &Arc<Mutex<Vec<String>>>) {
    let deadline = std::time::Instant::now() + WAIT;
    while std::time::Instant::now() < deadline {
        if prompt_lines(bodies).iter().any(|one| one.contains("/prompt")) {
            return;
        }
        thread::sleep(Duration::from_millis(20));
    }
    panic!("запрос к /prompt не пришёл за {WAIT:?}: {:?}", prompt_lines(bodies));
}

/// Тело последнего POST /prompt: то, что ушло движку со строкой вопроса.
fn last_body(bodies: &Arc<Mutex<Vec<String>>>) -> String {
    prompt_lines(bodies)
        .last()
        .expect("POST /prompt записан лупбеком")
        .split_once("\r\n\r\n")
        .map(|(_, body)| body.to_string())
        .expect("тело запроса после заголовков")
}

/// Вопрос через мост: строкой ленты собирается тут же, в sink проверки.
fn send_through(chat: &Chat, model: Option<ChatModel>) {
    let sent = gnomecode_lib::project::request(None, "Проверь мост", &[]).expect("вопрос собран");
    chat.send(&sent.shown, &sent.prompt, &[], model)
        .expect("вопрос ушёл в ленту");
}

/// Выбор хранится в state.json рядом с темой и папкой: бейдж шапки читает имя,
/// запрос движку — идентификатор, правка темы выбор не затирает.
#[test]
fn chosen_model_is_stored_and_survives_restart() {
    let file = scratch("stored");
    let store = Arc::new(Store::at(file.clone()));
    store
        .patch(&StatePatch {
            chat_model: Some(choice()),
            ..StatePatch::default()
        })
        .expect("выбор модели запомнился");
    store
        .patch(&StatePatch {
            theme: Some(gnomecode_lib::state::Theme::Dark),
            ..StatePatch::default()
        })
        .expect("тема запомнилась");

    // «Перезапуск окна» — новое чтение того же файла, как в стандартном цикле.
    let reopened = Store::at(file);
    let saved = reopened.load();
    let choice = saved.chat_model.expect("выбор пережил перезапуск окна");
    assert_eq!(choice.name, "North Mini Code", "бейдж шапки читает имя из состояния");
    assert_eq!(choice.id, "cohere/north-mini-code-1-0", "запрос движку несёт тот же идентификатор");
    assert_eq!(saved.theme, Some(gnomecode_lib::state::Theme::Dark), "правка темы выбор модели не затёрла");
}

/// «Выбрать» меняет запрос: движку уходит пара providerID/modelID выбранной модели.
#[test]
fn prompt_with_chosen_model_names_it() {
    let (endpoint, bodies) = serve();
    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_engine(Box::new(Loopback { endpoint }), Arc::clone(&sink) as Arc<dyn Sink>);

    send_through(&chat, Some(choice()));
    wait_prompt(&bodies);

    let body = last_body(&bodies);
    assert!(
        body.contains(r#""providerID":"cohere""#),
        "в запросе к чату нет провайдера выбранной модели: {body}"
    );
    assert!(
        body.contains(r#""modelID":"north-mini-code-1-0""#),
        "в запросе к чату нет модели после «/»: {body}"
    );
}

/// Без выбора — как раньше: тело запроса модели не называет, движок берёт свою.
#[test]
fn prompt_without_choice_goes_to_the_default_model() {
    let (endpoint, bodies) = serve();
    let sink = Arc::new(ListSink::default());
    let chat = Chat::with_engine(Box::new(Loopback { endpoint }), Arc::clone(&sink) as Arc<dyn Sink>);

    send_through(&chat, None);
    wait_prompt(&bodies);

    let body = last_body(&bodies);
    assert!(
        !body.contains("modelID"),
        "запрос без выбора назвал модель — новый текст вопроса ушёл бы не той моделью: {body}"
    );
}

/// Тела запросов лупбека списком строк.
fn prompt_lines(bodies: &Arc<Mutex<Vec<String>>>) -> Vec<String> {
    bodies.lock().expect("список тел").clone()
}
