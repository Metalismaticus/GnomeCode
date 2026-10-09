"""Хранилище провайдеров в Rust: свои endpoints (имя, база URL, модели) в
providers.json без ключа, включённость — в том же файле, конфиг движку — только
из включённых endpoint'ов, ключ идёт из Credential Manager во временную
переменную окружения; живой движок видит endpoint в /api/provider, а его
модели — в /api/model (docs/BATCH.md, пункт 1 партии).

Проверка идёт по тому же пути, что и продукт: cargo-тест на временных папках
и записях сервиса GnomeCodeTest — данные владельца не касаются
(docs/TESTING.md, «Данные пользователя»).

Предел 300 с: живой движок поднимается до минуты, сборка Rust считает минуты
(docs/TESTING.md, «Ловушки стека»).
"""
import sys

from runner_lib import limit, report, run, tool_env, verdict, which

CARGO = [which("cargo"), "test", "--manifest-path", "src-tauri/Cargo.toml", "--test", "providers_store"]
OK = ("хранилище провайдеров: endpoint добавлен, прочитан и удалён; идентификаторы "
      "из хоста и без повторов; плохой запрос — честная ошибка; включённость в "
      "providers.json, выключенный endpoint мимо конфига движка, секрета в файле "
      "нет; живой движок отдаёт endpoint в /api/provider и его модели в /api/model")


def check():
    code, output = run(CARGO, limit("providers_store"), env=tool_env())
    return verdict(code, output, OK)


if __name__ == "__main__":
    sys.exit(report(check()))
