import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import "./app/styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

const bootLoader = document.getElementById("boot-loader");
if (bootLoader) {
  requestAnimationFrame(() => {
    bootLoader.classList.add("is-hidden");
    window.setTimeout(() => {
      bootLoader.remove();
    }, 260);
  });
}