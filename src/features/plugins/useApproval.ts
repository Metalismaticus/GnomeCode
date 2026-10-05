// Окно одобрения вызова плагина: что спросили и что на это ответили.
// Слой прав решает до окна (`bridge.runPlugin`), ответ уходит мосту
// (`bridge.decidePlugin`); закрытое без ответа окно — не ответ: вызов
// остаётся неисполненным и спросит при следующем клике, как и после
// «Отказать» (docs/SPEC/plugins.md, «Утверждённый UX одобрения»).

import { useCallback, useState } from "react";

import { bridge, type ApprovalDecision, type Plugin } from "../../bridge";

/** Чем нажали кнопку команды: окно одобрения ждёт ответ на этот вызов. */
export type PendingApproval = {
  plugin: string;
  label: string;
  description: string;
  /** Полное имя команды у движка — с ним слой прав знает правило чата. */
  command: string;
};

/** Что спросить окном и что отвечает владелец: решение сохраняет слой прав. */
export function useApproval() {
  const [asked, setAsked] = useState<PendingApproval | undefined>(undefined);

  /** Клик по кнопке команды: разрешённое правило исполняется без окна —
   *  строка запуска уже в ленте; чувствительное возвращается окну. */
  const run = useCallback(async (plugin: Plugin, command: Plugin["commands"][number]) => {
    try {
      const answer = await bridge().runPlugin(plugin.id, command.name, command.label);
      if (answer.kind === "approval") {
        setAsked({
          plugin: plugin.id,
          label: command.label,
          description: command.description || plugin.id,
          command: command.name,
        });
      }
    } catch {
      // Слой прав не ответил — окно не открывать: вызов не ушёл и спросит снова.
    }
  }, []);

  /** Ответ владельца: «для этого чата» слой прав запоминает, отказ — строка
   *  в ленте; в обоих случаях окно свою работу сделало. */
  const decide = useCallback(
    async (decision: ApprovalDecision) => {
      const held = asked;
      setAsked(undefined);
      if (!held) {
        return;
      }
      await bridge().decidePlugin(held.plugin, held.command, held.label, decision);
    },
    [asked],
  );

  /** Закрытие окна без ответа: вызов спросит снова при следующем клике. */
  const dismiss = useCallback(() => setAsked(undefined), []);

  return { asked, run, decide, dismiss };
}
