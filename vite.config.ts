import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-router-dom') || id.includes('/react/') || id.includes('/react-dom/')) return 'vendor-react';
            if (id.includes('/d3-')) return 'vendor-graph';
            // jspdf + html2canvas are intentionally NOT here:
            // IntelligenceReportPage lazy-loads them via dynamic import() on export.
          }
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      // Dev workflow: run `vercel dev --listen 3000` alongside `npm run dev` so
      // Vite proxies /api to the Vercel serverless functions.
      '/api': 'http://localhost:3000',
    },
  },
})