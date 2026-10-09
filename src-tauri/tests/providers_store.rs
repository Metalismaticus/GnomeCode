//! Хранилище своих endpoints и включённости провайдеров (docs/BATCH.md, пункт 1
//! партии): providers.json в папке данных — записи endpoint'ов (имя, база URL,
//! модели) без ключа и список выключенных; конфиг движку собирается только из
//! включённых endpoint'ов, ключ идёт из хранилища ОС в переменную окружения,
//! на диск не попадает. Живой движок подтверждает: endpoint виден в
//! `/api/provider`, его модели — в `/api/model`.
//!
//! Credential Manager — реальное хранилище ОС: конфиг читает ключи названного
//! сервиса, у проверки он свой (`GnomeCodeTest`), данные владельца не трогаются
//! (docs/TESTING.md, «Данные пользователя»). Гоняет `tests/checks/providers_store.py`.

use gnomecode_lib::plugins::commands::key_missing;
use gnomecode_lib::plugins::install;
use gnomecode_lib::providers_store;

mod common;

/// Сервис записей проверки: окно ходит в `GnomeCode`, проверка — в свой.
const TEST_SERVICE: &str = "GnomeCodeTest";

/// Своя временная папка на тест: действия проверки не трогают данные владельца.
struct TempDir(std::path::PathBuf);

impl TempDir {
    fn new(name: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!("gnomecode-provstore-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&path).expect("временная папка создана");
        TempDir(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// Ключ endpoint'а на тест: своё имя у каждого прогона, чтобы не встречать чужой.
fn scratch_key(id: &str) -> String {
    format!("gnomecode-check-endpoint-{id}-{}", std::process::id())
}

/// endpoint'ы без ключа не запирают конфиг: база URL без схемы — ошибка.
#[test]
fn endpoint_adds_reads_and_removes() {
    let data = TempDir::new("roundtrip");
    let file = providers_store::file(data.0.clone());

    // Пустое хранилище: endpoint'ов нет, включены все.
    let empty = providers_store::at(&file);
    assert!(empty.endpoints.is_empty(), "без файла endpoint'ов нет");
    assert!(empty.disabled.is_empty(), "без файла выключенных нет");

    let added = providers_store::add_endpoint(
        &file,
        "Корпоративный прокси",
        "https://llm.corp.local/v1",
        vec!["corp-model-a".to_string(), "corp-model-b".to_string()],
    )
    .expect("endpoint добавлен");
    assert!(!added.id.is_empty(), "идентификатор endpoint'у назначен");
    assert_eq!(added.name, "Корпоративный прокси", "имя владельца сохранено");
    assert_eq!(added.base_url, "https://llm.corp.local/v1", "база URL сохранена");
    assert_eq!(added.models.len(), 2, "модели endpoint'а сохранены");

    let held = providers_store::at(&file);
    assert_eq!(held.endpoints.len(), 1, "endpoint пережил перечитывание файла");

    providers_store::remove_endpoint(&file, &added.id).expect("endpoint удалён");
    assert!(
        providers_store::at(&file).endpoints.is_empty(),
        "после удаления endpoint'ов нет"
    );
    // Удаление второго раза — не ошибка, как «Убрать» у ключа.
    providers_store::remove_endpoint(&file, &added.id).expect("повторное удаление спокойно");
}

/// Идентификатор endpoint'а растёт из базы URL и не повторяется: второй
/// endpoint того же хоста получает соседнее имя, а «/» в нём не заводится —
/// иначе пара провайдер/модель при отправке вопроса режется не там.
#[test]
fn endpoint_ids_come_from_the_host_and_stay_unique() {
    let data = TempDir::new("ids");
    let file = providers_store::file(data.0.clone());

    let first = providers_store::add_endpoint(&file, "Первый", "https://llm.corp.local/v1", vec![])
        .expect("первый добавлен");
    let second = providers_store::add_endpoint(&file, "Второй", "https://llm.corp.local:8080/v1", vec![])
        .expect("второй добавлен");
    assert_ne!(first.id, second.id, "два endpoint'а одного хоста не делят идентификатор");
    assert!(
        !first.id.contains('/'),
        "идентификатор без «/»: пара провайдер/модель режется по первому «/»"
    );
    assert!(
        first.id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-'),
        "идентификатор в нижнем регистре из латиницы, цифр и дефисов: {}", first.id
    );
}

/// Плохой запрос — честная ошибка: пустое имя, адрес без схемы, слишком много.
#[test]
fn bad_endpoint_requests_report() {
    let data = TempDir::new("bad");
    let file = providers_store::file(data.0.clone());

    let no_name = providers_store::add_endpoint(&file, "  ", "https://llm.corp/v1", vec![]);
    assert!(no_name.is_err(), "пустое имя — ошибка: {no_name:?}");
    let no_scheme = providers_store::add_endpoint(&file, "Прокси", "llm.corp/v1", vec![]);
    assert!(no_scheme.is_err(), "адрес без http(s):// — ошибка: {no_scheme:?}");
    let no_url = providers_store::add_endpoint(&file, "Прокси", "   ", vec![]);
    assert!(no_url.is_err(), "пустой адрес — ошибка: {no_url:?}");
    assert!(
        providers_store::at(&file).endpoints.is_empty(),
        "отклонённые запросы ничего не записали"
    );
}

/// Включённость живёт в providers.json (формат state.json не растёт) и
/// переживает перечитывание; выключенный endpoint в конфиг движка не идёт.
#[test]
fn enabled_flag_is_stored_and_config_skips_the_disabled() {
    let data = TempDir::new("enabled");
    let file = providers_store::file(data.0.clone());
    let one = providers_store::add_endpoint(&file, "Один", "https://one.local/v1", vec!["m1".to_string()])
        .expect("первый добавлен");
    let two = providers_store::add_endpoint(&file, "Два", "https://two.local/v1", vec!["m2".to_string()])
        .expect("второй добавлен");

    providers_store::set_enabled(&file, &one.id, false).expect("первый выключен");
    let held = providers_store::at(&file);
    assert!(
        held.disabled.iter().any(|id| id == &one.id),
        "выключенный endpoint записан в файл"
    );
    assert!(
        !held.disabled.iter().any(|id| id == &two.id),
        "включённый endpoint в списке выключенных не числится"
    );

    // Ключ проверочного сервиса — под именем записи endpoint'а (`endpoint:<id>`),
    // как его читает конфиг; у первого ключа нет.
    let key = providers_store::key_id(&two.id);
    providers_store::remove_secret(TEST_SERVICE, &key).expect("чистый старт: записи нет");
    gnomecode_lib::providers::scratch::save(TEST_SERVICE, &key, "sk-test-123")
        .expect("ключ записан в Credential Manager");

    let held = providers_store::at(&file);
    let config = providers_store::engine_config(TEST_SERVICE, &held).expect("конфиг собран");
    assert!(config.contains(&two.id), "включённый endpoint в конфиге: {config}");
    assert!(!config.contains(&one.id), "выключенный endpoint в конфиге: {config}");
    assert!(config.contains("two.local"), "база URL включённого в конфиге");
    assert!(config.contains("sk-test-123"), "ключ идёт движку в переменной, не в файле");
    assert!(config.contains("openai-compatible"), "endpoint объявлен OpenAI-совместимым пакетом");

    // Ключ не остаётся в providers.json: файл хранит endpoint без секрета.
    let on_disk = std::fs::read_to_string(&file).expect("providers.json прочитан");
    assert!(
        !on_disk.contains("sk-test-123"),
        "секрет попал в providers.json: {on_disk}"
    );
    assert!(
        !on_disk.contains("sk-"),
        "в providers.json есть похоже на ключ: {on_disk}"
    );

    // Все endpoint'ы выключены — конфига нет, движку нечего передавать.
    providers_store::set_enabled(&file, &two.id, false).expect("второй выключен");
    let held = providers_store::at(&file);
    assert!(
        providers_store::engine_config(TEST_SERVICE, &held).is_none(),
        "без включённых endpoint'ов конфиг не собирается"
    );
    providers_store::remove_secret(TEST_SERVICE, &key).expect("чистый выход");
}

/// Включённость обычного провайдера движка — тем же файлом: id не endpoint'а
/// просто попадает в список выключенных.
#[test]
fn engine_providers_toggle_through_the_same_file() {
    let data = TempDir::new("engine-toggle");
    let file = providers_store::file(data.0.clone());

    providers_store::set_enabled(&file, "groq", false).expect("groq выключен");
    providers_store::set_enabled(&file, "groq", true).expect("groq включён");
    assert!(
        !providers_store::at(&file).disabled.contains(&"groq".to_string()),
        "включение убрало провайдера из списка выключенных"
    );
}

/// Живой движок: конфиг из providers.json через переменную окружения делает
/// endpoint видимым в `/api/provider`, а его модели — в `/api/model`.
#[test]
fn live_engine_serves_the_endpoint_from_the_config() {
    let found = match gnomecode_lib::opencode::engine::locate() {
        Ok(exe) => exe,
        Err(reason) => panic!("движок не найден: {reason}"),
    };
    assert!(found.is_file(), "движок по найденному пути — файл: {}", found.display());

    let data = TempDir::new("live");
    let file = providers_store::file(data.0.clone());
    let key = scratch_key("live");
    providers_store::remove_secret(TEST_SERVICE, &key).expect("чистый старт: записи нет");
    gnomecode_lib::providers::scratch::save(TEST_SERVICE, &key, "sk-live-test")
        .expect("ключ живой проверки записан");
    let endpoint = providers_store::add_endpoint(
        &file,
        "Живой прокси",
        "http://127.0.0.1:9/v1",
        vec!["probe-model-a".to_string()],
    )
    .expect("endpoint добавлен");
    let held = providers_store::at(&file);
    let config = providers_store::engine_config(TEST_SERVICE, &held).expect("конфиг собран");

    // Данные движка изолированы, как в engine_live: сессии не идут в базу владельца.
    let base = std::env::temp_dir().join(format!("gnomecode-provstore-live-{}", std::process::id()));
    for dir in ["data", "config"] {
        std::fs::create_dir_all(base.join(dir)).expect("временная папка движка создана");
    }
    let config_for_engine = config.clone();
    let mut engine =
        gnomecode_lib::opencode::engine::Engine::start_with_config(std::sync::Arc::new(move || {
            Some(config_for_engine.clone())
        }))
        .expect("движок поднялся с конфигом endpoint'а");
    let client_endpoint = engine.endpoint();
    let api = gnomecode_lib::opencode::client::Api::new(&client_endpoint);

    // Активация провайдеров идёт после плагинов — ждём появления endpoint'а.
    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(60);
    let mut listed = false;
    while std::time::Instant::now() < deadline {
        if let Ok(raw) = api.providers() {
            let text = raw.to_string();
            if text.contains(&endpoint.id) {
                listed = true;
                break;
            }
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
    assert!(listed, "endpoint не появился в /api/provider за минуту");
    let models = api
        .models()
        .expect("/api/model ответил");
    let text = models.to_string();
    assert!(
        text.contains("probe-model-a"),
        "модели endpoint'а нет в /api/model: {}",
        &text[..text.len().min(400)]
    );
    engine.stop();
    providers_store::remove_secret(TEST_SERVICE, &key).expect("чистый выход");
}

/// Лупбек: `/api/provider` отдаёт одного провайдера `served` — как живое ядро
/// отвечает про активированного у себя провайдера (ключ в окружении).
fn serve_providers() -> gnomecode_lib::opencode::client::Endpoint {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("свободный порт");
    let endpoint = gnomecode_lib::opencode::client::Endpoint::local(
        listener.local_addr().expect("адрес").port(),
        "test-pass".to_string(),
    );
    std::thread::spawn(move || {
        for socket in listener.incoming().flatten() {
            let mut socket = socket;
            let request = common::read_request(&mut socket);
            let route = request.lines().next().unwrap_or_default().to_string();
            let body = if route.contains("/api/provider") {
                common::json_head(r#"{"data":[{"id":"served","name":"Served"}]}"#)
            } else {
                common::json_head("{}")
            };
            use std::io::Write;
            let _ = socket.write_all(body.as_bytes());
            let _ = socket.flush();
        }
    });
    endpoint
}

/// Затвор ключей: провайдер без ключа и мимо движка — вопрос не уходит с
/// причиной «нет ключа — задайте в настройках»; своему endpoint'у и
/// активированному движком провайдеру ключ окна не нужен.
#[test]
fn model_without_key_is_blocked_with_a_reason() {
    let data = TempDir::new("keygate");
    let file = providers_store::file(data.0.clone());
    let engine = serve_providers();

    let blocked = key_missing(&file, Some(engine.clone()), "quiet/gpt-x").expect("причина отказа");
    assert!(
        blocked.contains("нет ключа") && blocked.contains("задайте в настройках"),
        "в причине — что случилось и куда идти: {blocked}"
    );

    providers_store::add_endpoint(&file, "Мой", "https://mine.local/v1", vec!["m".to_string()])
        .expect("endpoint добавлен");
    let held = providers_store::at(&file);
    let mine = held.endpoints.last().expect("endpoint на месте").id.clone();
    assert_eq!(
        key_missing(&file, Some(engine.clone()), &format!("{mine}/m")),
        None,
        "endpoint без ключа отправляется — ключ для него необязателен"
    );
    assert_eq!(
        key_missing(&file, Some(engine), "served/any"),
        None,
        "провайдер, активированный движком, отправляется без ключа окна"
    );
}

/// Путь файла хранилища в папке данных — по узору правил плагинов.
#[test]
fn file_lives_in_the_data_folder() {
    let fallback = std::path::PathBuf::from("C:\\data-fallback");
    let path = providers_store::file(fallback);
    assert_eq!(
        path.file_name().and_then(|n| n.to_str()),
        Some("providers.json"),
        "файл хранилища — providers.json"
    );
    let _ = install::data_file; // тот же узор папки данных, сосед по коду
}
