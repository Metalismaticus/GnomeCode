// Лента чата глазами владельца: печатаем вопрос, жмём «отправить» и ждём строку ответа
// и строку вызова инструмента. Обрыв потока даёт строку «переподключаюсь», а не пустоту.
//
//   node tests/ui/chat_stream.mjs
// Итог: код возврата и последняя строка вывода — как у любой проверки (tests/lib/runner_lib.py).
// Страница интерфейса, а не окно Tauri: WebView2 Playwright не водит, поэтому вне окна
// мост отдаёт фикстуру (src/fixture.ts) — ту же ленту, что отдаёт живой мост.
import { chromium } from "@playwright/test";

import { done, startInterface, INSTALL } from "../lib/ui_lib.mjs";

const QUESTION = "Проверь мост";
const TOOL_LINE = "✓ read · src/bridge.ts";
const RECONNECT = "Поток прерван, переподключаюсь…";

const feedText = async (page) => page.innerText('[data-testid="feed"]');

const { url, stop, ok, port } = await startInterface();
try {
  if (!ok) {
    done(1, `сервер интерфейса не поднялся на порту ${port} — vite не отвечает`);
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    // domcontentloaded, а не networkidle, и запас времени: в составе группы на
    // занятом компьютере goto с дефолтными 30 с не дожидался — проверка падала
    // ложно (docs/TESTING.md, «Нестабильные проверки»); элементы дальше ждут себя сами.
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.fill('[data-testid="composer"]', QUESTION);
    await page.click('[data-testid="send"]');
    try {
      await page.waitForFunction(
        (needle) => document.querySelector('[data-testid="feed"]').innerText.includes(needle),
        TOOL_LINE,
        { timeout: 15000 },
      );
    } catch {
      const seen = await feedText(page);
      done(1, `в ленте нет строки вызова инструмента «${TOOL_LINE}»: ${seen.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    const feed = await feedText(page);
    const wanted = [QUESTION, "Мост на месте", TOOL_LINE, "Ответ модели получен"];
    const missing = wanted.filter((text) => !feed.includes(text));
    if (missing.length) {
      done(1, `в ленте нет: ${missing.map((text) => `«${text}»`).join(", ")} — ${feed.replace(/\s+/g, " ").slice(0, 200)}`);
    }

    // Обрыв потока: та же страница, но с признаком разрыва — лента говорит о нём строкой.
    const broken = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await broken.goto(`${url}?обрыв=1`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await broken.fill('[data-testid="composer"]', QUESTION);
    await broken.click('[data-testid="send"]');
    try {
      await broken.waitForFunction(
        (needle) => document.querySelector('[data-testid="feed"]').innerText.includes(needle),
        RECONNECT,
        { timeout: 15000 },
      );
    } catch {
      const seen = await feedText(broken);
      done(1, `обрыв потока не виден строкой «${RECONNECT}»: ${seen.replace(/\s+/g, " ").slice(0, 200)}`);
    }

    // Тот же вопрос ещё раз, уже после обрыва: он обязан стать второй строкой, а не
    // заменить первый вопрос тем же идентификатором.
    await broken.fill('[data-testid="composer"]', QUESTION);
    await broken.click('[data-testid="send"]');
    try {
      await broken.waitForFunction(
        (needle) => {
          const text = document.querySelector('[data-testid="feed"]').innerText;
          return text.split(needle).length - 1 >= 2;
        },
        QUESTION,
        { timeout: 15000 },
      );
    } catch {
      const seen = await feedText(broken);
      done(1, `после обрыва второй вопрос «${QUESTION}» не стал отдельной строкой: ${seen.replace(/\s+/g, " ").slice(0, 200)}`);
    }
    done(
      0,
      `лента показала ответ, вызов инструмента «${TOOL_LINE}», строку переподключения после обрыва и оба одинаковых вопроса отдельными строками`,
    );
  } finally {
    await browser.close();
  }
} catch (error) {
  const text = String(error);
  done(1, /Executable doesn't exist|playwright install/i.test(text)
    ? `chromium не установлен: ${INSTALL}`
    : `сценарий ленты упал: ${text.split("\n")[0]}`);
} finally {
  stop();
}