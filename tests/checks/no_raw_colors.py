"""Цвет в компонентах — только токенами: греп по `src/` на сырой литерал цвета.

Правило проекта (`AGENTS.md`, «Правила проекта») и спецификация экрана
(`docs/specs/2026-10-05-4-glavnoe-okno.md`, «Размеры»): ни одного `#hex`, `rgb(`,
`hsl(` вне `src/styles/tokens.css` — там цвета и живут, по одной теме рядом.
Половина критерия пункта «Три колонки по референсам + две темы» проверяется прямо
этой строкой, а не глазами на снимке.

Исключение одно — сам файл токенов: он и есть место, где цвет разрешён.
"""
import os
import re
import sys

from runner_lib import ROOT, report

SRC = "src"
TOKENS = os.path.join("src", "styles", "tokens.css")
EXTENSIONS = (".tsx", ".ts", ".css")
COLOR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(")
SKIP_DIRS = {"node_modules", "dist", "target"}


def sources(root):
    """Файлы `src/`, где цвет запрещён: всё, кроме файла токенов."""
    found = []
    for folder, dirs, names in os.walk(os.path.join(root, SRC)):
        dirs[:] = [name for name in dirs if name not in SKIP_DIRS]
        for name in sorted(names):
            if not name.endswith(EXTENSIONS):
                continue
            path = os.path.join(folder, name)
            if os.path.relpath(path, root) == TOKENS.replace("\\", os.sep):
                continue
            found.append(path)
    return found


def check():
    files = sources(ROOT)
    if not files:
        return 1, f"в папке {SRC} нет ни одного файла интерфейса — греп нечего стеречь"
    found = []
    for path in files:
        with open(path, encoding="utf-8") as handle:
            for number, line in enumerate(handle, start=1):
                match = COLOR.search(line)
                if match:
                    shown = line.strip()[:80]
                    found.append(f"{os.path.relpath(path, ROOT)}:{number} {match.group(0)} — {shown}")
    if found:
        head = "; ".join(found[:5])
        more = "" if len(found) <= 5 else f"; и ещё {len(found) - 5}"
        return 1, f"сырой цвет вне {TOKENS.replace(os.sep, '/')}: {head}{more}"
    return 0, f"сырых цветов вне {TOKENS.replace(os.sep, '/')} нет: проверено файлов {len(files)}"


if __name__ == "__main__":
    sys.exit(report(check()))