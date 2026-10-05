"""Хранилище состояния окна в Rust: state.json в папке данных, roundtrip, испорченный файл.

Проверка идёт по тому же пути, что и продукт: свой файл во временной папке, правка
одного поля остальное не трогает, испорченный файл — дефолты без паники
(docs/TESTING.md, «Данные пользователя» — проверки на своей папке).

Предел 180 с: сборка Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "state_storage"]
OK = "состояние окна: сессия и тема переживают перезапуск, правка одного поля остальное не трогает, испорченный файл — дефолты"


def check():
    code, output = run(CARGO, limit("state_files"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
