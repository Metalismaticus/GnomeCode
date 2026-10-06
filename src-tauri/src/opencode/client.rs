//! HTTP и SSE к OpenCode server: единственное место, где живёт формат событий движка (ADR-0001).
//! Наружу отдаём строки ленты (`FeedEvent`) — интерфейс знает строки, а не события OpenCode.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Имя пользователя Basic-авторизации `opencode serve`: другое имя отдаёт 401.
pub const USER: &str = "opencode";
const CONNECT_SECONDS: u64 = 5;
/// Поток ждёт следующую строку, но не дольше: иначе команда «отправить» не доедет.
pub const READ_TIMEOUT: Duration = Duration::from_millis(250);
const BODY_LIMIT: usize = 4 * 1024 * 1024;
/// Размер заголовка чанка сверху: настоящий — пара байт, всё длиннее — не поток событий.
const CHUNK_HEADER_LIMIT: usize = 64;
/// Ключи, из которых короткое имя действия для строки инструмента.
const SUMMARY_KEYS: [&str; 6] = [
    "filePath",
    "path",
    "command",
    "pattern",
    "query",
    "description",
];
const SUMMARY_CHARS: usize = 60;
/// Строка ленты по завершении работы модели.
pub const NOTICE_DONE: &str = "Ответ модели получен";

#[derive(Clone, Debug)]
pub struct Endpoint {
    pub host: String,
    pub port: u16,
    pub password: String,
}

impl Endpoint {
    pub fn local(port: u16, password: String) -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port,
            password,
        }
    }

    /// Ответ сервера: код и тело (обычное или чанковое — поток событий идёт чанками).
    fn send(
        &self,
        method: &str,
        path: &str,
        body: Option<&Value>,
        keep_alive: bool,
    ) -> Result<Reply, String> {
        let payload = body.map(Value::to_string).unwrap_or_default();
        let request = format!(
            "{method} {path} HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {}\r\nAccept: application/json\r\n\
             Content-Type: application/json\r\nContent-Length: {}\r\nConnection: {}\r\n\r\n{payload}",
            self.host,
            self.port,
            basic(&self.password),
            payload.len(),
            if keep_alive { "keep-alive" } else { "close" }
        );
        let mut socket = self.connect()?;
        socket
            .write_all(request.as_bytes())
            .map_err(|e| format!("не отправил запрос: {e}"))?;
        socket
            .flush()
            .map_err(|e| format!("не отправил запрос: {e}"))?;
        Reply::read(socket)
    }

    fn connect(&self) -> Result<TcpStream, String> {
        let address = format!("{}:{}", self.host, self.port)
            .to_socket_addrs()
            .map_err(|e| format!("не знаю адрес {}:{} — {e}", self.host, self.port))?
            .next()
            .ok_or_else(|| format!("не знаю адрес {}:{}", self.host, self.port))?;
        TcpStream::connect_timeout(&address, Duration::from_secs(CONNECT_SECONDS))
            .map_err(|e| format!("сервер не ответил на {}:{} — {e}", self.host, self.port))
    }

    /// Тело запроса: сервер кладёт ответ в `data`, без обёртки — отдаём как есть.
    /// пустой ответ (204 у POST команды) — тоже успех: `Ok(Null)`.
    fn call(&self, method: &str, path: &str, body: Option<&Value>) -> Result<Value, String> {
        let mut reply = self.send(method, path, body, false)?;
        if reply.status == 401 {
            return Err("401 — пароль не тот: сервер не пустил GnomeCode".to_string());
        }
        let text = String::from_utf8_lossy(&reply.body.bytes(BODY_LIMIT)?).to_string();
        if text.trim().is_empty() {
            return Ok(Value::Null);
        }
        let value: Value =
            serde_json::from_str(&text).map_err(|e| format!("ответ сервера не JSON: {e}"))?;
        Ok(value.get("data").cloned().unwrap_or(value))
    }
}

impl Reply {
    fn read(socket: TcpStream) -> Result<Reply, String> {
        let mut reader = BufReader::new(
            socket
                .try_clone()
                .map_err(|e| format!("не взял сокет: {e}"))?,
        );
        let mut status_line = String::new();
        read_line(&mut reader, &mut status_line)?;
        let status = status_line
            .split_whitespace()
            .nth(1)
            .and_then(|code| code.parse::<u16>().ok())
            .ok_or_else(|| format!("сервер не ответил кодом: {}", status_line.trim()))?;
        let mut chunked = false;
        let mut length: Option<u64> = None;
        loop {
            let mut line = String::new();
            if read_line(&mut reader, &mut line)? == 0 {
                break;
            }
            let header = line.to_ascii_lowercase();
            if header.starts_with("transfer-encoding:") && header.contains("chunked") {
                chunked = true;
            }
            if let Some(value) = header.strip_prefix("content-length:") {
                length = value.trim().parse::<u64>().ok();
            }
            if header.trim().is_empty() {
                break;
            }
        }
        Ok(Reply {
            status,
            body: Body {
                reader,
                chunked,
                left: 0,
                after_chunk: false,
                identity: length,
                pending: Vec::new(),
            },
        })
    }
}

struct Reply {
    status: u16,
    body: Body,
}

/// Тело ответа построчно: и `Content-Length`, и чанки — поток событий сервер шлёт чанками.
struct Body {
    reader: BufReader<TcpStream>,
    chunked: bool,
    /// Байт в текущем чанке; вне чанков не используется.
    left: u64,
    /// Между чанками лежит CRLF — его надо пропустить, иначе размер следующего не прочитается.
    after_chunk: bool,
    /// Сколько байт обещано в Content-Length: без этого ждём конца соединения.
    identity: Option<u64>,
    /// Непрочитанный хвост строки: таймаут не должен съедать половину кадра.
    pending: Vec<u8>,
}

impl Body {
    /// Следующая строка тела: тишина, строка или конец потока — три разных состояния,
    /// иначе переподключение случалось бы каждые 250 мс на живом потоке.
    fn line(&mut self) -> Result<Line, String> {
        if self.pending.iter().any(|byte| *byte == b'\n') {
            return Ok(Line::Text(self.take_line()));
        }
        if !self.chunked {
            let mut raw = String::new();
            let read = read_line(&mut self.reader, &mut raw)?;
            if read == 0 {
                return Ok(if self.pending.is_empty() {
                    Line::Closed
                } else {
                    Line::Idle
                });
            }
            if let Some(left) = self.identity.as_mut() {
                *left = left.saturating_sub(read as u64);
            }
            return Ok(Line::Text(raw.trim_end().to_string()));
        }
        // Байты, а не символы: русский текст в кадре многобайтовый, посимвольное чтение его рвёт.
        loop {
            if self.left == 0 && !self.chunk_header()? {
                return Ok(if self.pending.is_empty() {
                    Line::Closed
                } else {
                    Line::Idle
                });
            }
            let mut one = [0u8; 1];
            match self.reader.read(&mut one) {
                Ok(1) => {}
                Ok(_) => {
                    return Ok(if self.pending.is_empty() {
                        Line::Closed
                    } else {
                        Line::Idle
                    })
                }
                Err(e) if idle(&e) => return Ok(Line::Idle),
                Err(e) => return Err(format!("поток событий оборвался: {e}")),
            }
            self.left = self.left.saturating_sub(1);
            self.after_chunk = self.left == 0;
            self.pending.push(one[0]);
            if one[0] == b'\n' {
                return Ok(Line::Text(self.take_line()));
            }
        }
    }

    /// Отдать накопленную строку: байты до конца строки включительно.
    fn take_line(&mut self) -> String {
        let end = self
            .pending
            .iter()
            .position(|byte| *byte == b'\n')
            .unwrap_or(self.pending.len() - 1);
        let line: Vec<u8> = self.pending.drain(..=end).collect();
        String::from_utf8_lossy(&line).trim_end().to_string()
    }

    fn bytes(&mut self, limit: usize) -> Result<Vec<u8>, String> {
        let mut out = std::mem::take(&mut self.pending);
        while let Line::Text(line) = self.line()? {
            out.extend_from_slice(line.as_bytes());
            if out.len() > limit {
                return Err(format!("ответ больше {limit} байт — читать нечего"));
            }
        }
        Ok(out)
    }

    /// Заголовок чанка: `false` — тело кончилось.
    ///
    /// Читается побайтово, как тело кадра: `BufReader::read_line` при таймауте теряет
    /// уже прочитанный хвост строки, и поток с этого места рассинхронизируется —
    /// на живом сервере это выглядит как обрыв соединения.
    fn chunk_header(&mut self) -> Result<bool, String> {
        if self.after_chunk {
            self.after_chunk = false;
            self.skip_crlf()?;
        }
        let mut raw: Vec<u8> = Vec::new();
        loop {
            if raw.len() > CHUNK_HEADER_LIMIT {
                return Err(format!(
                    "заголовок чанка длиннее {CHUNK_HEADER_LIMIT} байт — это не поток"
                ));
            }
            let mut one = [0u8; 1];
            match self.reader.read(&mut one) {
                Ok(1) => {}
                Ok(_) => return Ok(false),
                Err(e) if idle(&e) => return Ok(true),
                Err(e) => return Err(format!("поток событий оборвался: {e}")),
            }
            if one[0] == b'\n' {
                break;
            }
            raw.push(one[0]);
        }
        let text = String::from_utf8_lossy(&raw);
        let size_text = text.trim().split(';').next().unwrap_or("").trim();
        if size_text.is_empty() {
            return Ok(true);
        }
        self.left = u64::from_str_radix(size_text, 16)
            .map_err(|e| format!("не понял размер чанка «{size_text}»: {e}"))?;
        Ok(self.left > 0)
    }

    /// CRLF между чанками, побайтово: `read_exact` рвётся таймаутом и теряет байт.
    fn skip_crlf(&mut self) -> Result<(), String> {
        let mut one = [0u8; 1];
        loop {
            match self.reader.read(&mut one) {
                Ok(1) if one[0] == b'\n' => return Ok(()),
                Ok(1) => {}
                Ok(_) => return Ok(()),
                Err(e) if idle(&e) => return Ok(()),
                Err(e) => return Err(format!("поток событий оборвался: {e}")),
            }
        }
    }
}

enum Line {
    Idle,
    Text(String),
    Closed,
}

/// Таймаут чтения потока — это «пока тишина», а не поломка.
fn idle(error: &std::io::Error) -> bool {
    matches!(
        error.kind(),
        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
    )
}

fn read_line<R: BufRead>(reader: &mut R, out: &mut String) -> Result<usize, String> {
    let mut raw = Vec::new();
    let read = reader
        .read_until(b'\n', &mut raw)
        .map_err(|e| format!("чтение ответа оборвалось: {e}"))?;
    out.push_str(&String::from_utf8_lossy(&raw));
    Ok(read)
}

/// Поток событий `/api/event`: сервер держит соединение и шлёт кадры SSE.
pub struct EventStream {
    body: Body,
}

impl EventStream {
    pub fn connect(endpoint: &Endpoint) -> Result<EventStream, String> {
        let request = format!(
            "GET /api/event HTTP/1.1\r\nHost: {}:{}\r\nAuthorization: Basic {}\r\nAccept: text/event-stream\r\n\
             Connection: keep-alive\r\n\r\n",
            endpoint.host,
            endpoint.port,
            basic(&endpoint.password)
        );
        let mut socket = endpoint.connect()?;
        socket
            .set_read_timeout(Some(READ_TIMEOUT))
            .map_err(|e| format!("не задал таймаут чтения: {e}"))?;
        socket
            .write_all(request.as_bytes())
            .map_err(|e| format!("не отправил запрос потока: {e}"))?;
        let reply = Reply::read(socket)?;
        if reply.status == 401 {
            return Err("401 — пароль не тот: сервер не пустил GnomeCode".to_string());
        }
        Ok(EventStream { body: reply.body })
    }

    /// Шаг чтения потока: тишина (ждём следующий), событие или конец соединения.
    pub fn step(&mut self) -> Result<Step, String> {
        loop {
            let trimmed = match self.body.line()? {
                Line::Idle => return Ok(Step::Idle),
                Line::Closed => return Ok(Step::Closed),
                Line::Text(line) => line.trim().to_string(),
            };
            // heartbeat приходит строкой «: heartbeat», а данные — «data: {...}».
            if trimmed.is_empty() || trimmed.starts_with(':') || !trimmed.starts_with("data:") {
                continue;
            }
            let payload = trimmed.trim_start_matches("data:").trim();
            if payload.is_empty() {
                continue;
            }
            return Ok(Step::Event(ServerEvent::parse(payload)));
        }
    }
}

/// Шаг чтения потока событий.
#[derive(Debug)]
pub enum Step {
    Idle,
    Event(ServerEvent),
    Closed,
}

/// События движка, важные ленте. Формат OpenCode — `{"type": …, "data": {…}}`,
/// поэтому тело у каждого варианта своё: это union, а не «any» (ADR-0001).
/// Остальное разбирается в [`ServerEvent::Other`]: формат движка меняется, лента — нет.
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type")]
pub enum ServerEvent {
    #[serde(rename = "session.step.started")]
    StepStarted { data: StepStarted },
    #[serde(rename = "session.text.started")]
    TextStarted { data: StepStarted },
    #[serde(rename = "session.text.delta")]
    TextDelta { data: TextDelta },
    #[serde(rename = "session.text.ended")]
    TextEnded { data: TextEnded },
    #[serde(rename = "session.tool.input.started")]
    ToolInputStarted { data: ToolStarted },
    #[serde(rename = "session.tool.input.ended")]
    ToolInputEnded { data: ToolInput },
    #[serde(rename = "session.tool.called")]
    ToolCalled { data: ToolCalled },
    #[serde(rename = "session.tool.success")]
    ToolSuccess { data: ToolRef },
    #[serde(rename = "session.tool.failed")]
    ToolFailed { data: ToolFailed },
    #[serde(rename = "session.execution.succeeded")]
    ExecutionSucceeded { data: Execution },
    #[serde(rename = "session.execution.failed")]
    ExecutionFailed { data: ExecutionFailed },
    /// Сессия создана: лента начинает ждать её события, сама строка не нужна.
    #[serde(rename = "session.created")]
    SessionCreated { data: SessionRef },
    /// Служебное событие движка: ленте ничего не даёт, но разбираться в тип, а не в Other —
    /// иначе проверка «фикстура разобралась» проверяла бы заглушку.
    #[serde(rename = "server.connected")]
    ServerConnected,
    #[serde(other, rename = "other")]
    Other,
}

/// Общее начало тела события: сессия и сообщение ассистента.
#[derive(Debug, Clone, Deserialize)]
pub struct StepStarted {
    #[serde(rename = "sessionID")]
    pub session: String,
    #[serde(rename = "assistantMessageID")]
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextDelta {
    #[serde(rename = "sessionID")]
    pub session: String,
    #[serde(rename = "assistantMessageID")]
    pub message: String,
    pub delta: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TextEnded {
    #[serde(rename = "sessionID")]
    pub session: String,
    #[serde(rename = "assistantMessageID")]
    pub message: String,
    pub text: String,
}

/// Вызов инструмента: сессия и идентификатор вызова — на все его состояния.
#[derive(Debug, Clone, Deserialize)]
pub struct ToolRef {
    #[serde(rename = "sessionID")]
    pub session: String,
    pub id: String,
}

/// Сессия как событие: только идентификатор — остальное ленте не нужно.
#[derive(Debug, Clone, Deserialize)]
pub struct SessionRef {
    #[serde(rename = "sessionID")]
    pub session: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolStarted {
    #[serde(rename = "sessionID")]
    pub session: String,
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolInput {
    #[serde(rename = "sessionID")]
    pub session: String,
    pub id: String,
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolCalled {
    #[serde(rename = "sessionID")]
    pub session: String,
    pub id: String,
    pub input: Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolFailed {
    #[serde(rename = "sessionID")]
    pub session: String,
    pub id: String,
    pub error: ToolError,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Execution {
    #[serde(rename = "sessionID")]
    pub session: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ExecutionFailed {
    #[serde(rename = "sessionID")]
    pub session: String,
    pub error: ToolError,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolError {
    #[serde(default)]
    pub message: String,
}

impl ServerEvent {
    /// Событие незнакомой версии движка не должно рвать ленту — это Other, а не ошибка.
    pub fn parse(payload: &str) -> ServerEvent {
        serde_json::from_str(payload).unwrap_or(ServerEvent::Other)
    }

    /// Сессия события: события чужих сессий в ленте не показываем.
    pub fn session(&self) -> Option<&str> {
        match self {
            ServerEvent::StepStarted { data } | ServerEvent::TextStarted { data } => {
                Some(&data.session)
            }
            ServerEvent::TextDelta { data } => Some(&data.session),
            ServerEvent::TextEnded { data } => Some(&data.session),
            ServerEvent::ToolInputStarted { data } => Some(&data.session),
            ServerEvent::ToolInputEnded { data } => Some(&data.session),
            ServerEvent::ToolCalled { data } => Some(&data.session),
            ServerEvent::ToolSuccess { data } => Some(&data.session),
            ServerEvent::ToolFailed { data } => Some(&data.session),
            ServerEvent::ExecutionSucceeded { data } => Some(&data.session),
            ServerEvent::ExecutionFailed { data } => Some(&data.session),
            ServerEvent::SessionCreated { data } => Some(&data.session),
            ServerEvent::ServerConnected | ServerEvent::Other => None,
        }
    }
}

/// Строка ленты: что интерфейс показывает и что уже накоплено.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum FeedEvent {
    Row {
        id: String,
        kind: RowKind,
        text: String,
        /// Плагин, чьим вызовом родилась строка: клик по ней открывает детали
        /// (сцена J). У строк движка, ленты и лента-уведомлений его нет — деталей
        /// без известного плагина не показывать (не фейкать).
        #[serde(skip_serializing_if = "Option::is_none")]
        plugin: Option<String>,
        /// Файлы вопроса: источник ответа (phase2.md, 9.1) — блок «Sources used»
        /// открывает их по клику; у строк не-вопросов его нет.
        #[serde(skip_serializing_if = "Option::is_none")]
        files: Option<Vec<String>>,
        /// Файл, который вызов инструмента читал (ключ `filePath`/`path` входа):
        /// источник у строки `✓`; у запусков, отказов и чужих вызовов его нет.
        #[serde(skip_serializing_if = "Option::is_none")]
        file: Option<String>,
    },
    Append {
        id: String,
        delta: String,
    },
    /// Новый чат: лента чистится целиком, следующие строки — нового чата.
    /// Приходит до подъёма новой сессии: интерфейс не должен увидеть строки
    /// прошлого чата после чистки.
    Reset,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum RowKind {
    User,
    Assistant,
    Tool,
    Notice,
}

impl FeedEvent {
    pub fn notice(id: &str, text: &str) -> FeedEvent {
        FeedEvent::Row {
            id: id.to_string(),
            kind: RowKind::Notice,
            text: text.to_string(),
            plugin: None,
            files: None,
            file: None,
        }
    }
}

/// События движка → строки ленты. Здесь держится и накопленный текст, чтобы
/// `text.delta` дописывал, а `text.ended` не дублировал уже показанное.
#[derive(Default)]
pub struct Feed {
    texts: HashMap<String, String>,
    /// Вызовы инструментов по id: строка не должна менять имя или терять действие
    /// на событиях, где их уже нет.
    tools: HashMap<String, ToolRow>,
}

/// Что лента уже показала про вызов инструмента.
struct ToolRow {
    name: String,
    detail: String,
    /// Файл входа вызова, если инструмент его назвал: живёт до конца вызова.
    file: Option<String>,
    /// Последняя отданная строка: повтор той же строки ленте не нужен.
    line: String,
}

impl Default for ToolRow {
    fn default() -> Self {
        ToolRow {
            name: UNKNOWN_TOOL.to_string(),
            detail: String::new(),
            file: None,
            line: String::new(),
        }
    }
}

impl Feed {
    /// Строки ленты по событию движка; события не нашей сессии и незнакомые дают пусто.
    pub fn apply(&mut self, event: &ServerEvent, session: &str) -> Vec<FeedEvent> {
        if event.session().is_some_and(|id| id != session) {
            return Vec::new();
        }
        match event {
            ServerEvent::StepStarted { data } | ServerEvent::TextStarted { data } => {
                self.answer(&data.message)
            }
            ServerEvent::TextDelta { data } => {
                self.texts
                    .entry(data.message.clone())
                    .or_default()
                    .push_str(&data.delta);
                vec![FeedEvent::Append {
                    id: data.message.clone(),
                    delta: data.delta.clone(),
                }]
            }
            ServerEvent::TextEnded { data } => {
                self.texts.insert(data.message.clone(), data.text.clone());
                vec![FeedEvent::Row {
                    id: data.message.clone(),
                    kind: RowKind::Assistant,
                    text: data.text.clone(),
                    plugin: None,
                    files: None,
                    file: None,
                }]
            }
            ServerEvent::ToolInputStarted { data } => {
                self.tool(&data.id, &data.name, ToolState::Started, "", None)
            }
            ServerEvent::ToolInputEnded { data } => {
                let detail = summarize(&data.text);
                let file = file_of_str(&data.text);
                self.tool(&data.id, "", ToolState::Input, &detail, file)
            }
            ServerEvent::ToolCalled { data } => {
                let detail = summarize(&data.input.to_string());
                let file = file_of(&data.input);
                self.tool(&data.id, "", ToolState::Running, &detail, file)
            }
            ServerEvent::ToolSuccess { data } => self.tool(&data.id, "", ToolState::Done, "", None),
            ServerEvent::ToolFailed { data } => {
                self.tool(&data.id, "", ToolState::Failed, &data.error.message, None)
            }
            ServerEvent::ExecutionSucceeded { .. } => {
                vec![FeedEvent::notice("engine", NOTICE_DONE)]
            }
            ServerEvent::ExecutionFailed { data } => vec![FeedEvent::notice(
                "engine",
                &format!("Модель ответила ошибкой: {}", data.error.message),
            )],
            ServerEvent::Other
            | ServerEvent::ServerConnected
            | ServerEvent::SessionCreated { .. } => Vec::new(),
        }
    }

    /// Строка ответа появляется один раз на сообщение ассистента.
    fn answer(&mut self, message: &str) -> Vec<FeedEvent> {
        if self.texts.contains_key(message) {
            return Vec::new();
        }
        self.texts.insert(message.to_string(), String::new());
        vec![FeedEvent::Row {
            id: message.to_string(),
            kind: RowKind::Assistant,
            text: String::new(),
            plugin: None,
            files: None,
            file: None,
        }]
    }

    fn tool(
        &mut self,
        id: &str,
        name: &str,
        state: ToolState,
        detail: &str,
        file: Option<String>,
    ) -> Vec<FeedEvent> {
        let known = self.tools.remove(id).unwrap_or_default();
        let name = if name.is_empty() {
            known.name
        } else {
            name.to_string()
        };
        // Деталь не стирается: `tool.success` приходит без входа, а владельцу по строке
        // «✓ read · src/bridge.ts» видно, какой файл агент читал.
        let detail = if detail.is_empty() {
            known.detail
        } else {
            detail.to_string()
        };
        // Файл тоже не стирается: он приходит с входом вызова, а живёт до конца —
        // по нему блок источников открывает файл после строки «✓».
        let file = file.or(known.file);
        let text = tool_line(&name, state, &detail);
        let same = text == known.line;
        self.tools.insert(
            id.to_string(),
            ToolRow {
                name: name.clone(),
                detail,
                file: file.clone(),
                line: text.clone(),
            },
        );
        if same {
            return Vec::new();
        }
        // Источник — исполненный вызов: файл идёт только со строкой «✓», запуску
        // («⧗») и отказу («✗») названный файл не источник.
        let shown = if state == ToolState::Done { file } else { None };
        vec![FeedEvent::Row {
            id: id.to_string(),
            kind: RowKind::Tool,
            text,
            // Имя плагина известен ленте позже (команда плагина), а вызовы
            // инструмента движка — не плагины: деталей у них нет.
            plugin: None,
            files: None,
            file: shown,
        }]
    }
}

/// Состояние вызова инструмента: пока идёт — видно, что началось, и с чем.
#[derive(Debug, Clone, Copy, PartialEq)]
enum ToolState {
    Started,
    Input,
    Running,
    Done,
    Failed,
}

/// Строка вызова инструмента: `✓ read · docs/BATCH.md` — по ней владелец видит, что делал агент.
fn tool_line(name: &str, state: ToolState, detail: &str) -> String {
    let mark = match state {
        ToolState::Started => "⧗",
        ToolState::Input | ToolState::Running => "⋯",
        ToolState::Done => "✓",
        ToolState::Failed => "✗",
    };
    match detail.trim() {
        "" => format!("{mark} {name}"),
        detail => format!("{mark} {name} · {detail}"),
    }
}

/// Строка запуска команды плагина: `⧗ docs · search` — дальше отвечает движок
/// (docs/SPEC/plugins.md, сцена J).
pub fn command_started(plugin: &str, label: &str) -> String {
    format!("⧗ {plugin} · {label}")
}

/// Отказ в ленте: почему вызов не пошёл. «denied» даёт только правило — denied-
/// категории не спрашиваются никогда; отказ владельца в окне — «requires approval».
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Refusal {
    /// Владелец отказал в окне одобрения.
    Approval,
    /// Запрещено правилом категории (rules.json).
    Rule,
}

impl Refusal {
    /// Хвост строки отказа: одно место на оба вида отказа.
    pub fn tail(self) -> &'static str {
        match self {
            Refusal::Approval => " requires approval",
            Refusal::Rule => " denied",
        }
    }
}

/// Строка отказа слоя прав: `⚠ docs · search requires approval` или
/// `⚠ git · commit denied` — вызов не идёт (docs/SPEC/plugins.md,
/// «Утверждённый UX одобрения»).
pub fn command_refused(plugin: &str, label: &str, why: Refusal) -> String {
    format!("⚠ {plugin} · {label}{}", why.tail())
}

/// Имя, когда движок не назвал инструмент: лучше «инструмент», чем пустая строка в ленте.
const UNKNOWN_TOOL: &str = "инструмент";

/// Файл из входа инструмента — источник ответа (phase2.md, 9.1): ключи `filePath`
/// и `path`, те же, что дают короткое имя действия. Ключей нет — вызов файла не касался.
fn file_of(input: &Value) -> Option<String> {
    ["filePath", "path"]
        .iter()
        .find_map(|key| input.get(*key).and_then(Value::as_str))
        .map(str::to_string)
}

/// То же по строке входа (`tool.input.ended` несёт вход текстом JSON).
fn file_of_str(input: &str) -> Option<String> {
    serde_json::from_str::<Value>(input).ok().and_then(|value| file_of(&value))
}

/// Короткое «действие» из входа инструмента: путь файла, команда, запрос.
pub fn summarize(input: &str) -> String {
    let value: Value = serde_json::from_str(input).unwrap_or(Value::Null);
    let picked = SUMMARY_KEYS
        .iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str))
        .map(str::to_string)
        .or_else(|| match &value {
            Value::String(text) => Some(text.clone()),
            Value::Null => None,
            other => Some(other.to_string()),
        })
        .unwrap_or_default();
    let one_line = picked.replace(['\n', '\r'], " ");
    if one_line.chars().count() <= SUMMARY_CHARS {
        one_line
    } else {
        let cut: String = one_line.chars().take(SUMMARY_CHARS).collect();
        format!("{cut}…")
    }
}

fn basic(password: &str) -> String {
    base64(format!("{USER}:{password}").as_bytes())
}

/// base64 из таблицы: крейт ради трёх строк не заводим.
fn base64(input: &[u8]) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for part in input.chunks(3) {
        let triple = [
            part[0],
            *part.get(1).unwrap_or(&0),
            *part.get(2).unwrap_or(&0),
        ];
        let packed =
            (u32::from(triple[0]) << 16) | (u32::from(triple[1]) << 8) | u32::from(triple[2]);
        for index in 0..=3 {
            if index <= part.len() {
                out.push(TABLE[((packed >> (18 - 6 * index)) & 0x3f) as usize] as char);
            } else {
                out.push('=');
            }
        }
    }
    out
}

/// Тело запроса к серверу: сессия и отправка текста.
pub struct Api<'a> {
    pub(crate) endpoint: &'a Endpoint,
}

impl<'a> Api<'a> {
    pub fn new(endpoint: &'a Endpoint) -> Api<'a> {
        Api { endpoint }
    }

    /// Новая сессия: `POST /api/session` → идентификатор.
    pub fn create_session(&self, title: &str) -> Result<String, String> {
        let value = self
            .endpoint
            .call("POST", "/api/session", Some(&json!({ "title": title })))?;
        value
            .get("id")
            .and_then(Value::as_str)
            .map(str::to_string)
            .ok_or_else(|| "сервер создал сессию без идентификатора".to_string())
    }

    /// Сырой ответ списка сессий движка: `GET /api/session`. Форму элемента
    /// разбирает `session.rs` (ADR-0001: тип крейта, не строки чужого JSON).
    pub(crate) fn sessions_raw(&self) -> Result<Value, String> {
        self.endpoint.call("GET", "/api/session", None)
    }

    /// Отправить текст в сессию: ответ придёт событиями, не телом запроса.
    /// `model` — модель, выбранная в панели «Сравнение моделей»; нет — модель
    /// движка по умолчанию, как раньше (замер 2026-10-06: движок принимает
    /// `model` рядом с текстом и без него).
    pub fn prompt(&self, session: &str, text: &str, model: Option<&Value>) -> Result<(), String> {
        let path = format!("/api/session/{session}/prompt");
        let mut body = json!({ "text": text });
        if let Some(model) = model {
            body["model"] = model.clone();
        }
        self.endpoint
            .call("POST", &path, Some(&body))
            .map(|_| ())
    }

    /// Команда плагина, одобренная слоем прав: `POST /api/session/{id}/command`.
    /// Тело обязано нести оба ключа (`text` пуст без входа — замер 2026-10-05),
    /// ответ 204 пустой телом.
    pub fn command(&self, session: &str, name: &str) -> Result<(), String> {
        let path = format!("/api/session/{session}/command");
        self.endpoint
            .call("POST", &path, Some(&json!({ "name": name, "text": "" })))
            .map(|_| ())
    }

    /// Готов ли сервер: `GET /api/config` с Basic-авторизацией.
    pub fn ready(&self) -> Result<(), String> {
        self.endpoint.call("GET", "/api/config", None).map(|_| ())
    }

    /// Установленные плагины проекта: `GET /api/plugin`. Форму разбирает
    /// `plugins::catalog` — здесь только список строк ответа.
    pub fn plugins(&self) -> Result<Vec<Value>, String> {
        self.endpoint.call("GET", "/api/plugin", None).and_then(items)
    }

    /// Команды чата: `GET /api/command` — из них кнопки шапки берут команды плагинов.
    pub fn commands(&self) -> Result<Vec<Value>, String> {
        self.endpoint.call("GET", "/api/command", None).and_then(items)
    }

    /// Провайдеры и их модели: `GET /api/provider` — по ним панель сравнения
    /// знает, какие модели доступны у подключённых провайдеров. Форму элемента
    /// разбирает `compare::with_engine_providers`.
    pub fn providers(&self) -> Result<Value, String> {
        self.endpoint.call("GET", "/api/provider", None)
    }
}

/// Данные ответа движка — список. Форма элемента остаётся на стороне Rust
/// (ADR-0001): наружу уходят наши типы, а не строки чужого JSON.
fn items(value: Value) -> Result<Vec<Value>, String> {
    match value {
        Value::Array(list) => Ok(list),
        _ => Err("сервер вернул не список".to_string()),
    }
}
