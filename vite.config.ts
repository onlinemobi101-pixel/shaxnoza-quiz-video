import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv, Plugin} from 'vite';
import apiHandler from './api/ai';

// Lokal dev'da Vercel serverless funksiyasini (/api/ai) Vite serverida ishga tushiradi.
// Maxfiy kalitlar faqat server jarayonida qoladi — klient bundle'iga kirmaydi.
function apiDevServer(env: Record<string, string>): Plugin {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      for (const [key, val] of Object.entries(env)) {
        if (val && !process.env[key]) {
          let cleanVal = val.trim();
          if ((cleanVal.startsWith("'") && cleanVal.endsWith("'")) || (cleanVal.startsWith('"') && cleanVal.endsWith('"'))) {
            cleanVal = cleanVal.slice(1, -1);
          }
          process.env[key] = cleanVal;
        }
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

      server.middlewares.use('/api/save-local', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        try {
          const { createWriteStream } = await import('fs');
          const { mkdir, writeFile } = await import('fs/promises');
          const { resolve, join } = await import('path');

          const day = (req.headers['x-day'] as string) || '01';
          const lang = (req.headers['x-lang'] as string) || 'uz';
          const rawFileName = (req.headers['x-filename'] as string) || `video_${Date.now()}.mp4`;
          const fileName = decodeURIComponent(rawFileName);
          const smmBase64 = (req.headers['x-smm-base64'] as string) || '';
          const smmText = smmBase64 ? Buffer.from(smmBase64, 'base64').toString('utf-8') : '';

          const dayDir = `day_${String(day).padStart(2, '0')}`;
          const targetDir = resolve(process.cwd(), 'output', dayDir, lang);
          await mkdir(targetDir, { recursive: true });

          const videoPath = join(targetDir, fileName);
          const writeStream = createWriteStream(videoPath);

          await new Promise<void>((resolvePromise, rejectPromise) => {
            req.pipe(writeStream);
            writeStream.on('finish', resolvePromise);
            writeStream.on('error', rejectPromise);
          });

          if (smmText) {
            const baseName = fileName.replace(/\.[^/.]+$/, '');
            const smmPath = join(targetDir, `${baseName}_smm.txt`);
            await writeFile(smmPath, smmText, 'utf-8');
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, path: videoPath }));
        } catch (err: any) {
          console.error('Vite save-local error:', err);
          if (!res.writableEnded) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
          }
        }
      });
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  for (const [key, val] of Object.entries(env)) {
    if (val && !process.env[key]) {
      let cleanVal = val.trim();
      if ((cleanVal.startsWith("'") && cleanVal.endsWith("'")) || (cleanVal.startsWith('"') && cleanVal.endsWith('"'))) {
        cleanVal = cleanVal.slice(1, -1);
      }
      process.env[key] = cleanVal;
    }
  }
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
