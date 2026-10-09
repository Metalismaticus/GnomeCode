import type { ReactNode } from "react";

import type { ChatModelChoice } from "../../bridge";
import type { ApprovalState } from "../../features/plugins/useApproval";
import type { PluginsState } from "../../features/plugins/usePlugins";
import type { ProjectState } from "../../features/project/useProject";

/** Что открыто в чате: меню «⋯», меню «+», список плагинов, окно Tool Sets,
 *  каталог, панель «Plugins in this chat», панель сравнения или ничего. Окно
 *  одобрения — не здесь: его открытость держит `useApproval`; сводку прав
 *  установки держит `pending` — она живёт и при открытом каталоге. */
export type Overlay = "none" | "more" | "menu" | "plugins" | "toolsets" | "catalog" | "chat-plugins" | "compare";

/** Свойства ChatView — публичный вход компонента: их держит и передаёт App,
 *  единственный импортёр. */
export type ChatViewProps = {
  title: string;
  onTogglePanel: () => void;
  panelOpen: boolean;
  /** Кластер кнопок окна: тема + свернуть/развернуть/закрыть — шапка чата,
   *  единственный дом кластера на любой ширине («тихий хром», §4). */
  cluster: ReactNode;
  /** Файлы контекста: уходят с вопросом, чипы живут в композере. */
  project: ProjectState;
  /** Первый вопрос владельца становится титулом чата (src/appstate.ts). */
  onFirstQuestion?: (question: string) => void;
  /** Право чата на файлы: выключено — вопрос уходит без файлов, чипы же
   *  остаются на экране. Тумблер правой панели переключает его (App). */
  fsAllow: boolean;
  /** Клик по источнику-плагину: раздел «Плагины» открывается вместо чата. */
  onOpenPluginsPage: () => void;
  /** Пункт «Настройки» меню «⋯»: та же страница, что шестерёнка сайдбара. */
  onOpenSettings: () => void;
  /** Движок не отвечает: команды меню «⋯» выключены с причиной на самом пункте. */
  engineDown: boolean;
  /** Модель текущего чата: бейдж шапки и строка «Выбрана». */
  model: string;
  /** «Выбрать» в панели сравнения: модель чата меняется и запоминается. */
  onChooseModel: (choice: ChatModelChoice) => void;
  /** Плагины чата — общие с правой панелью (App держит одно состояние). */
  plugins: PluginsState;
  /** Окно одобрения вызова — общее с правой панелью. */
  approval: ApprovalState;
  /** Счётчики приветственной сборки: длина списков чатов и проектов. */
  counts: { chats: number; projects: number };
  /** Карточка «Новый чат» приветствия: тот же ход, что кнопка сайдбара. */
  onNewChat: () => void;
  /** Пикер, которого позвала кнопка «Подключить» правой панели: открытие держит
   *  App (панель — сосед чата), позиция — оверлей области чата, как у панели
   *  сравнения: из любой двери окно видно целиком, без отрезанной правой части. */
  panelPickerOpen: boolean;
  /** Закрыть пикер двери панели: Esc, клик снаружи или подключение. */
  onClosePanelPicker: () => void;
};
