import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// *** CHANGE THIS IMPORT LINE ***
// import path from 'path'; // <-- Original line
import { resolve } from "node:path"; // <-- New line: Import 'resolve' directly from 'node:path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // string shorthand: /api -> http://localhost:5001/api
      "/api": {
        target: "http://localhost:5001", // Your backend server
        changeOrigin: true,
        // secure: false, // If your backend is not https
        // rewrite: (path) => path.replace(/^\/api/, '') // Uncomment if your backend routes don't start with /api
      },
    },
  },
  resolve: {
    alias: {
      // *** CHANGE THIS LINE ***
      // "@": path.resolve(__dirname, "./src"), // <-- Original usage
      "@": resolve(__dirname, "./src"), // <-- New usage: Use the imported 'resolve' function directly
    },
  },
});
