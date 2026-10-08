"""Подъём/ожидание/останов процесса проверки: окружение, исполнитель, предел времени, разбор итога.

Зовут раннер tools/run_checks.py и проверки tests/checks/*.py — этим же куском поднимаются
и vite-сценарии полигона (tests/ui/*.mjs): сценарий — отдельный процесс, зависание — красное
с кодом 124 («Правила каркаса» docs/TESTING.md). Пределы поимённо — LIMITS в
tests/lib/runner_lib.py, одно место на всех.
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def tool_env():
    r"""PATH сессии с cargo: rustup ставит его в %USERPROFILE%\.cargo\bin, а сессии агентов её не наследуют.

    Плюс tests/lib в PYTHONPATH — общие помощники на месте у каждой проверки, когда её запускает раннер.
    """
    env = dict(os.environ)
    cargo = os.path.join(os.environ.get("USERPROFILE", ""), ".cargo", "bin")
    if os.path.isdir(cargo):
        env["PATH"] = env.get("PATH", "") + os.pathsep + cargo
    here = os.path.dirname(os.path.abspath(__file__))
    env["PYTHONPATH"] = here + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    return env


def which(name):
    """Путь к инструменту с учётом PATHEXT: на Windows CreateProcess ищет только .exe, а npm — это npm.cmd."""
    return shutil.which(name) or name


def interpreter(path):
    """Интерпретатор проверки по расширению: Python — проверка, node — UI-сценарий."""
    return which("node") if path.endswith(".mjs") else sys.executable


def run(argv, seconds, cwd=ROOT, env=None):
    """Запуск команды с пределом времени: (код, вывод). 124 — не уложилась, 127 — инструмента нет."""
    try:
        done = subprocess.run(argv, capture_output=True, text=True, encoding="utf-8", errors="replace",
                              timeout=seconds, cwd=cwd, env=env or tool_env())
    except FileNotFoundError:
        return 127, os.path.basename(argv[0])
    except subprocess.TimeoutExpired as expired:
        return 124, expired.output if isinstance(expired.output, str) else (expired.output or b"").decode("utf-8", "replace")
    return done.returncode, done.stdout + done.stderr


def missing(name, command):
    """Ненайденный инструмент — красное с подсказкой, а не пропуск."""
    return 1, f"{name} не найден в PATH: {command}"


def first_error(output):
    """Из вывода команды — строка с ошибкой, иначе первая непустая."""
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return next((line for line in lines if "error" in line.lower()), lines[0] if lines else "")


def verdict(code, output, ok):
    """Итог команды: (код, итог-строка). Пустой вывод — красное даже при коде 0, инструмент не найден — красное."""
    if code == 127:
        return missing(output, "команда не запустилась")
    if code != 0:
        return code, first_error(output) or f"код возврата {code}, вывода нет"
    return (0, ok) if output.strip() else (1, "пустой вывод: команда отработала, но ничего не напечатала")
