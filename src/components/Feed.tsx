import type { FeedRow } from "../bridge";

import "./Feed.css";

/** Строка о состоянии движка видна своим цветом: потеря и возврат — не тихие заметки. */
const TONE: Record<string, string> = {
  "Сервер OpenCode недоступен, перезапускаю…": "feed__row--down",
  "Сервер OpenCode снова отвечает": "feed__row--back",
  "Сообщение не ушло": "feed__row--down",
};

/** Лента: строки по порядку, вид строки — по её роли в разговоре. */
export function Feed({ rows, error }: { rows: FeedRow[]; error: string }) {
  return (
    <>
      {rows.map((row) => {
        const tone = TONE[Object.keys(TONE).find((text) => row.text.startsWith(text)) ?? ""] ?? "";
        return (
          <div
            key={row.id}
            className={`feed__row feed__row--${row.kind}${tone ? ` ${tone}` : ""}`}
            data-kind={row.kind}
          >
            {row.text || "…"}
          </div>
        );
      })}
      {error ? <div className="feed__notice">{error}</div> : null}
    </>
  );
}