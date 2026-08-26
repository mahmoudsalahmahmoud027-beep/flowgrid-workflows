import React from "react";
import { createRoot } from "react-dom/client";
import { FlowGridApp } from "../src/components/FlowGridApp";
import "@xyflow/react/dist/style.css";
import "../app/globals.css";

document.documentElement.style.setProperty("--font-geist-sans", "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif");
document.documentElement.style.setProperty("--font-geist-mono", "ui-monospace, SFMono-Regular, Consolas, monospace");

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FlowGridApp />
  </React.StrictMode>
);
