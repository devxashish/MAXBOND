// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

import './styles/ThemeContext.css'; // CRITICAL: Import your theme variables and body classes first
import 'react-toastify/dist/ReactToastify.css'; // CRITICAL: Import react-toastify's base CSS after your theme, but before any custom Toastify overrides

// Note: If you also have a separate `index.css` for other global styles,
// ensure its import order is after ThemeContext.css but before any component-specific modules
// import './index.css';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);