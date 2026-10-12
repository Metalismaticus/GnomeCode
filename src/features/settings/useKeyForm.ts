// Раскрытое поле ключа провайдера (docs/specs/2026-10-06-12-nastrojki.md,
// «Раскрытое поле ключа»): поле одно на страницу — после «Задать/Заменить»
// статус проверки сразу спрашивает провайдера, приём закрывает поле, отказ
// оставляет его с введённым текстом. Секрет хранит мост в хранилище ОС:
// страница его не возвращает и не сохраняет (спека, Решено №3).
import { useCallback, useState } from "react";

import { params } from "../../viewparams";
import type { SettingsState } from "./useSettings";

/** Для снимка «настройки-ключ» раскрыто поле ключа у Anthropic. */
const SNAPSHOT_PROVIDER = "anthropic";
/** Строка отказа снимка «настройки-ключ-ошибка»: поле с ответом провайдера. */
const SNAPSHOT_REJECT = "Не принято: провайдер отклонил ключ: 401 unauthorized";
/** Признак приёма — провайдер отвечает списком моделей. */
const ACCEPTED = "Ключ принят — провайдер отдаёт";
export const WAITING = "Запрашиваю провайдера…";

/** Причина отказа моста или провайдера строкой — без служебной обвязки ошибок. */
const reasonText = (reason: unknown): string =>
  String(reason).replace(/^Error: /, "").replace(/^"|"$/g, "");

export type KeyFormState = {
  /** Id провайдера с раскрытым полем; null — поле закрыто. */
  keyForm: string | null;
  /** Введённый, но не сохранённый текст поля. */
  draft: string;
  /** Строка статуса: сохранение, приём или отказ; пусто — статусных строк нет. */
  status: string;
  /** Цвет статуса: dim — сохраняется, success — принят, danger — отказ. */
  tone: "dim" | "success" | "danger";
  /** Открыть поле у провайдера: чистое, без статуса прошлой пробы. */
  open: (provider: string) => void;
  /** Отмена и клик снаружи: поле закрыто, введённый текст не задерживается. */
  close: () => void;
  /** Сохранить ключ: мост пишет хранилище ОС и тихо перезапускает движок. */
  save: () => Promise<void>;
  /** Убрать ключ: «нет записи» — уже чисто, а не ошибка. */
  remove: (provider: string) => void;
  /** Правка поля: каждая кнопка и отказ держат введённое до решения. */
  setDraft: (text: string) => void;
};

/** Драфт поля ключа страницы настроек: открытие, сохранение и отказ. */
export function useKeyForm(settings: SettingsState): KeyFormState {
  const [keyForm, setKeyForm] = useState<string | null>(
    params.feed === "настройки-ключ" || params.feed === "настройки-ключ-ошибка" ? SNAPSHOT_PROVIDER : null,
  );
  const [draft, setDraft] = useState("");
  /** Строка статуса ключа: сохранение, приём, отказ (спека «Состояния экрана»). */
  const [status, setStatus] = useState<string>(params.feed === "настройки-ключ-ошибка" ? SNAPSHOT_REJECT : "");
  const [tone, setTone] = useState<"dim" | "success" | "danger">(
    params.feed === "настройки-ключ-ошибка" ? "danger" : "dim",
  );

  const close = useCallback(() => {
    setKeyForm(null);
    setDraft("");
    setStatus("");
  }, []);

  const open = useCallback((provider: string) => {
    setKeyForm(provider);
    setDraft("");
    setStatus("");
    setTone("dim");
  }, []);

  /** Сохранение ключа: строка «Запрашиваю провайдера…» → приём или отказ.
   *  Рестарт движка делает мост, экран его не показывает (Решено №5). */
  const save = useCallback(async () => {
    if (!keyForm) {
      return;
    }
    const provider = keyForm;
    setTone("dim");
    setStatus(WAITING);
    try {
      const row = await settings.saveKey(provider, draft);
      if (row.models > 0) {
        setStatus(`${ACCEPTED} ${row.models} моделей`);
        setTone("success");
        setKeyForm(null);
        setDraft("");
      } else {
        setStatus("Не принято: провайдер не отдал список моделей");
        setTone("danger");
      }
    } catch (reason) {
      setStatus(`Не принято: ${reasonText(reason)}`);
      setTone("danger");
    }
  }, [keyForm, draft, settings]);

  const remove = useCallback(
    async (provider: string) => {
      try {
        await settings.removeKey(provider);
      } catch (reason) {
        setStatus(`Не принято: ${reasonText(reason)}`);
        setTone("danger");
      }
    },
    [settings],
  );

  return { keyForm, draft, status, tone, open, close, save, remove, setDraft };
}
