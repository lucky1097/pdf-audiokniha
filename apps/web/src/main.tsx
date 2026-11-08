import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { generator } from "./lib/generator.ts";
import "./styles.css";

await generator.init();
createRoot(document.getElementById("root")!).render(<App />);
