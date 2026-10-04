// Общие помощники UI-сценариев Playwright: подъём страницы интерфейса на свободном
// порту, ожидание её ответа и выход с кодом. Одно место на всех сценариев —
// иначе каждый повторяет свой `freePort` и `waiting` (docs/TESTING.md, «Полигон»).
//
// Итог сценария — код возврата и последняя строка вывода (tests/lib/runner_lib.py).
import { spawn } from "node:child_process";
import { createServer } from "node:net";

export const INSTALL = "npx playwright install chromium";

/** Итог сценария: напечатать строку и выйти — вызывающий не успевает дописать. */
export const done = (code, line) => {
  console.log(line);
  process.exit(code);
};

/** Порт, который сейчас свободен: сервер интерфейса не должен делить его с `tauri dev`. */
export const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = createServer().on("error", reject).listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

/** Ждём, пока страница начнёт отвечать; `false` — не поднялась за отведённое время. */
export const waiting = async (url, seconds) => {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    try {
      await fetch(url);
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  return false;
};

/** Поднять страницу интерфейса на своём порту. `false` — vite не отвечает. */
export const startInterface = async () => {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}/`;
  // npx на Windows — это .cmd, и Node 22 не запускает его без оболочки; аргументы свои, не пользовательские.
  const server = spawn("npx", ["vite", "--port", String(port), "--strictPort", "--host", "127.0.0.1"], {
    stdio: "ignore",
    shell: true,
  });
  const stop = () => server.kill();
  process.on("exit", stop);
  if (!(await waiting(url, 60))) {
    stop();
    return { url, stop, ok: false, port };
  }
  return { url, stop, ok: true, port };
};