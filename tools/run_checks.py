#!/usr/bin/env python3
"""Раннер полигона GnomeCode: находит проверки сам и перечисляет провалы поимённо.

    python -X utf8 tools/run_checks.py             # группа: все проверки полигона
    python -X utf8 tools/run_checks.py quick_build  # одна проверка по имени
    python -X utf8 tools/run_checks.py --list       # только имена проверок

Проверки — tests/checks/*.py и tests/ui/*.mjs, своим файлом; списка здесь нет, новая
проверка в папке находится сама («Как добавить проверку» docs/TESTING.md). Предел времени
и разбор модуля — tests/lib/runner_lib.py, одно место на всех.

Коды возврата: 0 — зелено; 1 — провалы поимённо; 2 — неверный вызов или папки проверок нет;
124 — зависание по пределу времени.
"""
import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tests", "lib"))
import runner_lib  # проверки берут его же — путь один, копий нет


def arguments():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("names", nargs="*", metavar="ИМЯ", help="проверки по имени; без имён — все")
    parser.add_argument("--list", action="store_true", help="только имена проверок")
    return parser.parse_args()


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="replace")
    args = arguments()
    found = runner_lib.discover(ROOT)
    if not found:
        print(f"Итог: проверок нет — в {ROOT} пусты tests/checks и tests/ui.")
        return 2
    known = dict(found)
    if args.list:
        print("Проверки полигона:", *known, sep="\n  ")
        return 0
    absent = [name for name in args.names if name not in known]
    if absent:
        print(f"Итог: нет таких проверок: {', '.join(absent)} — имена: {', '.join(known)}.")
        return 2
    green, failed, hung = 0, [], []
    for name, path in found:
        if args.names and name not in args.names:
            continue
        code, line = runner_lib.run_check(name, path, runner_lib.limit(name))
        print(f"{'зелёная' if code == 0 else 'провал'}: {name} — {line}")
        if code == 0:
            green += 1
        else:
            failed.append(name)
            hung += [name] * (code == 124)
    print(f"Итог: зелёных {green} / провалов {len(failed)}" + (f" — зависли: {', '.join(hung)}" if hung else ""))
    return 124 if hung else 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
