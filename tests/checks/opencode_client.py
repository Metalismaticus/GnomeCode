"""Мост к OpenCode server на живом движке: `cargo test --manifest-path src-tauri/Cargo.toml`.

Проверка идёт по тому же пути, что и продукт: настоящий сокет, chunked SSE, Basic-авторизация,
обрыв и переподключение, а строки ленты собираются из фикстуры событий. Клиент без этого
теста — заглушка, которая и на живом движке промолчит.

Предел 600 с: первая компиляция Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Предел времени»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml"]
OK = "мост к OpenCode: строки ленты собраны, обрыв переподключён, пароль назван"


def check():
    code, output = run(CARGO, limit("opencode_client"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))