"""Хранилище окна настроек в Rust: ключ в Credential Manager на временной
записи сервиса `GnomeCodeTest`, модель по умолчанию переживает переподъём,
секция умолчаний прав — чтение/запись, правило плагина старше умолчания
(docs/specs/2026-10-06-12-nastrojki.md, «Где снимать»).

Проверка идёт по тому же пути, что и продукт: cargo-тест на временных папках
и записях — данные владельца не касаются (docs/TESTING.md, «Данные пользователя»).

Предел 180 с: сборка Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "settings_store"]
OK = ("хранилище настроек: ключ на записи сервиса GnomeCodeTest — записан, «задан», "
      "удалён, «не задан»; модель по умолчанию переживает переподъём; секция "
      "умолчаний прав пишется и читается; правило плагина старше умолчания")


def check():
    code, output = run(CARGO, limit("settings_store"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
