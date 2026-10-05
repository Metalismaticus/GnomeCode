"""Файловая система проекта в Rust: дерево папки, чтение файла, сборка запроса с файлами.

Проверка идёт по тому же пути, что и продукт: настоящая папка во временном каталоге,
настоящий обход дерева. Крейт ставится из сети — проверка падает красной, а не
пропуском, если крейта нет.

Предел 180 с: сборка Rust считает минуты, «чинить» по таймауту нельзя
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "project_tree"]
OK = "файлы проекта: дерево читает папку, файл — содержимое, запрос несёт файл по относительному пути"


def check():
    code, output = run(CARGO, limit("project_tree"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
