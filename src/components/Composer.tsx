import type { CatalogEntry } from "../catalog";
import type { CatalogState } from "../features/plugins/useCatalog";
import type { PluginsState } from "../features/plugins/usePlugins";
import type { ProjectFile } from "../features/project/useProject";
import { AddMenu } from "./AddMenu";
import { Button } from "./Button";
import { CatalogPicker } from "./CatalogPicker";
import { FileChips } from "./FileChips";
import { PluginPicker } from "./PluginPicker";

import "./Composer.css";

const HINT = "Enter — перенос строки · Ctrl + Enter — отправить";
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
  /** Каталог «Available» и его открытость — то, что открывает «Browse plugins…». */
  catalog: CatalogState;
  /** Открыто ли меню «+», список плагинов и каталог. */
  addOpen: boolean;
  pickerOpen: boolean;
  catalogOpen: boolean;
  onToggleAdd: () => void;
  onConnectPlugins: () => void;
  onBrowsePlugins: () => void;
  onClosePlugins: () => void;
  /** Клик по Install карточки каталога: открыть сводку прав. */
  onInstallCatalog: (entry: CatalogEntry) => void;
};

/** Композер: «+» с меню и списком плагинов, поле ввода, «↑» и подсказка под ним.
 *  Кнопка отправки выключена на пустом поле, и причина видна в её подсказке
 *  (docs/DESIGN.md, раздел 6). */
export function Composer({
  draft,
  sending,
  onDraft,
  onSend,
  files,
  onDetach,
  plugins,
  catalog,
  addOpen,
  pickerOpen,
  catalogOpen,
  onToggleAdd,
  onConnectPlugins,
  onBrowsePlugins,
  onClosePlugins,
  onInstallCatalog,
}: ComposerProps) {
  return (
    <div className="composer">
      <FileChips files={files} onDetach={onDetach} />
      <div className="composer__box">
        <Button
          square
          variant="ghost"
          className="composer__add"
          data-testid="composer-add"
          title="Добавить"
          aria-expanded={addOpen || pickerOpen || catalogOpen}
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
      <div className="composer__hint">{HINT}</div>
      {pickerOpen ? (
        <PluginPicker plugins={plugins} onBrowse={onBrowsePlugins} onClose={onClosePlugins} />
      ) : null}
      {catalogOpen ? (
        <CatalogPicker catalog={catalog} onInstall={onInstallCatalog} onClose={onClosePlugins} />
      ) : null}
      <AddMenu
        open={addOpen && !pickerOpen && !catalogOpen}
        onClose={onClosePlugins}
        plugins={plugins}
        files={files}
        onConnect={onConnectPlugins}
      />
    </div>
  );
}