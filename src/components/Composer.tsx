import type { CatalogEntry } from "../catalog";
import type { PluginScope } from "../bridge";
import type { CatalogState } from "../features/plugins/useCatalog";
import type { PluginsState } from "../features/plugins/usePlugins";
import type { ToolsetsState } from "../features/plugins/useToolsets";
import type { ProjectFile } from "../features/project/useProject";
import { AddMenu } from "./AddMenu";
import { Button } from "./Button";
import { CatalogPicker } from "./CatalogPicker";
import { FileChips } from "./FileChips";
import { PluginPicker } from "./PluginPicker";
import { ToolSetPicker } from "./ToolSetPicker";

import "./Composer.css";

const PLACEHOLDER = "Напишите сообщение… (Ctrl + Enter — отправить)";
const EMPTY = "Напишите сообщение — отправлять нечего";

export type ComposerProps = {
  /** Герой нового чата: тот же композер крупным полем внизу окна (правка
   *  владельца 2026-10-10, спека приветствия §16) — слот общий с разговором,
   *  ширина на колонке чтения, крупнее только поле; всплывающие якорятся к
   *  самому композеру, как у строки. Фокус в поле героя ведёт ChatView —
   *  он знает ход владельца. */
  hero?: boolean;
  draft: string;
  sending: boolean;
  onDraft: (text: string) => void;
  onSend: () => void;
  /** Файлы контекста вопроса: чипы одной линией над полем, уходят вместе с текстом. */
  files: ProjectFile[];
  onDetach: (path: string) => void;
  /** Модель чата: тихая пилюля в строке поля — второй вход в сравнение. */
  model: string;
  /** Панель сравнения открыта: пилюля держит нажатие, как бейдж шапки. */
  compareOpen: boolean;
  /** Клик по пилюле модели: та же панель сравнения, что у бейджа шапки. */
  onToggleCompare: () => void;
  /** Плагины чата: меню «+» показывает, что подключено, и ведёт к списку. */
  plugins: PluginsState;
  /** Tool Sets: окно сохранённых групп открывает пункт «Tool Set» меню «+». */
  toolsets: ToolsetsState;
  /** Каталог «Available» и его открытость — то, что открывает «Browse plugins…». */
  catalog: CatalogState;
  /** Открыто ли меню «+», список плагинов, окно сетов и каталог. */
  addOpen: boolean;
  pickerOpen: boolean;
  toolsetsOpen: boolean;
  catalogOpen: boolean;
  onToggleAdd: () => void;
  onConnectPlugins: () => void;
  onBrowsePlugins: () => void;
  onClosePlugins: () => void;
  onToolsets: () => void;
  /** Клик по Install карточки каталога: открыть сводку прав. */
  onInstallCatalog: (entry: CatalogEntry) => void;
  /** Клик по строке сета (или его полосе скоупов) — подключить группу. */
  onConnectToolset: (name: string, scope?: PluginScope) => void;
  /** «Save as Tool Set» из подключённого сейчас к чату. */
  onSaveToolset: (name: string) => void;
};

/** Тихая пилюля модели: тот же вход в сравнение, что бейдж шапки, но без акцента —
 *  акцентным пятном строки остаётся кнопка отправки (спека «тихого хрома», §7). */
function ModelPill({ model, open, onToggle }: { model: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="composer__model"
      data-testid="composer-model"
      title="Сравнить модели и выбрать для этого чата"
      aria-pressed={open}
      onClick={onToggle}
    >
      {model}
    </button>
  );
}

/** Композер-строка («тихий хром», §7): «+», поле, модель мелко, место отправки —
 *  один ряд. «↑» на пустом поле не видно вовсе, но место её зарезервировано —
 *  строка не прыгает; с текстом — появляется, при отправке — «…». Подсказки про
 *  шорткат под полем нет: он назван в placeholder'е. Композер один и живёт внизу
 *  окна всегда: в пустом чате это герой — крупное поле ≥ 96 px на той же колонке
 *  чтения (правка владельца 2026-10-10, спека приветствия §16); первый вопрос не
 *  перемонтирует его, фокус и черновик остаются в том же поле. */
export function Composer({
  hero = false,
  draft,
  sending,
  onDraft,
  onSend,
  files,
  onDetach,
  model,
  compareOpen,
  onToggleCompare,
  plugins,
  toolsets,
  catalog,
  addOpen,
  pickerOpen,
  toolsetsOpen,
  catalogOpen,
  onToggleAdd,
  onConnectPlugins,
  onBrowsePlugins,
  onClosePlugins,
  onToolsets,
  onConnectToolset,
  onSaveToolset,
  onInstallCatalog,
}: ComposerProps) {
  const hasText = Boolean(draft.trim());
  return (
    <div className={hero ? "composer composer--hero" : "composer"}>
      <div className="composer__column">
        <FileChips files={files} onDetach={onDetach} />
        <div className="composer__box">
          <Button
            square
            variant="ghost"
            className="composer__add"
            data-testid="composer-add"
            title="Добавить"
            aria-expanded={addOpen || pickerOpen || toolsetsOpen || catalogOpen}
            onClick={onToggleAdd}
          >
            +
          </Button>
          <textarea
            className="composer__input"
            data-testid="composer"
            placeholder={PLACEHOLDER}
            value={draft}
            rows={1}
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.ctrlKey) {
                event.preventDefault();
                onSend();
              }
            }}
          />
          <ModelPill model={model} open={compareOpen} onToggle={onToggleCompare} />
          <Button
            square
            variant="ghost"
            className={`composer__send${hasText || sending ? "" : " composer__send--hidden"}`}
            data-testid="send"
            onClick={onSend}
            disabled={!hasText || sending}
            title={sending ? "Отправляется" : hasText ? "Отправить" : EMPTY}
          >
            {sending ? "…" : "↑"}
          </Button>
        </div>
      </div>
      {pickerOpen ? (
        <PluginPicker plugins={plugins} onBrowse={onBrowsePlugins} onClose={onClosePlugins} />
      ) : null}
      {toolsetsOpen ? (
        <ToolSetPicker
          toolsets={toolsets}
          onConnect={onConnectToolset}
          onSave={onSaveToolset}
          onRemove={toolsets.remove}
          onClose={onClosePlugins}
        />
      ) : null}
      {catalogOpen ? (
        <CatalogPicker catalog={catalog} onInstall={onInstallCatalog} onClose={onClosePlugins} />
      ) : null}
      <AddMenu
        open={addOpen && !pickerOpen && !toolsetsOpen && !catalogOpen}
        onClose={onClosePlugins}
        plugins={plugins}
        files={files}
        onConnect={onConnectPlugins}
        onToolsets={onToolsets}
      />
    </div>
  );
}
