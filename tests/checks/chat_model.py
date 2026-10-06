"""Несёт ли мост выбранную модель движку (пункт 10, панель «Сравнение моделей»).

Проверка идёт по тому же пути, что и продукт: настоящий мост (`Chat`, `Store`),
движок — лупбек из `tests/common` (тела запросов к `/prompt` читает сам тест),
данные — во временных папках (docs/TESTING.md, «Данные пользователя»).

Предел 600 с: в нём и сборка Rust, и три теста с ожиданием лупбека —
«чинить» по таймауту нельзя (docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "chat_model"]
OK = ("выбранная модель: выбор переживает перезапуск окна, запрос движку несёт "
      "providerID/modelID, без выбора запрос уходит как раньше — на модели по умолчанию")


def check():
    code, output = run(CARGO, limit("chat_model"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
