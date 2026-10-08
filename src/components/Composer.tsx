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
  draft: string;
  sending: boolean;
  onDraft: (text: string) => void;
  onSend: () => void;
  /** Файлы контекста вопроса: чипы над полем ввода, уходят вместе с текстом. */
  files: ProjectFile[];
  onDetach: (path: string) => void;
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

/** Композер: «+» с меню и списком плагинов, поле ввода, «↑». Кнопка отправки
 *  выключена на пустом поле, и причина видна в её подсказке (docs/DESIGN.md,
 *  раздел 6). Подсказки про шорткат под полем нет: он назван в placeholder'е
 *  (docs/specs/2026-10-08-1-чат.md, §6). */
export function Composer({
  draft,
  sending,
  onDraft,
  onSend,
  files,
  onDetach,
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
  return (
    <div className="composer">
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
          <Button
            square
            variant="ghost"
            className={`composer__send${draft.trim() ? " composer__send--ready" : ""}`}
            data-testid="send"
            onClick={onSend}
            disabled={!draft.trim() || sending}
            title={sending ? "Отправляется" : draft.trim() ? "Отправить" : EMPTY}
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