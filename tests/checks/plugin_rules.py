"""Правила категорий плагина в Rust: rules.json roundtrip и решение по вызову.

Проверка идёт по тому же пути, что и продукт: cargo-тест на временных папках —
deny старше гранта чата, нет правила — ask, allow молча
(docs/BATCH.md, пункт 3; docs/TESTING.md, «Данные пользователя»).

Предел 180 с: сборка Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "plugin_rules"]
OK = "правила плагина: rules.json пишется и читается, deny старше гранта чата, нет правила — ask, allow исполняет молча"


def check():
    code, output = run(CARGO, limit("plugin_rules"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
