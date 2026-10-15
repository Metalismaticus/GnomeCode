// Зона перетаскивания файла (B6, владелец 15.10: «драг анд дроп как у сайтов»):
// HTML5-дроп работает, потому что окно Tauri поднято с dragDropEnabled: false —
// файлы из проводника приходят обычным событием drop с dataTransfer.files.
// Клик по зоне без файла открывает проводник (замечание владельца 15.10) —
// тот же файл, тот же onFile, что у броска. Одна зона на три места: скиллы
// (.md) и внешний плагин (.ts) в настройках и на странице плагинов.

import { useState } from "react";

import { bridge } from "../bridge";

import "./DropZone.css";

export type DropZoneProps = {
  /** Расширение без точки: «md», «ts». Файл другого типа — честный отказ. */
  ext: string;
  /** Подпись зоны — что сюда бросать. */
  hint: string;
  /** Файл принят: содержимое читает родитель (skillsSave / plugin_install_file). */
  onFile: (name: string, text: string) => void;
  /** Причина отказа строкой зоны: вернул родитель после приёма файла. */
  note?: string;
  testid: string;
};

/** Кап размера файла: скиллу и плагину хватает на порядки меньше, а гигантский
 *  бросок не должен молота IPC-мост строкой на много мегабайт. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Зона броска файла: подсветка под курсором, отказ чужому расширению,
 *  клик — проводник (диалог с фильтром расширения, чтение на мосту). */
export function DropZone({ ext, hint, onFile, note, testid }: DropZoneProps) {
  const [hot, setHot] = useState(false);
  const [error, setError] = useState("");

  /** Один приём и для броска, и для проводника: проверка расширения — на месте. */
  const take = (name: string, text: string) => {
    if (!name.toLowerCase().endsWith(`.${ext}`)) {
      setError(`Нужен файл .${ext} — «${name}» не подходит`);
      return;
    }
    setError("");
    onFile(name, text);
  };

  /** Клик по зоне (или Enter/пробел с клавиатуры): проводник с фильтром. */
  const pick = () => {
    bridge()
      .pickText(ext)
      .then((picked) => {
        if (picked) {
          take(picked.name, picked.text);
        }
      })
      .catch((reason: unknown) => setError(String(reason)));
  };

  return (
    <div
      className={hot ? "dropzone dropzone--hot" : "dropzone"}
      data-testid={testid}
      role="button"
      tabIndex={0}
      aria-label={hint}
      title="Кликните — откроется проводник, или перетащите файл сюда"
      onClick={pick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          pick();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(event) => {
        event.preventDefault();
        setHot(false);
        const file = event.dataTransfer.files?.[0];
        if (file) {
          if (!file.name.toLowerCase().endsWith(`.${ext}`)) {
            setError(`Нужен файл .${ext} — «${file.name}» не подходит`);
            return;
          }
          if (file.size > MAX_BYTES) {
            setError(`«${file.name}» слишком большой — до 2 МБ`);
            return;
          }
          setError("");
          file
            .text()
            .then((text) => onFile(file.name, text))
            .catch(() => setError("Файл не прочитался — попробуйте ещё раз"));
          return;
        }
        // Файл из дерева проекта: путь в text/plain, содержимое читает мост.
        const path = event.dataTransfer.getData("text/plain");
        if (path) {
          const name = path.split(/[\\/]/).pop() ?? "";
          bridge()
            .readText(path)
            .then((text) => take(name, text))
            .catch((reason: unknown) => setError(String(reason)));
        }
      }}
    >
      <div className="dropzone__title">{hint}</div>
      <div className="dropzone__sub">
        бросьте файл .{ext} сюда или кликните — откроется проводник
      </div>
      {error ? (
        <div className="dropzone__error" data-testid={`${testid}-error`}>
          {error}
        </div>
      ) : null}
      {note ? (
        <div className="dropzone__error" data-testid={`${testid}-note`}>
          {note}
        </div>
      ) : null}
    </div>
  );
}
