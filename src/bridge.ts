// Единственное место вызова Tauri: приложение и UI-сценарий идут через него и не знают,
// что за окном. Вне окна Tauri (страница vite, снимок и сценарий) признака нет —
// отдаём фикстуру, чтобы проверка видела ту же ленту и то же дерево, что продукт.

import { inTauri, tauriBridge } from "./bridge/tauri";
import { fixtureBridge } from "./bridge/fixture";
import type { Bridge, Listener } from "./bridge/types";

export type {
  ApprovalDecision,
  ChatModelChoice,
  ChatRow,
  FeedEvent,
  FeedRow,
  HeldUpdate,
  Plugin,
  PluginCommand,
  PluginRun,
  PluginScope,
  PluginUpdate,
  PluginUpdateStatus,
  PluginUsage,
  ProviderRow,
  RowKind,
  RuleEntry,
  ToolSet,
  TreeNode,
  UpdatesNote,
} from "./bridge/types";
export { ENGINE_READY_NOTICES } from "./bridge/tauri";
export { chatList } from "./bridge/live";

let chosen: Bridge | undefined;

/** Мост приложения: живой в окне Tauri, фикстура на странице vite. */
export function bridge(): Bridge {
  if (!chosen) {
    chosen = inTauri() ? tauriBridge() : fixtureBridge();
  }
  return chosen;
}

/** Подписаться на строку ленты и получить отписку: эффекты React используют
 *  её как cleanup. StrictMode зовёт эффект дважды — отписка защищает и отмену
 *  до ответа моста (иначе второй effect не вышел бы из подписки), и закрытие
 *  ленты: подписчик молчит, его забота возвращается вместе с лентой. */
export function subscribeToFeed(listener: Listener): () => void {
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
    .catch(() => {
      // Лента не поднялась: подписчик молчит, её забота вернётся вместе с лентой.
    });
  return () => {
    cancelled = true;
    stop();
  };
}
