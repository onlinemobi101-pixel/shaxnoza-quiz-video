import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';
import apiHandler from './api/ai';

// Lokal dev'da Vercel serverless funksiyasini (/api/ai) Vite serverida ishga tushiradi.
// GEMINI_API_KEY faqat server jarayonida qoladi — klient bundle'iga kirmaydi.
function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      if (env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY;
      }
      server.middlewares.use('/api/ai', (req, res) => {
        apiHandler(req, res).catch((err) => {
          console.error('API dev handler error:', err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({error: String(err?.message || err)}));
          }
        });
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiDevServer(env)],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            motion: ['motion/react'],
            lucide: ['lucide-react'],
          },
        },
      },
    },
  };
});
