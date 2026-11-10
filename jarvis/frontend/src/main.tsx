import "@fontsource/ibm-plex-mono/300.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { setToken } from "./api/client";

// The local launcher opens http://127.0.0.1:8765/#token=… once: store the token
// and remove it from the address bar and history.
if (location.hash.startsWith("#token=")) {
  setToken(decodeURIComponent(location.hash.slice(7)));
  history.replaceState(null, "", location.pathname + "#overview");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
