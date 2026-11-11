import React from "react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { Provider } from "react-redux";
import { store } from "./redux/store";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./AuthContext";



function App() {
  return (
    <Provider store={store}>
      <AuthProvider>
        {/*
          One style for every toast used to mean an error arrived as orange text
          on an amber card — the same as a success — so the only thing carrying
          "this failed" was the wording. These are readable dark-on-white cards
          with the state in the icon and the left edge: red for a failure, green
          for a success, brand orange for anything neutral. Errors also linger,
          because they are the ones worth reading.
        */}
        <Toaster
          position="bottom-center"
          gutter={10}
          toastOptions={{
            duration: 4000,
            style: {
              background: "var(--toast-bg, #ffffff)",
              color: "var(--toast-ink, #1f2937)",
              fontFamily: "Figtree, system-ui, sans-serif",
              fontSize: "1rem",
              fontWeight: 500,
              maxWidth: "420px",
              padding: "12px 16px",
              borderRadius: "16px",
              borderLeft: "4px solid #f97316",
              boxShadow:
                "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
            },
            success: {
              iconTheme: { primary: "#16a34a", secondary: "#ffffff" },
              style: { borderLeft: "4px solid #16a34a" },
            },
            error: {
              duration: 6000,
              iconTheme: { primary: "#dc2626", secondary: "#ffffff" },
              style: { borderLeft: "4px solid #dc2626" },
            },
            loading: {
              iconTheme: { primary: "#f97316", secondary: "#ffffff" },
            },
          }}
        />
        <RouterProvider router={router} />
      </AuthProvider>
    </Provider>
  );
}

export default App;
