import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Self-hosted fonts (no external CDN dependency, eliminates SRI warnings)
import "@fontsource-variable/inter";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/plus-jakarta-sans";

createRoot(document.getElementById("root")!).render(<App />);
