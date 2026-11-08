import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build:single` produces one self-contained HTML file (dist-single/index.html)
// that opens straight from disk, e.g. to send the design around for review.
export default defineConfig(({ mode }) => ({
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react()],
  build: mode === "single" ? { outDir: "dist-single", copyPublicDir: false } : {},
}));
