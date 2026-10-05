// Дерево файлов проекта вне окна Tauri: та же форма, что отдаёт мост (src-tauri/src/project),
// одна папка за вызов — как в окне. Настоящие имена и путь проекта, а не «Lorem ipsum»
// (docs/specs/2026-10-05-4-glavnoe-okno.md, «Настоящие данные»).

import type { TreeNode } from "./bridge";
import { params } from "./viewparams";

const ROOT = "C:\\Users\\Metalismatic\\Documents\\GnomeCode";

/** Узел проекта: путь собирается от корня тем же разделителем, что и в окне. */
const node = (name: string, kind: TreeNode["kind"], path = ROOT): TreeNode => ({
  name,
  path: `${path}\\${name}`,
  kind,
  loaded: false,
});

const dir = (name: string, path = ROOT): TreeNode => node(name, "dir", path);
const file = (name: string, path = ROOT): TreeNode => node(name, "file", path);

/** Содержимое папок проекта по требованию: корень, `components`, `features`, `styles`.
 *  Папки перед файлами, внутри — по имени без учёта регистра: тот же порядок, что у моста. */
const TREE: Record<string, TreeNode[]> = {
  [ROOT]: [dir("components"), dir("features"), dir("styles"), file("README.md"), file("package.json")],
  [`${ROOT}\\components`]: [file("ContextPanel.tsx"), file("FileTree.tsx"), file("bridge.ts")],
  [`${ROOT}\\features`]: [dir("project")],
  [`${ROOT}\\features\\project`]: [file("useProject.ts")],
  [`${ROOT}\\styles`]: [file("tokens.css")],
};

/** Папка проекта, если состояние страницы показывает дерево (`?состояние=проект`). */
export function project(): string | null {
  return params.feed === "project" ? ROOT : null;
}

/** Содержимое одной папки: чужой путь мост не читает — дерево его и не показывает. */
export function children(path: string): TreeNode[] {
  return TREE[path] ?? [];
}