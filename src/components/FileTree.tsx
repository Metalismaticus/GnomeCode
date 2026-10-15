import { useEffect, useState } from "react";

import { bridge, type GitStatus, type SymbolRow, type TreeNode } from "../bridge";
import type { ProjectState, TreeRow } from "../features/project/useProject";

import "./FileTree.css";

/** Вкладки правой панели: файлы, символы приложенных файлов, git-статус
 *  (пункты «позже» доделаны — запрос владельца 15.10 «доделывай все»). */
const TABS = ["Файлы", "Символы", "Git"];

const INDENT = 12;

export type FileTreeProps = {
  project: ProjectState;
  /** Активная вкладка: дерево живёт под «Файлы», переключение не убирает его. */
  tab: string;
  onTab: (name: string) => void;
};

/** Дерево файлов проекта в правой панели: папка раскрывается по стрелке, клик по файлу
 *  кладёт его в контекст вопроса. Содержимое папки приходит одним вызовом на папку. */
export function FileTree({ project, tab, onTab }: FileTreeProps) {
  const attached = project.files.map((file) => file.path);
  return (
    <div className="context__section">
      <div className="context__tabs" data-testid="context-tabs" role="tablist">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={name === tab}
            className={`context__tab${name === tab ? " context__tab--on" : ""}`}
            onClick={() => onTab(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="tree" data-testid="tree" role="tree" aria-label="Файлы проекта">
        {tab === "Файлы" ? (
          <>
            {project.error ? <div className="tree__later">{project.error}</div> : null}
            {!project.top.length && !project.error ? (
              <div className="tree__later">{project.root ? "Папка пуста" : "Папка не выбрана"}</div>
            ) : null}
            {project.rows.map((row) => (
              <TreeLine
                key={row.node.path}
                row={row}
                selected={attached.includes(row.node.path)}
                flash={project.highlight === row.node.path}
                onToggle={project.toggle}
                onAttach={project.attach}
              />
            ))}
          </>
        ) : tab === "Символы" ? (
          <SymbolsTab files={attached} onReveal={project.reveal} />
        ) : (
          <GitTab onReveal={project.reveal} />
        )}
      </div>
    </div>
  );
}

/** Вкладка «Символы»: функции, классы и структуры приложенных файлов —
 *  лёгкий разбор мостом (project/symbols.rs). Клик — файл подсвечен в дереве. */
function SymbolsTab({ files, onReveal }: { files: string[]; onReveal: (path: string) => void }) {
  const [symbols, setSymbols] = useState<SymbolRow[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!files.length) {
      setSymbols([]);
      return;
    }
    let alive = true;
    bridge()
      .projectSymbols(files)
      .then((rows) => {
        if (alive) {
          setSymbols(rows);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (alive) {
          setError(String(reason));
        }
      });
    return () => {
      alive = false;
    };
  }, [files.join("|")]);

  if (error) {
    return <div className="tree__later">{error}</div>;
  }
  if (symbols === null) {
    return <div className="tree__later">Читаю символы…</div>;
  }
  if (!symbols.length) {
    return (
      <div className="tree__later" data-testid="symbols-empty">
        Прикрепите файлы к вопросу — символы берём из них.
      </div>
    );
  }
  return (
    <div data-testid="symbols-list">
      {symbols.map((one) => (
        <button
          key={`${one.file}:${one.line}:${one.name}`}
          type="button"
          className="tree__sym"
          data-testid="tree-symbol"
          title={`${one.file}:${one.line} — показать в дереве`}
          onClick={() => onReveal(one.file)}
        >
          <span className="tree__sym-name">{one.name}</span>
          <span className="tree__sym-kind">{one.kind}</span>
          <span className="tree__sym-line">{one.line}</span>
        </button>
      ))}
    </div>
  );
}

/** Вкладка «Git»: ветка, изменённые файлы и последние коммиты репозитория
 *  проекта (project/git.rs). Клик по файлу — подсветка в дереве. */
function GitTab({ onReveal }: { onReveal: (path: string) => void }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    bridge()
      .projectGit()
      .then((held) => {
        if (alive) {
          setStatus(held);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (alive) {
          setError(String(reason));
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (error) {
    return <div className="tree__later" data-testid="git-error">{error}</div>;
  }
  if (status === null) {
    return <div className="tree__later">Читаю git…</div>;
  }
  return (
    <div data-testid="git-status">
      <div className="tree__branch" data-testid="git-branch">
        {status.branch || "без ветки"}
      </div>
      {status.changes.length ? (
        status.changes.map((one) => (
          <button
            key={one.path}
            type="button"
            className="tree__sym"
            data-testid="git-change"
            title={`${one.status} — показать в дереве`}
            onClick={() => onReveal(one.path)}
          >
            <span className="tree__sym-kind">{one.status}</span>
            <span className="tree__sym-name">{one.path}</span>
          </button>
        ))
      ) : (
        <div className="tree__later">Изменений нет — рабочая папка чиста.</div>
      )}
      {status.commits.map((one) => (
        <div key={one.hash} className="tree__commit" data-testid="git-commit">
          <span className="tree__sym-kind">{one.hash}</span>
          <span className="tree__sym-name">{one.subject}</span>
        </div>
      ))}
    </div>
  );
}

/** Строка дерева: папка раскрывается стрелкой, файл — кликом по строке.
 *  Подсветка (`flash`) — файл открыт из блока «Sources used», не из дерева. */
function TreeLine({
  row,
  selected,
  flash,
  onToggle,
  onAttach,
}: {
  row: TreeRow;
  selected: boolean;
  flash: boolean;
  onToggle: (node: TreeNode) => void;
  onAttach: (node: TreeNode) => void;
}) {
  const { node, depth } = row;
  const label = (
    <span className="tree__name" style={{ paddingLeft: depth * INDENT }} title={node.path}>
      {node.name}
    </span>
  );
  return (
    <div
      className={`tree__row${selected ? " tree__row--on" : ""}${flash ? " tree__row--flash" : ""}`}
      data-testid="tree-row"
      data-name={node.name}
      data-kind={node.kind}
      role="treeitem"
      aria-selected={selected}
      style={node.kind === "dir" ? undefined : { paddingLeft: 0 }}
    >
      {node.kind === "dir" ? (
        <button
          type="button"
          className="tree__toggle"
          data-testid="tree-toggle"
          data-name={node.name}
          onClick={() => onToggle(node)}
          title={`Открыть папку ${node.name}`}
        >
          ▸
        </button>
      ) : null}
      <button type="button" className="tree__pick" onClick={() => onAttach(node)} disabled={node.kind === "dir"}>
        {label}
      </button>
    </div>
  );
}
