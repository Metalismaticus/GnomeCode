// Зона перетаскивания файла (B6, владелец 15.10: «драг энд дроп как у сайтов»):
// HTML5-дроп работает, потому что окно Tauri поднято с dragDropEnabled: false —
// файлы из проводника приходят обычным событием drop с dataTransfer.files.
// Одна зона на два места: скиллы (.md) и внешний плагин (.ts).

import { useState } from "react";

import "./DropZone.css";

export type DropZoneProps = {
  /** Расширение без точки: «md», «ts». Файл другого типа — честный отказ. */
  ext: string;
  /** Подпись зоны — что сюда бросать. */
  hint: string;
  /** Файл принят: содержимое читает родитель (skillsSave / plugin_install_file). */
  onFile: (name: string, text: string) => void;
  testid: string;
};

/** Кап размера файла: скиллу и плагину хватает на порядки меньше, а гигантский
 *  бросок не должен молота IPC-мост строкой на много мегабайт. */
const MAX_BYTES = 2 * 1024 * 1024;

/** Зона броска файла: подсветка под курсором, отказ чужому расширению. */
export function DropZone({ ext, hint, onFile, testid }: DropZoneProps) {
  const [hot, setHot] = useState(false);
  const [error, setError] = useState("");
  return (
    <div
      className={hot ? "dropzone dropzone--hot" : "dropzone"}
      data-testid={testid}
      onDragOver={(event) => {
        event.preventDefault();
        setHot(true);
      }}
      onDragLeave={() => setHot(false)}
      onDrop={(event) => {
        event.preventDefault();
        setHot(false);
        const file = event.dataTransfer.files?.[0];
        if (!file) {
          return;
        }
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
      }}
    >
      <div className="dropzone__title">{hint}</div>
      <div className="dropzone__sub">бросьте файл .{ext} прямо сюда</div>
      {error ? (
        <div className="dropzone__error" data-testid={`${testid}-error`}>
          {error}
        </div>
      ) : null}
    </div>
  );
}
