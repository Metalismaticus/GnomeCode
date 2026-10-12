import type { ProjectFile } from "../features/project/useProject";

import "./FileChips.css";

/** Прикреплённые файлы над полем ввода: имя файла и крестик, полный путь — в подсказке.
 *  Файл уходит с вопросом, поэтому чип — это то, что владелец собирается отдать движку. */
export function FileChips({ files, onDetach }: { files: ProjectFile[]; onDetach: (path: string) => void }) {
  if (!files.length) {
    return null;
  }
  return (
    <div className="chips">
      {files.map((file) => (
        <span className="chip" data-testid="context-chip" key={file.path} title={file.path}>
          <span className="chip__name">{file.name}</span>
          <button
            type="button"
            className="chip__close"
            data-testid="chip-close"
            onClick={() => onDetach(file.path)}
            title={`Убрать ${file.name} из вопроса`}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}