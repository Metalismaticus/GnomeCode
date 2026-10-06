"""Общие помощники полигона: одна папка на всех проверок, а не копии по файлам.

Зовут раннер tools/run_checks.py и проверки tests/checks/*.py, tests/ui/*.mjs.
Формат проверки — файл с функцией check(), возвращающей (код, итог-строку): 0 — зелено,
124 — не уложилась в предел, прочие ненулевые — провал. Правила каркаса —
«Правила каркаса» docs/TESTING.md.
"""
import importlib.util
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FOLDERS = (("tests/checks", ".py"), ("tests/ui", ".mjs"))  # папка, расширение: UI-сценарии — Playwright
LIMITS = {"quick_build": 150, "harness": 180, "window_shot": 600, "opencode_client": 600,
          "opencode_engine": 180, "chat_stream": 300, "window_look": 300,
          "no_raw_colors": 30, "project_tree": 180, "project_files": 300,
          "plugins": 300, "plugins_section": 300, "catalog": 300, "state_files": 180, "session_resume": 180,
          "plugin_config": 300, "plugin_rules": 180, "plugin_updates": 300,
          "full_cycle": 600}  # секунды: замер × 3, одно место
DEFAULT_LIMIT = 60


def limit(name):
    """Предел времени проверки: своё число рядом с проверкой; у неизвестной — общий."""
    return LIMITS.get(name, DEFAULT_LIMIT)


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


def discover(root=ROOT):
    """Проверки полигона — своим файлом, без списка: [(имя, путь)] по имени файла без расширения."""
    found = []
    for folder, ext in FOLDERS:
        where = os.path.join(root, folder)
        for name in sorted(os.listdir(where)) if os.path.isdir(where) else []:
            if name.endswith(ext) and not name.startswith("_"):
                found.append((name[: -len(ext)], os.path.join(folder, name)))
    return found


def load(path, root=ROOT):
    """Модуль проверки из файла поимённо (у каждой проверки есть функция check)."""
    name = "polygon_" + os.path.splitext(os.path.basename(path))[0]
    spec = importlib.util.spec_from_file_location(name, os.path.join(root, path))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def last_line(output):
    """Итоговая строка проверки — последняя непустая строка её вывода."""
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return lines[-1] if lines else ""


def run_check(name, path, seconds, root=ROOT):
    """Проверка файлом как отдельным процессом — предел времени честный, процесс можно снять.

    (код, итог-строка): зелёная без непустой итоговой строки — красное: проверка ничего не утверждала.
    """
    executable = interpreter(path)
    if not shutil.which(executable):
        return missing(executable, " ".join([executable, path]))
    code, output = run([executable, path], seconds, root)
    line = last_line(output)
    if code == 124:
        return 124, f"не уложилась в предел {seconds} с" + (f" — до этого: {line}" if line else "")
    if not line:
        return (1, "зелёная без итоговой строки: проверка ничего не утверждала") if code == 0 else \
               (code, f"проверка молчала, код возврата {code}")
    return code, line


def report(result):
    """Итог check() — строка в вывод и код возврата процесса проверки."""
    code, line = result
    print(line)
    return code
