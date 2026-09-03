import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Determine the API base URL:
// - In production builds, use the deployed API URL from env or fallback to the Render backend
// - In dev, proxy /api to localhost:8000
const isProd = process.env.NODE_ENV === "production";
const API_URL = isProd
  ? (process.env.VITE_API_URL || "https://link-logger-api.onrender.com")
  : "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Dev server: proxy /api to the local backend
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  // Production: define the API URL so the frontend can reach the deployed backend
  define: {
    "import.meta.env.VITE_API_URL": JSON.stringify(API_URL),
  },
});
