/**
 * Build variant that emits ONE self-contained HTML file.
 *
 * Used for previews on hosts that serve a single static page with no rewrites
 * and no sibling assets: every chunk, style and font is inlined. Pair it with
 * VITE_ROUTER=hash so navigation works without server-side routing.
 *
 *   npx vite build --config vite.config.preview.ts
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  base: './',
  build: {
    outDir: 'dist-preview',
    cssCodeSplit: false,
    // Fonts and images become data: URIs instead of separate requests.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
})
