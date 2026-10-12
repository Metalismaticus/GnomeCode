// Блок «Sources used» под значимым ответом (docs/SPEC/phase2.md, раздел 9.1):
// источники хода — файлы проекта и плагины. Клик по файлу открывает его в дереве
// правой панели, клик по плагину ведёт в раздел «Плагины» — источник должен быть
// открытым, а не просто названным. Знания в продукте ещё нет (Этап 3) — честно:
// только файлы и плагины.
import type { Source } from "../sources";

import "./SourcesBlock.css";

export function SourcesBlock({
  sources,
  onFile,
  onPlugin,
}: {
  sources: Source[];
  onFile: (path: string) => void;
  onPlugin: (id: string) => void;
}) {
  return (
    <div className="sources" data-testid="sources-used">
      <div className="sources__title">Sources used</div>
      <div className="sources__list">
        {sources.map((source) =>
          source.kind === "file" ? (
            <button
              key={source.path}
              type="button"
              className="sources__item"
              data-testid="source-file"
              data-path={source.path}
              title={`Открыть ${source.path} в дереве`}
              onClick={() => onFile(source.path)}
            >
              {source.name}
            </button>
          ) : (
            <button
              key={source.id}
              type="button"
              className="sources__item"
              data-testid="source-plugin"
              data-plugin={source.id}
              title={`Открыть плагин ${source.id} в разделе «Плагины»`}
              onClick={() => onPlugin(source.id)}
            >
              {source.name}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
