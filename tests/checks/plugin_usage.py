"""Счётчик вызовов плагина в Rust: usage.json пишет count и время последнего вызова.

Проверка идёт по тому же пути, что и продукт: cargo-тест на временных папках —
два исполненных вызова дают счётчик два и отметку времени, отказ не в счёт
(docs/BATCH.md, пункт 8; docs/TESTING.md, «Данные пользователя»).

Предел 180 с: сборка Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "usage"]
OK = "счётчик плагина: usage.json пишет count и время, отказ не в счёт"


def check():
    code, output = run(CARGO, limit("plugin_usage"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
