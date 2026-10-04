//! Общее для проверок моста: чтение запроса клиента целиком.
//!
//! Сервер в проверке — настоящий сокет, поэтому запрос надо дочитать до конца:
//! иначе сокет закроется с непрочитанными данными и клиент получит обрыв
//! вместо ответа.

use std::io::Read;
use std::net::TcpStream;

/// Запрос клиента: заголовки и тело по `Content-Length`.
pub fn read_request(socket: &mut TcpStream) -> String {
    let mut raw = Vec::new();
    let mut one = [0u8; 1];
    while let Ok(1) = socket.read(&mut one) {
        raw.push(one[0]);
        if raw.ends_with(b"\r\n\r\n") || raw.len() > 64 * 1024 {
            break;
        }
    }
    let head = String::from_utf8_lossy(&raw).to_string();
    let length: usize = head
        .lines()
        .find_map(|line| line.strip_prefix("Content-Length: "))
        .and_then(|value| value.trim().parse().ok())
        .unwrap_or(0);
    let mut body = vec![0u8; length];
    if length > 0 {
        let _ = socket.read_exact(&mut body);
    }
    format!("{head}{}", String::from_utf8_lossy(&body))
}
