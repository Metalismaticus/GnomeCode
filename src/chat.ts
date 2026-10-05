// Лента чата: события моста сворачиваются в строки. Здесь только порядок строк и
// правило «дописывать к существующей»; формат событий движка не известен —
// она живёт в Rust (ADR-0001).

import { useCallback, useEffect, useState } from "react";

import { bridge, type FeedEvent, type FeedRow } from "./bridge";

/** Одна строка ленты: событие `append` дописывает к строке с тем же id, а `row` с тем же
 *  id заменяет её — строка вызова инструмента одна и меняет вид по ходу работы. Поэтому
 *  мост (src-tauri/src/opencode/mod.rs) не переиспользует идентификатор строки вопроса
 *  после обрыва: иначе новый вопрос занял бы id прошлого и заменил его. */
export function foldFeed(events: FeedEvent[]): FeedRow[] {
  const rows: FeedRow[] = [];
  const index = new Map<string, number>();
  for (const event of events) {
    if (event.type === "row") {
      const at = index.get(event.id);
      if (at === undefined) {
        index.set(event.id, rows.length);
        rows.push({ id: event.id, kind: event.kind, text: event.text });
        continue;
      }
      rows[at] = { id: event.id, kind: event.kind, text: event.text };
      continue;
    }
    const at = index.get(event.id);
    if (at === undefined) {
      // Дельта без своей строки — потерянное событие: показываем как отдельную строку,
      // чтобы текст не исчез молча.
      index.set(event.id, rows.length);
      rows.push({ id: event.id, kind: "assistant", text: event.delta });
      continue;
    }
    rows[at] = { ...rows[at], text: rows[at].text + event.delta };
  }
  return rows;
}

/** Лента приложения: подписка на мост и отправка вопроса. */
export function useFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    // Каждая подписка получает свою функцию-обёртку: React StrictMode подписывается дважды,
    // и один и тот же обработчик в наборе схлопывается в одну запись — отписка убила бы обе.
    const listener = (event: FeedEvent) => setEvents((known) => [...known, event]);
    let stop: () => void = () => {};
    let cancelled = false;
    bridge()
      .listen(listener)
      .then((off) => {
        if (cancelled) {
          off();
          return;
        }
        stop = off;
      })
      .catch((reason: unknown) => setError(String(reason)));
    return () => {
      cancelled = true;
      stop();
    };
  }, []);

  const send = useCallback(async (text: string, files: string[] = []) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    try {
      await bridge().send(trimmed, files);
    } catch (reason: unknown) {
      // Ошибка отправки видна в ленте словами, а не молчаливой пустотой.
      setEvents((known) => [
        ...known,
        { type: "row", id: "send", kind: "notice", text: `Сообщение не ушло: ${String(reason)}` },
      ]);
    }
  }, []);

  return { rows: foldFeed(events), error, send };
}