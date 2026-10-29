import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { get } from "../shared/ipc/settings";
import { App } from "./app/App";
import { call } from "./lib/ipc";
import { applyTheme } from "./lib/theme";
import "./styles.css";

// A file dropped outside a drop zone must never be opened by the window (it would navigate to it).
// The zones handle their own events first (React listens on #root, below window); this is the fallback.
window.addEventListener("dragover", (event) => {
  if (event.defaultPrevented) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
});
window.addEventListener("drop", (event) => event.preventDefault());

// The first paint is already right: main set the colour scheme before creating the window. This only adds
// `data-theme` for an explicit choice; if it cannot be read, the colours keep following the system.
void call(get).then(({ theme }) => applyTheme(theme));

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
