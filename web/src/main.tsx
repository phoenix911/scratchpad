import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./App";

// A code-split chunk failed to load (usually a stale/edge-cached hash right after
// a deploy). Reload once to pick up the current index + chunk URLs.
window.addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("preload-reloaded")) return;
  sessionStorage.setItem("preload-reloaded", "1");
  location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
