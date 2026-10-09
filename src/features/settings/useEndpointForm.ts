// Форма своего endpoint'а (docs/BATCH.md, пункт 1 партии): имя + база URL
// (+ ключ) — узор раскрытого поля ключа (useKeyForm): одна форма на раздел,
// статус спрашивается сохранением, приём закрывает форму, отказ оставляет
// введённое. Ключ уходит мосту в хранилище ОС: страница его не хранит.
import { useCallback, useState } from "react";

import type { SettingsState } from "./useSettings";

/** Причина отказа моста строкой — без служебной обвязки ошибок. */
const reasonText = (reason: unknown): string =>
  String(reason).replace(/^Error: /, "").replace(/^"|"$/g, "");

export const ENDPOINT_WAITING = "Проверяю endpoint…";

export type EndpointFormState = {
  /** Форма открыта. */
  open: boolean;
  name: string;
  baseUrl: string;
  key: string;
  /** Строка статуса: проверка, приём или отказ; пусто — статусных строк нет. */
  status: string;
  /** Цвет статуса: dim — сохраняется, success — принят, danger — отказ. */
  tone: "dim" | "success" | "danger";
  openForm: () => void;
  setName: (text: string) => void;
  setBaseUrl: (text: string) => void;
  setKey: (text: string) => void;
  close: () => void;
  save: () => Promise<void>;
};

/** Драфт формы endpoint'а: открытие, сохранение и отказ. */
export function useEndpointForm(settings: SettingsState): EndpointFormState {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState("");
  const [tone, setTone] = useState<"dim" | "success" | "danger">("dim");

  const openForm = useCallback(() => {
    setOpen(true);
    setName("");
    setBaseUrl("");
    setKey("");
    setStatus("");
    setTone("dim");
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setName("");
    setBaseUrl("");
    setKey("");
    setStatus("");
  }, []);

  /** Сохранение: строка «Проверяю endpoint…» → приём или отказ. Тихий рестарт
   *  движка делает мост — после него модели endpoint'а уже в переключателе. */
  const save = useCallback(async () => {
    setTone("dim");
    setStatus(ENDPOINT_WAITING);
    try {
      await settings.addEndpoint(name, baseUrl, key);
      setStatus("Endpoint принят — модели в переключателе чата");
      setTone("success");
      setOpen(false);
      setName("");
      setBaseUrl("");
      setKey("");
    } catch (reason) {
      setStatus(`Не принято: ${reasonText(reason)}`);
      setTone("danger");
    }
  }, [name, baseUrl, key, settings]);

  return { open, name, baseUrl, key, status, tone, openForm, setName, setBaseUrl, setKey, close, save };
}
