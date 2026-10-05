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
pub mod session;

use std::sync::mpsc::{Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
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
    /// `shown` — строка вопроса в ленте (владелец должен видеть, что отправляет),
    /// `prompt` — текст движку, с приложенными файлами.
    Prompt { shown: String, prompt: String },
    /// Команда плагина, одобренная слоем прав: строка запуска в ленте, POST — движку.
    Command {
        plugin: String,
        label: String,
        command: String,
    },
    /// Владелец отказал в одобрении: строка отказа в ленте, движку нечего
    /// отправлять (docs/SPEC/plugins.md, «Утверждённый UX одобрения»).
    Refused { plugin: String, label: String },
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

/// Занять сессию ленты: сохранённая прошлого запуска приложения, если она
/// жива в списке движка («Один полный цикл»), иначе — новая, запомненная в state.json.
pub struct Chat {
    tx: Sender<Cmd>,
    /// Адрес движка для команд, которым нужен сервер, а не лента (список плагинов).
    /// Ведёт его поток ленты: после подъёма и перезапуска адрес один и тот же.
    endpoint: Arc<Mutex<Option<client::Endpoint>>>,
}

impl Chat {
    /// Поднять движок и начать ленту — то, что делает приложение при старте.
    /// Хранилище даёт путь к возвращению к чату прошлого запуска, его ведёт поток ленты.
    pub fn start(store: Arc<crate::state::Store>, sink: Arc<dyn Sink>) -> Chat {
        match Engine::start() {
            Ok(engine) => Chat::with_saved(Box::new(engine), sink, Some(store)),
            Err(reason) => {
                // Движка нет — приложение всё равно должно открыться и сказать об этом в ленте.
                sink.emit(FeedEvent::notice(
                    "engine",
                    &format!("{NOTICE_NO_ENGINE}: {reason}"),
                ));
                let (tx, rx) = std::sync::mpsc::channel();
                thread::spawn(move || supervise_missing(rx, sink));
                Chat {
                    tx,
                    endpoint: Arc::new(Mutex::new(None)),
                }
            }
        }
    }

    // Лента на своём движке с хранилищем: чат, который вела прошлая жизнь окна,
    // возвращается по сохранённому идентификатору (session::acquire).
    pub fn with_saved(
        engine: Box<dyn EngineLife>,
        sink: Arc<dyn Sink>,
        store: Option<Arc<crate::state::Store>>,
    ) -> Chat {
        let (tx, rx) = std::sync::mpsc::channel();
        let endpoint = Arc::new(Mutex::new(Some(engine.endpoint())));
        let known = Arc::clone(&endpoint);
        // Сохранённая сессия читается при старте окна: у потока ленты она одна.
        let saved = store
            .as_ref()
            .map(|store| store.load())
            .and_then(|state| state.session);
        thread::spawn(move || supervise(engine, rx, sink, known, saved, store));
        Chat { tx, endpoint }
    }

    /// Лента на своём движке: тот же путь, что у приложения, но движок подставляет
    /// вызывающий — так проверка стережёт обрыв потока, не поднимая настоящий opencode.
    /// Хранилища у проверок нет: запоминать сессии некому.
    pub fn with_engine(engine: Box<dyn EngineLife>, sink: Arc<dyn Sink>) -> Chat {
        Chat::with_saved(engine, sink, None)
    }

    /// Адрес движка, пока он поднят: команды окна, которым нужен сервер, идут через него.
    pub fn endpoint(&self) -> Option<client::Endpoint> {
        self.endpoint.lock().ok().and_then(|held| held.clone())
    }

    /// Отправить текст в сессию: команда уходит в поток ленты, а не блокирует интерфейс.
    pub fn send(&self, shown: &str, prompt: &str) -> Result<(), String> {
        let prompt = prompt.trim();
        if prompt.is_empty() {
            return Err("пустое сообщение отправлять нечем".to_string());
        }
        self.tx
            .send(Cmd::Prompt {
                shown: shown.trim().to_string(),
                prompt: prompt.to_string(),
            })
            .map_err(|_| "лента закрыта: перезапустите приложение".to_string())
    }

    /// Одобренная команда плагина: строка запуска идёт в ленту, POST — движку.
    pub fn command(&self, plugin: &str, label: &str, command: &str) -> Result<(), String> {
        self.tx
            .send(Cmd::Command {
                plugin: plugin.to_string(),
                label: label.to_string(),
                command: command.to_string(),
            })
            .map_err(|_| "лента закрыта: перезапустите приложение".to_string())
    }

    /// Отказ владельца: строка `⚠ … requires approval` в ленте, вызов не идёт.
    pub fn refused(&self, plugin: &str, label: &str) -> Result<(), String> {
        self.tx
            .send(Cmd::Refused {
                plugin: plugin.to_string(),
                label: label.to_string(),
            })
            .map_err(|_| "лента закрыта: перезапустите приложение".to_string())
    }
}

impl Drop for Chat {
    fn drop(&mut self) {
        let _ = self.tx.send(Cmd::Stop);
    }
}

/// Поток ленты: сессия, поток событий, команды пользователя и перезапуск движка.
/// `saved` — сессия прошлого запуска приложения: жива ли она, решит список движка,
/// а не память моста.
fn supervise(
    mut engine: Box<dyn EngineLife>,
    rx: Receiver<Cmd>,
    sink: Arc<dyn Sink>,
    known: Arc<Mutex<Option<client::Endpoint>>>,
    mut saved: Option<String>,
    store: Option<Arc<crate::state::Store>>,
) {
    let endpoint = engine.endpoint();
    if let Ok(mut held) = known.lock() {
        *held = Some(endpoint.clone());
    }
    let api = Api::new(&endpoint);
    let mut session: Option<String> = None;
    // Счётчик строк вопроса живёт дольше одного потока: обрыв и переподключение не
    // начинают нумерацию заново, иначе следующий вопрос получил бы id прошлой строки,
    // а foldFeed заменил бы её вместо новой — и вопрос владельца пропал бы из ленты.
    let mut sent = 0usize;
    // Строки команд плагинов ведёт тот же поток: два запуска — две строки, даже
    // если между ними был обрыв потока.
    let mut plugin_rows = 0usize;
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
        // Адрес после перезапуска тот же, но окно читает его отсюда: список плагинов
        // идёт к движку, а лента его не видит.
        if let Ok(mut held) = known.lock() {
            *held = Some(endpoint.clone());
        }
        let id = match session.clone() {
            Some(id) => id,
            None => match session::acquire(&api, saved.clone(), store.as_deref()) {
                Ok(id) => {
                    // Ответ получен: сохранённый чат подобран или заменён новым —
                    // прошлого списка больше не спрашиваем.
                    saved = None;
                    id
                }
                Err(reason) => {
                    sink.emit(FeedEvent::notice(
                        "engine",
                        &format!("Сессия не создана: сервер не ответил — {reason}"),
                    ));
                    thread::sleep(Duration::from_secs(RETRY_SECONDS));
                    continue;
                }
            },
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
        if pump(
            &mut stream,
            &id,
            &api,
            &rx,
            &sink,
            &mut feed,
            &mut sent,
            &mut plugin_rows,
        ) {
            return;
        }
        sink.emit(FeedEvent::notice("stream", NOTICE_RECONNECT));
    }
}

/// Движка нет на месте: лента живёт и повторяет попытку, окно не падает.
fn supervise_missing(rx: Receiver<Cmd>, sink: Arc<dyn Sink>) {
    // Строки отказов ведёт и этот поток: два отказа — две строки, как при живом движке.
    let mut refused = 0usize;
    loop {
        match rx.try_recv() {
            Ok(Cmd::Stop) => return,
            Ok(Cmd::Prompt { .. }) => sink.emit(FeedEvent::notice(
                "engine",
                &format!("{NOTICE_NO_ENGINE}: поставьте opencode CLI — сообщение не отправлено"),
            )),
            Ok(Cmd::Command { .. }) => sink.emit(FeedEvent::notice(
                "engine",
                &format!("{NOTICE_NO_ENGINE}: поставьте opencode CLI — команда плагина не отправлена"),
            )),
            // Отказ — решение владельца, оно правдиво и без движка: строка отказа
            // всё равно появляется, вызова нет.
            Ok(Cmd::Refused { plugin, label }) => {
                refused += 1;
                sink.emit(FeedEvent::Row {
                    id: format!("refused-{refused}"),
                    kind: client::RowKind::Tool,
                    text: client::command_refused(&plugin, &label),
                });
            }
            Err(TryRecvError::Disconnected) => return,
            Err(TryRecvError::Empty) => thread::sleep(Duration::from_secs(RETRY_SECONDS)),
        }
    }
}

/// Чтение потока до обрыва. `true` — лента закрыта по команде.
#[allow(clippy::too_many_arguments)]
fn pump(
    stream: &mut EventStream,
    session: &str,
    api: &Api,
    rx: &Receiver<Cmd>,
    sink: &Arc<dyn Sink>,
    feed: &mut Feed,
    // Счётчик строк вопроса владельца: переживает обрыв потока, его ведёт поток ленты.
    sent: &mut usize,
    // Строки одобренных команд плагинов: нумерация общая, id не переиспользуется.
    plugin_rows: &mut usize,
) -> bool {
    loop {
        while let Ok(cmd) = rx.try_recv() {
            match cmd {
                Cmd::Stop => return true,
                Cmd::Prompt { shown, prompt } => {
                    *sent += 1;
                    // Идентификатор строки вопроса не переиспользуется: два одинаковых
                    // вопроса — две строки, даже если между ними был обрыв потока.
                    sink.emit(FeedEvent::Row {
                        id: format!("user-{sent}"),
                        kind: client::RowKind::User,
                        text: shown,
                    });
                    if let Err(reason) = api.prompt(session, &prompt) {
                        sink.emit(FeedEvent::notice(
                            "engine",
                            &format!("Сообщение не ушло: {reason}"),
                        ));
                    }
                }
                Cmd::Command { plugin, label, command } => {
                    *plugin_rows += 1;
                    // Строка запуска видна сразу: движок отвечает событиями потока,
                    // а при молчании владелец всё равно знает, что команда ушла.
                    sink.emit(FeedEvent::Row {
                        id: format!("plugin-{plugin_rows}"),
                        kind: client::RowKind::Tool,
                        text: client::command_started(&plugin, &label),
                    });
                    if let Err(reason) = api.command(session, &command) {
                        sink.emit(FeedEvent::notice(
                            "engine",
                            &format!("Команда не ушла: {reason}"),
                        ));
                    }
                }
                Cmd::Refused { plugin, label } => {
                    *plugin_rows += 1;
                    sink.emit(FeedEvent::Row {
                        id: format!("plugin-{plugin_rows}"),
                        kind: client::RowKind::Tool,
                        text: client::command_refused(&plugin, &label),
                    });
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
