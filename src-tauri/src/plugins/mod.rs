//! Плагины, подключённые к чату: список установленных, реестр подключений
//! и слой прав вызовов (docs/SPEC/plugins.md, «Утверждённый UX одобрения»).
//!
//! Источник правды на «установленные плагины» — движок (`GET /api/plugin`,
//! `GET /api/command`), и формат его ответа наружу не уходит: разбор живёт в
//! [`catalog`], интерфейс получает наши типы (ADR-0001).
//!
//! Подключение — запись в реестр чата, а не вызов сервера: `POST /api/plugin` у
//! движка не существует, серверного «подключить плагин» нет и не будет.

pub mod catalog;
pub mod commands;
pub mod install;
pub mod model;
pub mod permissions;
pub mod registry;

pub use model::{Command, Plugin};