import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import { store, persistor } from "./redux/store";
import { AuthProvider } from "./AuthContext";
import "./index.css";
import App from "./App";
import axios from "axios";

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);
// Baked in at build time. VITE_API_BASE_URL overrides, otherwise a production
// build targets the deployed backend subdomain and `pnpm dev` targets local.
axios.defaults.baseURL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? "https://vpsbackend.metawingsxr.com"
    : "http://localhost:5001");

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </PersistGate>
    </Provider>
  </React.StrictMode>,
);
