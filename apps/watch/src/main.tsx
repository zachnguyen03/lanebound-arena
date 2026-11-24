import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { VfxGallery } from "./components/VfxGallery";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    {new URLSearchParams(location.search).has("vfx") ? <VfxGallery /> : <App />}
  </StrictMode>,
);
