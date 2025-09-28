// main.tsx
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";
import "./index.css";

// Load OneSignal SDK once; let unifiedNotificationService handle init.
if (typeof window !== "undefined" && !(window as any).OneSignal) {
  const script = document.createElement("script");
  script.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

