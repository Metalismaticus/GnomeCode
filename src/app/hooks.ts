import { useCallback, useEffect, useState } from "react";

import { subscribeToFeed, type ChatModelChoice } from "../bridge";
import {
  chatTitleOf,
  loadState,
  patchState,
  DEFAULT_MODEL,
  type WindowState,
} from "../appstate";
import { MODEL_BADGE } from "../components/chat/overlay";

/** Состояние прошлого запуска — один запрос при старте. StrictMode зовёт эффект
 *  дважды: подписка первого размывается, второй ответ перезапишет те же поля и
 *  двойной записи не оставит. */
export function useSavedState(apply: (saved: WindowState) => void): void {
  useEffect(() => {
    let alive = true;
    loadState().then((saved) => {
      if (alive && saved) {
        apply(saved);
      }
    });
    return () => {
      alive = false;
    };
  }, [apply]);
}

/** Оверлей правой панели закрыт по умолчанию на любой ширине («тихий хром», §6):
 *  открытый закрывается по Esc и клику снаружи. Свои клики панель переживает, как и
 *  жесты, которые панель открыли или которыми пользуются поверх неё: «⋯», его меню
 *  (Esc там закрывает меню и возвращает фокус кнопке — спека §5/§12), бейдж модели и
 *  источники ленты (файл раскрывает панель, плагин ведёт в раздел). */
export function usePanelOverlay(panelOpen: boolean, close: (open: boolean) => void): void {
  useEffect(() => {
    if (!panelOpen) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      // Меню «⋯» открыто — Esc его жест: сперва закрывается меню, панель — следующим.
      if (event.key === "Escape" && !document.querySelector(".header-menu")) {
        close(false);
      }
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (
        target?.closest(".context") ||
        target?.closest('[data-testid="header-more"]') ||
        target?.closest(".header-menu") ||
        target?.closest(MODEL_BADGE) ||
        target?.closest('[data-testid="source-file"]') ||
        target?.closest('[data-testid="source-plugin"]')
      ) {
        return;
      }
      close(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [panelOpen, close]);
}

/** Событие `reset` ленты (новый чат): титул и время чата сбрасываются вместе с
 *  лентой — следующий вопрос станет титулом нового чата. StrictMode зовёт
 *  эффект дважды: двойной reset те же поля не портит. Подписка и её отписка —
 *  один шаг моста (bridge.subscribeToFeed), повторов в хуках нет. */
export function useFeedReset(reset: () => void): void {
  useEffect(
    () =>
      subscribeToFeed((event) => {
        if (event.type === "reset") {
          reset();
        }
      }),
    [reset],
  );
}

/** Титул и начало чата и модели (своя у чата, по умолчанию — настроек): один
 *  источник для шапки, сайдбара, страницы настроек и запроса движку. Выбор
 *  бейджа сразу показывается и уходит в состояние окна; выбор дефолта меняет
 *  только бейдж чата без своей модели (спека настроек, «Решено за вас» №7). */
export function useChatModels(): {
  title: string;
  time: number | null;
  model: string;
  defaultModel: string;
  remember: (question: string) => void;
  choose: (choice: ChatModelChoice) => void;
  chooseDefault: (choice: ChatModelChoice) => void;
  applySaved: (saved: WindowState) => void;
  /** «Новый чат»: титул и время чата сбрасываются вместе с лентой. */
  dropChat: () => void;
} {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState<number | null>(null);
  /** Модель текущего чата: из состояния окна; нет — модель по умолчанию
   *  настроек. Бейдж шапки и запрос движку идут одной строкой. */
  const [ownModel, setOwnModel] = useState<string | null>(null);
  /** Модель по умолчанию для новых чатов: настройка страницы «Настройки». */
  const [defaultModel, setDefaultModel] = useState<string>(DEFAULT_MODEL);

  /** Титул чата: первый вопрос. Повторные вопросы титул не меняют; время начала
   *  чата пишется тем же патчем — группы дат сайдбара строятся по нему. */
  const remember = useCallback(
    (question: string) => {
      if (title) {
        return;
      }
      const named = chatTitleOf(question);
      const now = Date.now();
      setTitle(named);
      setTime(now);
      void patchState({ chatTitle: named, chatTime: now });
    },
    [title],
  );

  /** «Выбрать» в панели сравнения: бейдж шапки обновляется сразу, выбор идёт в
   *  состояние окна — запрос движку несёт идентификатор модели. */
  const choose = useCallback((choice: ChatModelChoice) => {
    setOwnModel(choice.name);
    void patchState({ chatModel: choice });
  }, []);

  /** «По умолчанию» в панели настроек: дефолт меняется сразу; бейдж обновляется
   *  только у чата без своей модели — чат со своей моделью не затрагивается. */
  const chooseDefault = useCallback((choice: ChatModelChoice) => {
    setDefaultModel(choice.name);
    void patchState({ defaultModel: choice });
  }, []);

  /** Модель, титул и время из прошлого запуска; папку и тему берёт App рядом. */
  const applySaved = useCallback((saved: WindowState) => {
    if (saved.chatTitle) {
      setTitle(saved.chatTitle);
    }
    if (saved.chatModel) {
      setOwnModel(saved.chatModel.name);
    }
    if (saved.defaultModel) {
      setDefaultModel(saved.defaultModel.name);
    }
    if (saved.chatTime) {
      setTime(saved.chatTime);
    }
  }, []);

  /** «Новый чат»: титул и время сбрасываются — первый вопрос станет титулом
   *  нового чата; модель чата не трогается (выбранная модель остаётся и у
   *  нового чата, сброс только в настройках по умолчанию). */
  const dropChat = useCallback(() => {
    setTitle("");
    setTime(null);
  }, []);

  return {
    title,
    time,
    model: ownModel ?? defaultModel,
    defaultModel,
    remember,
    choose,
    chooseDefault,
    applySaved,
    dropChat,
  };
}
