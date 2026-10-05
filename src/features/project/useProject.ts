// Папка проекта и файлы контекста: что выбрано, что раскрыто, что прикреплено к вопросу.
// Разбор папок делает мост (ADR-0001): здесь только состояние интерфейса и действия
// владельца — «выбрать папку», «раскрыть», «прикрепить», «открепить».

import { useCallback, useEffect, useState } from "react";

import { bridge, type TreeNode } from "../../bridge";

/** Файл, прикреплённый к следующему вопросу: имя — чипу, путь — мосту. */
export type ProjectFile = { path: string; name: string };

/** Строка дерева на экране: узел и глубина вложенности (отступ). */
export type TreeRow = { node: TreeNode; depth: number };

export type ProjectState = {
  /** Папка проекта; пустая — владелец её ещё не выбрал. */
  root: string;
  /** Корневые узлы папки проекта: пусто, пока папка не выбрана. */
  top: TreeNode[];
  rows: TreeRow[];
  files: ProjectFile[];
  /** Ошибка чтения папки — словами в панели, а не пустым деревом. */
  error: string;
  pick: () => void;
  toggle: (node: TreeNode) => void;
  attach: (node: TreeNode) => void;
  detach: (path: string) => void;
};

/** Папка проекта: уже выбранная при открытии окна или та, что владелец выбрал сейчас.
 *  Содержимое папок приходит лениво — одна папка за клик по её стрелке. */
export function useProject(initial: string): ProjectState {
  const [root, setRoot] = useState(initial);
  const [loaded, setLoaded] = useState<Record<string, TreeNode[]>>({});
  const [open, setOpen] = useState<string[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [error, setError] = useState("");

  const read = useCallback((path: string) => {
    bridge()
      .readTree(path)
      .then((nodes) => setLoaded((known) => ({ ...known, [path]: nodes })))
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  // Корень читается один раз: содержимое выбранной папки нужно дереву сразу.
  useEffect(() => {
    if (root && !loaded[root]) {
      read(root);
    }
  }, [root, loaded, read]);

  /** Выбор папки: новая папка — новое дерево и чистый контекст вопроса. */
  const pick = useCallback(() => {
    bridge()
      .pickFolder()
      .then((chosen) => {
        if (!chosen) {
          return;
        }
        setRoot(chosen);
        setLoaded({});
        setOpen([]);
        setFiles([]);
        setError("");
      })
      .catch((reason: unknown) => setError(String(reason)));
  }, []);

  const toggle = useCallback(
    (node: TreeNode) => {
      if (node.kind !== "dir") {
        return;
      }
      setOpen((known) =>
        known.includes(node.path) ? known.filter((path) => path !== node.path) : [...known, node.path],
      );
      if (!loaded[node.path]) {
        read(node.path);
      }
    },
    [loaded, read],
  );

  /** Клик по файлу: он уходит с вопросом. Повторный клик ничего не меняет. */
  const attach = useCallback((node: TreeNode) => {
    if (node.kind === "file" && !files.some((file) => file.path === node.path)) {
      setFiles([...files, { path: node.path, name: node.name }]);
    }
  }, [files]);

  const detach = useCallback((path: string) => {
    setFiles((known) => known.filter((file) => file.path !== path));
  }, []);

  const top = root ? loaded[root] ?? [] : [];
  return { root, top, rows: visible(top, loaded, open), files, error, pick, toggle, attach, detach };
}

/** Строки дерева на экране: раскрытые папки и их содержимое, остальное скрыто.
 *  Порядок «папки перед файлами» задаёт мост — здесь только обход. */
function visible(top: TreeNode[], loaded: Record<string, TreeNode[]>, open: string[]): TreeRow[] {
  const rows: TreeRow[] = [];
  const walk = (nodes: TreeNode[], depth: number) => {
    for (const node of nodes) {
      rows.push({ node, depth });
      if (node.kind === "dir" && open.includes(node.path)) {
        walk(loaded[node.path] ?? [], depth + 1);
      }
    }
  };
  walk(top, 0);
  return rows;
}