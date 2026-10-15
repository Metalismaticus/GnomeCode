import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";

// Файл, брошенный мимо зоны приёма, не должен уводить окно на сам файл —
// как в браузере без обработчиков. Зоны приёма (DropZone) читают свои события
// раньше: превенция здесь — только про «не навигируй», не про «не отдавай».
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", (event) => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
