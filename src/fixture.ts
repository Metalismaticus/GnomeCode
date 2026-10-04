// Фикстура ленты для страницы вне окна Tauri: та же беседа, что в tests/fixtures/chat-stream.jsonl,
// но уже свёрнутая в строки ленты. Формат движка интерфейсу не известен и знать его не должен —
// он живёт только в Rust (ADR-0001).
//
// Сценарий проверки и снимок окна видят ту же ленту, что продукт, но не трогают данные владельца.

import type { FeedEvent, RowKind } from "./bridge";

const ANSWER = "Смотрю структуру папки. Мост на месте.";

/** Строка ленты: тот же вид, что отдаёт `FeedEvent::Row` в Rust. */
const row = (id: string, kind: RowKind, text: string): FeedEvent => ({ type: "row", id, kind, text });

/** Обрыв потока виден строкой, а не пустотой — так же, как в живом мосте. */
const RECONNECT = "Поток прерван, переподключаюсь…";
const DONE = "Ответ модели получен";

type Listener = (event: FeedEvent) => void;

class Fixture {
  private listeners = new Set<Listener>();
  /** Идентификатор строки вопроса, как в живом мосте (src-tauri/src/opencode/mod.rs):
   *  обрыв потока не начинает нумерацию заново — иначе следующий вопрос занял бы id
   *  прошлой строки и лента заменила бы её вместо новой. */
  private sent = 0;
  /** Обрыв по требованию сценария: `?обрыв=1` в адресе страницы.
   * Браузер отдаёт поиск в процентной кодировке, поэтому ищем по раскодированному:
   * иначе `includes("обрыв")` никогда не сойдётся и обрыв не будет виден. */
  private readonly breaks =
    typeof location !== "undefined" && decodeURIComponent(location.search).includes("обрыв");

  play(listener: Listener): () => void {
    this.listeners.add(listener);
    // Лента не пустает при открытии: строка вызова инструмента видна сразу.
    this.emit(row("call_1", "tool", "⧗ read"));
    return () => this.listeners.delete(listener);
  }

  /** Вопрос владельца: своя строка, ответ модели дописывается по кускам. */
  push(text: string): void {
    this.sent += 1;
    const answerId = `msg_fixture_${this.sent}`;
    this.emit(row(`user-${this.sent}`, "user", text));
    this.emit(row(answerId, "assistant", ""));
    for (const part of ANSWER.split(/(?<= )/)) {
      this.emit({ type: "append", id: answerId, delta: part });
    }
    if (this.breaks) {
      this.emit(row("stream", "notice", RECONNECT));
    }
    this.emit(row("call_1", "tool", "✓ read · src/bridge.ts"));
    this.emit(row("engine", "notice", DONE));
  }

  private emit(event: FeedEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export const fixture = new Fixture();