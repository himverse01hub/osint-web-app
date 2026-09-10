import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'url';
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        proxy: {
            // Dev workflow: run `vercel dev --listen 3000` alongside `npm run dev` so
            // Vite proxies /api to the Vercel serverless functions.
            '/api': 'http://localhost:3000',
        },
    },
});
