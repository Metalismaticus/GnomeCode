"""Быстрая проверка продукта: tsc, сборка интерфейса и cargo check — одной командой `npm run check`.

Первая настоящая проверка полигона: зелёная на живом продукте, красная на намеренно сломанном.
Коды возврата честные: 0 — зелено, nonzero — красное.
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

COMMAND = [which("npm"), "run", "check"]
OK = "tsc, сборка интерфейса и cargo check — без ошибок"


def check():
    code, output = run(COMMAND, limit("quick_build"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
