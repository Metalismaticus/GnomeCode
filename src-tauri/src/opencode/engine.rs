//! Поиск движка, запуск, пароль, контроль жизни и перезапуск с сообщением.
//!
//! Движок OpenCode — чужой процесс: мы его ищем, поднимаем на своём свободном порту
//! и перезапускаем, если он упал. Пользовательскими данными движок не трогаем:
//! приложение работает с базой opencode как есть, изоляция — только в проверках
//! (docs/TESTING.md, «Данные пользователя»).

use std::collections::VecDeque;
use std::io::BufRead;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use super::client::{Api, Endpoint};
use super::job::Job;

/// Две известные установки desktop-версии opencode: первая — ресурсы приложения,
/// вторая — папка версий CLI, номер версии меняется, поэтому ищем glob.
const KNOWN_PATHS: [&str; 2] = [
    r"%LOCALAPPDATA%\Programs\@opencodedesktop\resources\opencode-cli.exe",
    r"%APPDATA%\ai.opencode.desktop\cli\*\opencode-cli.exe",
];
const EXE_NAMES: [&str; 3] = ["opencode", "opencode-cli", "opencode.exe"];
const READY_SECONDS: u64 = 30;
const LOG_LINES: usize = 20;
/// Пароль держим столько, сколько живёт сервер: он нужен только для localhost.
const PASSWORD_HEX: usize = 32;

/// Папка данных процесса для конфига провайдеров: setup окна (lib.rs) приносит
/// её до подъёма ленты — поток `Chat::start` править нельзя (общий узел
/// opencode/). До установки — конфига нет, движок поднимается как раньше.
static CONFIG_FOLDER: std::sync::OnceLock<PathBuf>= std::sync::OnceLock::new();

/// Задать папку данных для конфига провайдеров: зовёт setup окна один раз.
pub fn set_config_folder(folder: PathBuf) {
    let _ = CONFIG_FOLDER.set(folder);
}

/// Что движку уходит при подъёме: конфиг провайдеров и переменные ключей.
/// Обе части читаются на каждом подъёме — тихий рестарт после сохранения
/// ключа несёт движку свежие (engine.rs, `spawn`).
#[derive(Debug, Clone, Default)]
pub struct Launch {
    /// Содержимое `OPENCODE_CONFIG_CONTENT`: endpoint'ы из providers.json.
    pub config: Option<String>,
    /// Переменные окружения с секретами ключей: движок активирует провайдера
    /// по переменной его ключа (models.dev `env`, замер 2026-10-11).
    pub env: Vec<(String, String)>,
}

/// Конфиг и переменные ключей из providers.json + каталога models.dev:
/// папка не задана или данных нет — пустой запуск, движок поднимается как раньше.
fn provider_launch() -> Launch {
    let Some(folder) = CONFIG_FOLDER.get().cloned() else {
        return Launch::default();
    };
    let held = crate::providers_store::at(&crate::providers_store::file(folder.clone()));
    // Каталог только из кэша: сеть на старте окна не зовём. Кэш собирает
    // фоновый поток setup (lib.rs) и «сохранить ключ» — до того переменных
    // нет, ключ доезжает до движка следующим рестартом.
    let catalog = crate::modelsdev::cached(&crate::modelsdev::file(folder));
    Launch {
        config: crate::providers_store::engine_config(crate::providers::SERVICE, &held),
        env: crate::providers_store::launch_env(&held, catalog.as_ref(), crate::providers::secret),
    }
}

/// Живой движок: дочерний процесс и всё, что о нём знает клиент.
pub struct Engine {
    exe: PathBuf,
    port: u16,
    password: String,
    child: Option<Child>,
    /// Job хозяина: ручка живёт у процесса приложения, её закрытие (в том числе
    /// жёстким убийством) убивает движок-ребёнка — сироты не остаётся.
    job: Job,
    log: Arc<Mutex<VecDeque<String>>>,
    /// Запуск на каждый подъём: конфиг и переменные окружения (ключи
    /// провайдеров) перечитываются в замыкании — рестарт несёт свежие.
    launch: Arc<dyn Fn() -> Launch + Send + Sync>,
}

impl Engine {
    /// Поднять движок: найти, занять свободный порт, задать пароль, дождаться `/api/config`.
    /// Конфиг провайдеров берётся из папки данных процесса ([`set_config_folder`]) —
    /// перечитывается на каждом подъёме, тихий рестарт несёт свежий.
    pub fn start() -> Result<Engine, String> {
        Engine::start_with_launch(Arc::new(provider_launch))
    }

    /// Поднять движок со своим конфигом провайдеров: замыкание зовётся на каждом
    /// подъёме (`spawn`), поэтому тихий рестарт после смены endpoint'ов несёт
    /// свежий конфиг (движок v2.0.25 читает `OPENCODE_CONFIG_CONTENT`).
    pub fn start_with_config(
        config: Arc<dyn Fn() -> Option<String> + Send + Sync>,
    ) -> Result<Engine, String> {
        Engine::start_with_launch(Arc::new(move || Launch {
            config: config(),
            env: Vec::new(),
        }))
    }

    /// Поднять движок со своим запуском: конфиг и переменные окружения — из
    /// замыкания, оно зовётся на каждом подъёме (рестарт несёт свежие значения).
    pub fn start_with_launch(
        launch: Arc<dyn Fn() -> Launch + Send + Sync>,
    ) -> Result<Engine, String> {
        let mut engine = Engine {
            exe: locate()?,
            port: free_port()?,
            password: make_password(),
            child: None,
            job: Job::new().map_err(|e| format!("не создал Job Object: {e}"))?,
            log: Arc::new(Mutex::new(VecDeque::new())),
            launch,
        };
        engine.spawn()?;
        engine.wait_ready()?;
        Ok(engine)
    }

    pub fn endpoint(&self) -> Endpoint {
        Endpoint::local(self.port, self.password.clone())
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Ещё жив ли процесс: `try_wait` не убивает и не ждёт.
    pub fn alive(&mut self) -> bool {
        match self.child.as_mut() {
            None => false,
            Some(child) => !matches!(child.try_wait(), Ok(Some(_)) | Err(_)),
        }
    }

    /// Поднять заново после падения: тот же порт, тот же пароль — адрес не меняется.
    pub fn restart(&mut self) -> Result<(), String> {
        self.stop();
        self.spawn()?;
        self.wait_ready()
    }

    pub fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    /// Последние строки вывода движка — попадают в сообщение ленты при ошибке.
    pub fn log_tail(&self) -> String {
        let log = self
            .log
            .lock()
            .map(|log| log.iter().cloned().collect::<Vec<_>>().join(" · "));
        log.unwrap_or_default()
    }

    fn spawn(&mut self) -> Result<(), String> {
        let mut command = Command::new(&self.exe);
        command
            .args([
                "serve",
                "--hostname",
                "127.0.0.1",
                "--port",
                &self.port.to_string(),
            ])
            .env("OPENCODE_SERVER_PASSWORD", &self.password)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(Stdio::null());
        // Конфиг провайдеров — переменной окружения, не файлом: ключ endpoint'а
        // не должен появиться на диске (providers_store::engine_config).
        let launch = (self.launch)();
        if let Some(config) = launch.config {
            command.env("OPENCODE_CONFIG_CONTENT", config);
        }
        // Ключи провайдеров — переменными их тихого доступа: движок активирует
        // провайдера по имени переменной (models.dev `env`, providers_store::launch_env).
        for (name, secret) in launch.env {
            command.env(name, secret);
        }
        hide_console(&mut command);
        let mut child = command
            .spawn()
            .map_err(|e| format!("не запустил движок {}: {e}", self.exe.display()))?;
        // Ребёнок — в job хозяина: смерть процесса приложения (даже жёсткая)
        // закрывает его ручку job и убивает движок (opencode/job.rs).
        if let Err(reason) = self.job.assign(&child) {
            let _ = child.kill();
            let _ = child.wait();
            return Err(format!("движок вне Job Object: {reason}"));
        }
        if let Some(out) = child.stdout.take() {
            pump(out, Arc::clone(&self.log), true);
        }
        if let Some(err) = child.stderr.take() {
            pump(err, Arc::clone(&self.log), false);
        }
        self.child = Some(child);
        Ok(())
    }

    /// Пока сервер не ответил на `/api/config` с нашим паролем — считаем, что он не поднялся.
    fn wait_ready(&mut self) -> Result<(), String> {
        let endpoint = self.endpoint();
        let api = Api::new(&endpoint);
        let deadline = SystemTime::now() + Duration::from_secs(READY_SECONDS);
        let mut last = String::new();
        while SystemTime::now() < deadline {
            if !self.alive() {
                return Err(format!("движок умер при запуске: {}", self.log_tail()));
            }
            match api.ready() {
                Ok(()) => return Ok(()),
                Err(e) => last = e,
            }
            thread::sleep(Duration::from_millis(300));
        }
        Err(format!("сервер не ответил за {READY_SECONDS } с: {last}"))
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Найти движка: сначала PATH, потом два известных места установки desktop-версии.
pub fn locate() -> Result<PathBuf, String> {
    let mut checked: Vec<String>= Vec::new();
    for name in EXE_NAMES {
        match which(name) {
            Some(path) => {
                checked.push(name.to_string());
                return Ok(PathBuf::from(path));
            }
            None => checked.push(name.to_string()),
        }
    }
    for pattern in KNOWN_PATHS {
        let expanded = expand(pattern);
        checked.push(expanded.clone());
        match find(&expanded) {
            Some(path) => return Ok(path),
            None => continue,
        }
    }
    Err(format!(
        "движок не найден: искали {}, {}",
        checked.join(", "),
        "— поставьте opencode CLI"
    ))
}

fn which(name: &str) -> Option<String> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|dir| dir.join(name))
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.display().to_string())
}

/// Раскрыть `%ПАПКА%` и найти файл: с версией в имени — самый свежий по имени.
fn find(pattern: &str) -> Option<PathBuf> {
    let mut parts = pattern.rsplitn(2, ['\\', '/']);
    let file = parts.next()?;
    let dir = expand(parts.next()?);
    if !file.contains('*') {
        let path = PathBuf::from(dir).join(file);
        return path.is_file().then_some(path);
    }
    let (prefix, suffix) = file.split_once('*')?;
    let mut found: Vec<PathBuf>= std::fs::read_dir(&dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.is_file()
                && path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| n.starts_with(prefix) && n.ends_with(suffix))
        })
        .collect();
    found.sort();
    found.pop()
}

fn expand(path: &str) -> String {
    let mut out = path.to_string();
    for key in ["LOCALAPPDATA", "APPDATA", "USERPROFILE"] {
        if let Some(value) = std::env::var_os(key) {
            out = out.replace(&format!("%{key}%"), &value.to_string_lossy());
        }
    }
    out
}

/// Свой свободный порт: чужой сервер на 4096 не переиспользуем молча.
pub fn free_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("не нашёл свободный порт: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("не узнал свободный порт: {e}"))?
        .port();
    Ok(port)
}

/// Пароль сервера: 32 hex из времени и pid. Крейт с генератором случайных чисел
/// ради одного значения не заводим — пароль живёт только на время работы сервера
/// и слушает только localhost.
fn make_password() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default() as u64;
    let mut state = nanos ^ u64::from(std::process::id()).rotate_left(17) ^ 0x9e37_79b9_7f4a_7c15;
    let mut out = String::with_capacity(PASSWORD_HEX);
    while out.len() < PASSWORD_HEX {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        out.push_str(&format!("{state:016x}"));
    }
    out.truncate(PASSWORD_HEX);
    out
}

fn hide_console(command: &mut Command) {
    #[cfg(windows)]
   {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    let _ = command;
}

/// Вывод движка в общий буфер: в ленте ошибка читается словами, а не кодом.
fn pump<R: std::io::Read + Send + 'static>(
    mut stream: R,
    log: Arc<Mutex<VecDeque<String>>>,
    is_out: bool,
) {
    thread::spawn(move || {
        let mut reader = std::io::BufReader::new(&mut stream);
        let mut line = String::new();
        loop {
            line.clear();
            match reader.read_line(&mut line) {
                Ok(0) | Err(_) => return,
                Ok(_) => {}
            }
            let text = line.trim();
            if text.is_empty() {
                continue;
            }
            // stdout движка печатает «server listening on …» и пароль — в ленту это не идёт.
            let text = if is_out && text.contains("server password") {
                "password скрыт".to_string()
            } else {
                text.to_string()
            };
            if let Ok(mut log) = log.lock() {
                log.push_back(text);
                while log.len() > LOG_LINES {
                    log.pop_front();
                }
            }
        }
    });
}
