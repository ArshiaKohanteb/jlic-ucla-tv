import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { startZmanimEngine } from "../shared/bootstrap.js";
import "./admin.css";


startZmanimEngine();

createRoot(document.getElementById("root")).render(<App />);
