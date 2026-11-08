import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The dev server only listens on localhost and proxies the local backend.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:8765", ws: true, changeOrigin: false },
    },
  },
  build: { outDir: "dist", sourcemap: false, chunkSizeWarningLimit: 1200 },
});
