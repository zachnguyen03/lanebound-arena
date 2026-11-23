import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CareerApp } from "./CareerApp";
import "./vendor/tokens.css";
import "./vendor/tokens-cards-arena.css";
import "./vendor/base.css";
import "./fonts-shell.css";
import "./app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CareerApp />
  </StrictMode>,
);
