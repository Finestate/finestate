import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

// When a row or box is dragged by its grip, it carries no text, only a private marker.
// Otherwise the browser treats text boxes as drop targets and pastes the dragged row's
// words into whichever box the row is let go over. Dragging selected text inside a box
// is left alone.
const ROW_DRAG = "application/x-finestate-row";
document.addEventListener(
  "dragstart",
  (e) => {
    const t = e.target;
    if (!e.dataTransfer || !(t instanceof Element)) return;
    if (t.closest("input, textarea, [contenteditable='true'], [contenteditable='']")) return;
    try {
      e.dataTransfer.clearData();
      e.dataTransfer.setData(ROW_DRAG, "1");
      e.dataTransfer.effectAllowed = "move";
    } catch {}
  },
  true
);
// And a row let go over a text box never drops into it.
document.addEventListener(
  "drop",
  (e) => {
    if (e.dataTransfer?.types?.includes(ROW_DRAG) && e.target instanceof Element && e.target.closest("input, textarea, [contenteditable]")) {
      e.preventDefault();
    }
  },
  true
);

// Access is gated at the edge (middleware.js + /api/unlock), not in this bundle.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
