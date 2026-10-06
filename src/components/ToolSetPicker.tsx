// Окно Tool Sets (phase2.md, раздел 11): строки сохранённых групп со списком
// их плагинов и мини-полосой скоупов Chat/Project (Project — дефолт проекта),
// внизу имя и «Save as Tool Set» — сет создаётся из подключённого сейчас.
// Крестик строки удаляет сет после подтверждения по образцу Uninstall:
// ярлык группы убирается, подключённые плагины и скоупы не трогаются.

import { useState } from "react";

import type { ToolSet, PluginScope } from "../bridge";
import type { ToolsetsState } from "../features/plugins/useToolsets";

import "./PluginsPage.css";
import "./ToolSetPicker.css";

/** Мини-полоса скоупов у строки сета: умолчание подключения и дефолт проекта. */
const SCOPES: { kind: PluginScope; label: string; title: string }[] = [
  { kind: "chat", label: "Chat", title: "Только этот чат — умолчание подключения" },
  { kind: "project", label: "Project", title: "Дефолт проекта: кнопки вернутся в каждом чате" },
];

export type ToolSetPickerProps = {
  toolsets: ToolsetsState;
  /** Клик по строке сета (или «Chat») — подключить группу этому чату. */
  onConnect: (name: string, scope?: PluginScope) => void;
  /** «Save as Tool Set» из подключённого сейчас к чату. */
  onSave: (name: string) => void;
  /** Удалить Tool Set: ярлык группы, плагины и скоупы не трогаются. */
  onRemove: (name: string) => void;
  onClose: () => void;
};

/** Окно Tool Sets: то, что открывает пункт «Tool Set» меню «+». */
export function ToolSetPicker({ toolsets, onConnect, onSave, onRemove, onClose }: ToolSetPickerProps) {
  const [name, setName] = useState("");
  /** Строка, чей крестик нажали: удаление ждёт ответа в подтверждении. */
  const [confirming, setConfirming] = useState<string | undefined>(undefined);
  return (
    <div className="toolset-picker" data-testid="toolset-picker" role="dialog" aria-label="Tool Sets">
      <div className="toolset-picker__head">
        <div className="toolset-picker__title">Tool Sets</div>
        <button
          type="button"
          className="toolset-picker__close"
          data-testid="toolset-picker-close"
          title="Закрыть Tool Sets"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      {toolsets.error ? <div className="toolset-picker__empty">Причина: {toolsets.error}</div> : null}
      {toolsets.loading ? (
        <div className="toolset-picker__empty">Читаю Tool Sets…</div>
      ) : body(toolsets, onConnect, setConfirming)}
      {confirming ? (
        <RemoveConfirm
          name={confirming}
          onYes={() => {
            onRemove(confirming);
            setConfirming(undefined);
          }}
          onNo={() => setConfirming(undefined)}
        />
      ) : null}
      <div className="toolset-picker__save">
        <input
          className="toolset-picker__name"
          data-testid="toolset-name"
          type="text"
          placeholder="Имя нового сета"
          aria-label="Имя нового сета"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="toolset-picker__save-btn"
          data-testid="toolset-save"
          title="Сохранить подключённые сейчас к чату как новый Tool Set"
          onClick={() => onSave(name)}
        >
          Save as Tool Set
        </button>
      </div>
    </div>
  );
}

/** Содержимое окна: строки сетов или слова, что их нет — создать из подключённого. */
function body(
  toolsets: ToolsetsState,
  onConnect: ToolSetPickerProps["onConnect"],
  askRemove: (name: string) => void,
) {
  if (!toolsets.toolsets.length) {
    return <div className="toolset-picker__empty">Tool Sets: нет — создайте из подключённого</div>;
  }
  return toolsets.toolsets.map((set) => (
    <ToolSetRow key={set.name} set={set} onConnect={onConnect} askRemove={askRemove} />
  ));
}

type RowProps = {
  set: ToolSet;
  onConnect: (name: string, scope?: PluginScope) => void;
  /** Крестик строки: не удалять самому — открыть подтверждение. */
  askRemove: (name: string) => void;
};

/** Строка сета: имя и плагины одной строкой, клик подключает группу. */
function ToolSetRow({ set, onConnect, askRemove }: RowProps) {
  return (
    <div
      className="toolset-row"
      data-testid="toolset-row"
      data-toolset={set.name}
      role="button"
      tabIndex={0}
      title={`Подключить Tool Set «${set.name}»`}
      onClick={() => onConnect(set.name)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onConnect(set.name);
        }
      }}
    >
      <div className="toolset-row__line">
        <span className="toolset-row__name">{set.name}</span>
        <span className="toolset-row__ids">{set.ids.join(", ")}</span>
        <button
          type="button"
          className="toolset-row__remove"
          data-testid="toolset-row-remove"
          title={`Удалить Tool Set «${set.name}»: ярлык группы, плагины не трогаются`}
          onClick={(event) => {
            event.stopPropagation();
            askRemove(set.name);
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          ✕
        </button>
      </div>
      <div
        className="toolset-row__scopes"
        data-testid="toolset-row-scopes"
        role="radiogroup"
        aria-label={`Скоуп Tool Set «${set.name}»`}
        onClick={(event) => event.stopPropagation()}
      >
        {SCOPES.map((one) => (
          <button
            key={one.kind}
            type="button"
            className="toolset-row__scope"
            data-testid={`toolset-scope-${one.kind}`}
            title={one.title}
            onClick={() => onConnect(set.name, one.kind)}
          >
            {one.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Окно подтверждения удаления по образцу UninstallConfirm (PluginsPage.tsx):
 *  ответ — Удалить или Отмена, само ничего не решает. Классы общие с ним. */
function RemoveConfirm({ name, onYes, onNo }: { name: string; onYes: () => void; onNo: () => void }) {
  return (
    <div
      className="plugins-confirm"
      data-testid="toolset-remove-confirm"
      role="alertdialog"
      aria-label={`Удаление Tool Set ${name}`}
    >
      <div className="plugins-confirm__title">Удалить Tool Set {name}?</div>
      <div className="plugins-confirm__text">
        Сет лишь ярлык группы: подключённые плагины и их скоупы останутся.
      </div>
      <div className="plugins-confirm__actions">
        <button
          type="button"
          className="plugins-confirm__btn"
          data-testid="toolset-remove-no"
          title="Ничего не удалять"
          onClick={onNo}
        >
          Отмена
        </button>
        <button
          type="button"
          className="plugins-confirm__btn plugins-confirm__btn--danger"
          data-testid="toolset-remove-yes"
          title="Убрать имя сета из списка"
          onClick={onYes}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
