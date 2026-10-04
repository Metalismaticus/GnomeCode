"""Проверка каркаса полигона: у каждой проверки есть check(), раннер находит их сам,
пустой вывод, ненайденный инструмент и зависание — красное.

Проверяет правила, по которым живёт сам полигон: «Правила каркаса» docs/TESTING.md.
Временные проверки пишутся в tests/lib/ и удаляются: свой файл в tests/checks/ раннер принял бы за проверку.
"""
import os
import sys

from runner_lib import ROOT, discover, interpreter, limit, load, report, run, run_check, verdict

MISSING = ["gnomecode-инструмента-нет", "check"]
NO_SUCH = "tests/checks/_нет_такой_проверки.py"
SLEEPER = 'import sys\nimport time\n\nfrom runner_lib import report\n\n\ndef check():\n    time.sleep(30)\n    return 0, "проснулся"\n\n\nif __name__ == "__main__":\n    sys.exit(report(check()))\n'
SCRATCH = os.path.join("tests", "lib")


def scratch(name, body):
    """Временная проверка рядом с общими помощниками: раннер её не видит, каркас — да."""
    path = os.path.join(ROOT, SCRATCH, name)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(body)
    return os.path.join(SCRATCH, name)


def check():
    found = discover(ROOT)
    if not found:
        return 1, "проверок нет: tests/checks и tests/ui пусты — раннеру нечего находить"
    for name, path in found:
        if limit(name) <= 0:
            return 1, f"{name} — нет предела времени рядом с проверкой (LIMITS в tests/lib/runner_lib.py)"
        if path.endswith(".mjs"):
            if run([interpreter(path), "--check", path], 30)[0] != 0:  # разбор сценария, без запуска браузера
                return 1, f"{name} — сценарий не разбирается node: {path}"
            continue
        if not callable(getattr(load(path, ROOT), "check", None)):
            return 1, f"{name} — нет функции check() в {path}"
    if verdict(*run(MISSING, 20), "инструмент есть")[0] == 0:
        return 1, "ненайденный инструмент оказался зелёным — правило каркаса нарушено"
    if verdict(0, "", "пусто")[0] == 0:
        return 1, "пустой вывод оказался зелёным — правило каркаса нарушено"
    if run_check("_нет_такой_проверки", NO_SUCH, 20)[0] == 0:
        return 1, "проверка, которой нет, оказалась зелёной — правило каркаса нарушено"
    sleeper = scratch("_зависшая.py", SLEEPER)
    try:
        hung = run_check("_зависшая", sleeper, 5)
        if hung[0] != 124:
            return 1, f"зависшая проверка не дала код 124, а {hung} — предел времени не работает"
        if "не уложилась" not in hung[1]:
            return 1, f"на зависании нет строки о пределе: {hung[1]!r} — провал должен быть виден поимённо"
    finally:
        os.remove(sleeper)
    names = ", ".join(name for name, _ in found)
    return 0, f"каркас в порядке: проверок {len(found)} ({names}) — у всех check(), предел; 124 на зависании"


if __name__ == "__main__":
    sys.exit(report(check()))
