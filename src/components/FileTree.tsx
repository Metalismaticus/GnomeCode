import type { TreeNode } from "../bridge";
import type { ProjectState, TreeRow } from "../features/project/useProject";

import "./FileTree.css";

/** Вкладки правой панели: рабочая — «Файлы», остальные заглушки «позже»
 *  (docs/specs/2026-10-05-4-glavnoe-okno.md, «Тексты»). */
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
        {tab !== "Файлы" ? <div className="tree__later">{tab} — позже</div> : null}
        {project.error ? <div className="tree__later">{project.error}</div> : null}
        {tab === "Файлы" && !project.top.length && !project.error ? (
          <div className="tree__later">{project.root ? "Папка пуста" : "Папка не выбрана"}</div>
        ) : null}
        {project.rows.map((row) => (
          <TreeLine
            key={row.node.path}
            row={row}
            selected={attached.includes(row.node.path)}
            onToggle={project.toggle}
            onAttach={project.attach}
          />
        ))}
      </div>
    </div>
  );
}

/** Строка дерева: папка раскрывается стрелкой, файл — кликом по строке. */
function TreeLine({
  row,
  selected,
  onToggle,
  onAttach,
}: {
  row: TreeRow;
  selected: boolean;
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
      className={`tree__row${selected ? " tree__row--on" : ""}`}
      data-testid="tree-row"
      data-name={node.name}
      data-kind={node.kind}
      role="treeitem"
      aria-selected={selected}
      style={node.kind === "file" ? undefined : { paddingLeft: 0 }}
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