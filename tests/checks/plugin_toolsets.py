"""Tool Sets в Rust: toolsets.json roundtrip и подключение сета скоупом.

Проверка идёт по тому же пути, что и продукт: cargo-тест на временных папках —
сет переживает перечитывание, подключение сета ставит скоуп каждому
установленному плагину, недоступные пропускаются, снятие с чата сет и реестр
установленного не трогает (docs/BATCH.md, пункт 7; phase2.md, раздел 11).

Предел 180 с: сборка Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "plugins_toolsets"]
OK = "Tool Sets: сет пишется и читается, подключение сета ставит скоуп установленным и пропускает недоступные, снятие с чата сет не стирает"


def check():
    code, output = run(CARGO, limit("plugin_toolsets"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
