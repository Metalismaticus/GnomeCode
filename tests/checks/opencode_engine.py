"""Живой движок OpenCode: находит, поднимает, отвечает и переживает падение.

Проверка бьёт по настоящему процессу `opencode serve` на своём свободном порту:
сессия создаётся, движок убивается и поднимается снова на том же порту. Данные изолированы
(XDG на временную папку) — иначе polygon создавал бы сессии в базе владельца
(docs/TESTING.md, «Данные пользователя»).

Живой ответ модели эта проверка не ждёт: изолированный движок не знает авторизации
владельца, и ключи — не наш вход. Предел 180 с.
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "engine_live"]
OK = "движок найден, поднялся, пережил убийство и вернулся на том же порту"


def check():
    code, output = run(CARGO, limit("opencode_engine"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))