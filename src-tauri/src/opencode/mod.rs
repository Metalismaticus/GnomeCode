//! Мост к OpenCode server: корень. Здесь одно место истины API — остальные модули
//! и интерфейс знают только строки ленты ([`FeedEvent`]), а не события OpenCode.
//!
//! Поток один: он держит движок ([`engine::Engine`]), читает события
//! ([`client::EventStream`]), превращает их в строки ленты ([`client::Feed`])
//! и отдаёт их подписчику ([`Sink`]). Падение сервера не блокирует интерфейс:
//! в ленту уходит строка «перезапускаю», автоответ модели не отправляется —
//! это вызов инструментов без вопроса.

pub mod client;
pub mod engine;

use std::sync::mpsc::{Receiver, Sender, TryRecvError};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use tauri::Emitter;

use client::{Api, EventStream, Feed, FeedEvent, Step};
use engine::Engine;

/// Имя канала Tauri, по которому лента получает строки.
pub const FEED_CHANNEL: &str = "chat-feed";

const NOTICE_RESTART: &str = "Сервер OpenCode недоступен, перезапускаю…";
const NOTICE_RECONNECT: &str = "Поток прерван, переподключаюсь…";
const NOTICE_RECOVERED: &str = "Сервер OpenCode снова отвечает";
const NOTICE_NO_ENGINE: &str = "Движок OpenCode не запущен";
const RETRY_SECONDS: u64 = 5;

/// Куда уходят строки ленты. Продукт отдаёт их окну, проверка — своему списку.
pub trait Sink: Send + Sync + 'static {
    fn emit(&self, event: FeedEvent);
}

/// Подписчик окна Tauri.
pub struct WindowSink(pub tauri::AppHandle);

impl Sink for WindowSink {
    fn emit(&self, event: FeedEvent) {
        let _ = self.0.emit(FEED_CHANNEL, event);
    }
}

enum Cmd {
    Prompt(String),
    Stop,
}

/// Движок глазами ленты: жив ли он и поднять ли снова. Приложение работает с живым
/// [`Engine`], проверка подставляет свой — ей нужен обрыв потока, а не движок.
pub trait EngineLife: Send + 'static {
    /// Адрес, по которому лента говорит с движком.
    fn endpoint(&self) -> client::Endpoint;
    /// Ещё ли жив движок: `false` — пора перезапускать.
    fn alive(&mut self) -> bool;
    /// Поднять заново после падения.
    fn restart(&mut self) -> Result<(), String>;
}

impl EngineLife for Engine {
    fn endpoint(&self) -> client::Endpoint {
        Engine::endpoint(self)
    }

    fn alive(&mut self) -> bool {
        Engine::alive(self)
    }

    fn restart(&mut self) -> Result<(), String> {
        Engine::restart(self)
    }
}

/// Живой чат: команда интерфейса «отправить» и отписка.
pub struct Chat {
    tx: Sender<Cmd>,
}

impl Chat {
    /// Поднять движок и начать ленту — то, что делает приложение при старте.
    pub fn start(sink: Arc<dyn Sink>) -> Chat {
        match Engine::start() {
            Ok(engine) => Chat::with_engine(Box::new(engine), sink),
            Err(reason) => {
                // Движка нет — приложение всё равно должно открыться и сказать об этом в ленте.
                sink.emit(FeedEvent::notice(
                    "engine",
                    &format!("{NOTICE_NO_ENGINE}: {reason}"),
                ));
                let (tx, rx) = std::sync::mpsc::channel();
                thread::spawn(move || supervise_missing(rx, sink));
                Chat { tx }
            }
        }
    }

    /// Лента на своём движке: тот же путь, что у приложения, но движок подставляет
    /// вызывающий — так проверка стережёт обрыв потока, не поднимая настоящий opencode.
    pub fn with_engine(engine: Box<dyn EngineLife>, sink: Arc<dyn Sink>) -> Chat {
        let (tx, rx) = std::sync::mpsc::channel();
        thread::spawn(move || supervise(engine, rx, sink));
        Chat { tx }
    }

    /// Отправить текст в сессию: команда уходит в поток ленты, а не блокирует интерфейс.
    pub fn send(&self, text: &str) -> Result<(), String> {
        let text = text.trim();
        if text.is_empty() {
            return Err("пустое сообщение отправлять нечем".to_string());
        }
        self.tx
            .send(Cmd::Prompt(text.to_string()))
            .map_err(|_| "лента закрыта: перезапустите приложение".to_string())
    }
}

impl Drop for Chat {
    fn drop(&mut self) {
        let _ = self.tx.send(Cmd::Stop);
    }
}

/// Поток ленты: сессия, поток событий, команды пользователя и перезапуск движка.
fn supervise(mut engine: Box<dyn EngineLife>, rx: Receiver<Cmd>, sink: Arc<dyn Sink>) {
    let endpoint = engine.endpoint();
    let api = Api::new(&endpoint);
    let mut session: Option<String> = None;
    // Счётчик строк вопроса живёт дольше одного потока: обрыв и переподключение не
    // начинают нумерацию заново, иначе следующий вопрос получил бы id прошлой строки,
    // а foldFeed заменил бы её вместо новой — и вопрос владельца пропал бы из ленты.
    let mut sent = 0usize;
    loop {
        if !engine.alive() {
            sink.emit(FeedEvent::notice("engine", NOTICE_RESTART));
            match engine.restart() {
                Ok(()) => sink.emit(FeedEvent::notice("engine", NOTICE_RECOVERED)),
                Err(reason) => {
                    sink.emit(FeedEvent::notice("engine", &reason));
                    thread::sleep(Duration::from_secs(RETRY_SECONDS));
                    continue;
                }
            }
            // Движок перезапустился — сессии прошлой жизни больше нет.
            session = None;
        }
        let id = match session
            .clone()
            .or_else(|| api.create_session("GnomeCode").ok())
        {
            Some(id) => id,
            None => {
                sink.emit(FeedEvent::notice(
                    "engine",
                    "Сессия не создана: сервер не ответил",
                ));
                thread::sleep(Duration::from_secs(RETRY_SECONDS));
                continue;
            }
        };
        session = Some(id.clone());
        let mut stream = match EventStream::connect(&endpoint) {
            Ok(stream) => stream,
            Err(reason) => {
                sink.emit(FeedEvent::notice(
                    "stream",
                    &format!("{NOTICE_RECONNECT}: {reason}"),
                ));
                thread::sleep(Duration::from_secs(RETRY_SECONDS));
                continue;
            }
        };
        let mut feed = Feed::default();
        if pump(&mut stream, &id, &api, &rx, &sink, &mut feed, &mut sent) {
            return;
        }
        sink.emit(FeedEvent::notice("stream", NOTICE_RECONNECT));
    }
}

/// Движка нет на месте: лента живёт и повторяет попытку, окно не падает.
fn supervise_missing(rx: Receiver<Cmd>, sink: Arc<dyn Sink>) {
    loop {
        match rx.try_recv() {
            Ok(Cmd::Stop) => return,
            Ok(Cmd::Prompt(_)) => sink.emit(FeedEvent::notice(
                "engine",
                &format!("{NOTICE_NO_ENGINE}: поставьте opencode CLI — сообщение не отправлено"),
            )),
            Err(TryRecvError::Disconnected) => return,
            Err(TryRecvError::Empty) => thread::sleep(Duration::from_secs(RETRY_SECONDS)),
        }
    }
}

/// Чтение потока до обрыва. `true` — лента закрыта по команде.
fn pump(
    stream: &mut EventStream,
    session: &str,
    api: &Api,
    rx: &Receiver<Cmd>,
    sink: &Arc<dyn Sink>,
    feed: &mut Feed,
    // Счётчик строк вопроса владельца: переживает обрыв потока, его ведёт поток ленты.
    sent: &mut usize,
) -> bool {
    loop {
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                Cmd::Stop => return true,
                Cmd::Prompt(text) => {
                    *sent += 1;
                    // Идентификатор строки вопроса не переиспользуется: два одинаковых
                    // вопроса — две строки, даже если между ними был обрыв потока.
                    sink.emit(FeedEvent::Row {
                        id: format!("user-{sent}"),
                        kind: client::RowKind::User,
                        text: text.clone(),
                    });
                    if let Err(reason) = api.prompt(session, &text) {
                        sink.emit(FeedEvent::notice(
                            "engine",
                            &format!("Сообщение не ушло: {reason}"),
                        ));
                    }
                }
            }
        }
        match stream.step() {
            Ok(Step::Idle) => continue,
            Ok(Step::Closed) => return false,
            Ok(Step::Event(event)) => {
                for row in feed.apply(&event, session) {
                    sink.emit(row);
                }
            }
            Err(reason) => {
                sink.emit(FeedEvent::notice("stream", &reason));
                return false;
            }
        }
    }
}
