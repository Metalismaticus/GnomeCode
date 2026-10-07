"""Старт окна не ждёт движок: замер, что мост не блокирует запуск.

Симптом владельца (2026-10-07, живая копия): при запуске окно долго
неотвечающее/зависшее. Причина — `Chat::start` в setup поднимает OpenCode server
синхронно: окно не появляется, пока сервер не ответит (/api/config, до 30 с).

Проверка бьёт по тесту `startup_freeze`: Chat::start с «движком, который не
 отвечает» (процесс жив, HTTP нет) должен вернуть управление короче 2 с и
позволить ленте честно сказать «движок поднимается…». Предел 120 с.
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--examples", "--test", "startup_freeze"]
OK = "старт не ждёт движок: мост вернулся короче 2 с и честно сказал «движок поднимается…»"


def check():
    code, output = run(CARGO, limit("startup_freeze"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
