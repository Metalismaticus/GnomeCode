"""Общие помощники полигона: одна папка на всех проверок, а не копии по файлам.

Зовут раннер tools/run_checks.py и проверки tests/checks/*.py, tests/ui/*.mjs.
Формат проверки — файл с функцией check(), возвращающей (код, итог-строку): 0 — зелено,
124 — не уложилась в предел, прочие ненулевые — провал. Правила каркаса —
«Правила каркаса» docs/TESTING.md. Запуск процесса и разбор его итога —
tests/lib/runner_vite.py; имена те же — проверки берут их отсюда, как раньше.
"""
import importlib.util
import os
import shutil

from runner_vite import ROOT, interpreter, missing, run, tool_env, verdict, which

FOLDERS = (("tests/checks", ".py"), ("tests/ui", ".mjs"))  # папка, расширение: UI-сценарии — Playwright
LIMITS = {"quick_build": 150, "harness": 180, "window_shot": 600, "opencode_client": 600,
          "opencode_engine": 180, "chat_stream": 300, "window_look": 300,
          "no_raw_colors": 30, "project_tree": 180, "project_files": 300,
          "plugins": 300, "plugins_section": 300, "catalog": 300, "state_files": 180, "session_resume": 180,
          "plugin_config": 300, "plugin_rules": 180, "plugin_updates": 300, "plugins_scopes": 300,
          "plugin_toolsets": 180, "plugins_toolsets": 300,
          "plugins_usage": 300, "plugin_usage": 180, "usage_shot": 120,
          "sources_used": 300, "sources_shot": 120,
          "compare": 300, "chat_model": 600, "compare_shot": 240, "compare_read_once": 300,
          "settings": 300, "settings_shot": 240, "settings_store": 180,
          "providers_store": 300, "providers_endpoints": 300, "stats_store": 300,
          "full_cycle": 600, "glavnoe": 300, "variant_b": 300, "frameless": 300, "frameless_shot": 240,
          "new_chat": 300, "startup_freeze": 120}  # секунды: замер × 3, одно место
DEFAULT_LIMIT = 60


def limit(name):
    """Предел времени проверки: своё число рядом с проверкой; у неизвестной — общий."""
    return LIMITS.get(name, DEFAULT_LIMIT)


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
