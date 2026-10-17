// Portable Node HTTP server — Vercel'dan tashqari hostlar (Render, Railway, Fly, Docker) uchun.
// Aynan shu `api/ai.ts` handler'ini qayta ishlatadi va Vite build natijasini (dist/) statik beradi.
//
// Ishga tushirish:
//   npm run build        # dist/ hosil qiladi
//   npm start            # tsx server.ts  (PORT env, default 3000)
//
// Kerakli env o'zgaruvchilar (host dashboardida yoki .env.local'da):
//   GCP_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_JSON
// To'liq ro'yxat va izohlar: .env.example
import { createServer, IncomingMessage, ServerResponse } from "http";
import { createWriteStream } from "fs";
import { readFile, stat, mkdir, writeFile } from "fs/promises";
import { extname, join, resolve, sep } from "path";
import apiHandler from "./api/ai";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DIST = resolve(process.cwd(), "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function serveStatic(pathname: string, res: ServerResponse) {
  const target = resolve(DIST, "." + pathname);
  // Path traversal himoyasi: dist/ chegarasidan tashqariga chiqishni bloklaymiz.
  const withinDist = target === DIST || target.startsWith(DIST + sep);
  let filePath = withinDist ? target : DIST;

  let info = withinDist ? await stat(filePath).catch(() => null) : null;
  if (info?.isDirectory()) {
    filePath = join(filePath, "index.html");
    info = await stat(filePath).catch(() => null);
  }
  // SPA fallback — noma'lum yo'llar (client-side routing) index.html'ga.
  const isFile = !!info?.isFile();
  if (!isFile) filePath = join(DIST, "index.html");

  try {
    const data = await readFile(filePath);
    res.statusCode = 200;
    res.setHeader("Content-Type", MIME[extname(filePath)] || "application/octet-stream");
    // Vite hash'langan assetlarni uzoq keshlaymiz; qolganini kesh qilmaymiz.
    if (isFile && pathname.startsWith("/assets/")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (extname(filePath) === ".html") {
      res.setHeader("Cache-Control", "no-cache");
    }
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Not found");
  }
}

async function handleSaveLocal(req: IncomingMessage, res: ServerResponse) {
  try {
    const day = (req.headers["x-day"] as string) || "01";
    const lang = (req.headers["x-lang"] as string) || "uz";
    const rawFileName = (req.headers["x-filename"] as string) || `video_${Date.now()}.mp4`;
    const fileName = decodeURIComponent(rawFileName);
    const smmBase64 = (req.headers["x-smm-base64"] as string) || "";
    const smmText = smmBase64 ? Buffer.from(smmBase64, "base64").toString("utf-8") : "";

    const dayDir = `day_${String(day).padStart(2, "0")}`;
    const targetDir = resolve(process.cwd(), "output", dayDir, lang);
    await mkdir(targetDir, { recursive: true });

    const videoPath = join(targetDir, fileName);
    const writeStream = createWriteStream(videoPath);

    await new Promise<void>((resolvePromise, rejectPromise) => {
      req.pipe(writeStream);
      writeStream.on("finish", resolvePromise);
      writeStream.on("error", rejectPromise);
    });

    if (smmText) {
      const baseName = fileName.replace(/\.[^/.]+$/, "");
      const smmPath = join(targetDir, `${baseName}_smm.txt`);
      await writeFile(smmPath, smmText, "utf-8");
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true, path: videoPath }));
  } catch (err: any) {
    console.error("Save local error:", err);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
  }
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = req.url || "/";

  // API — bir xil serverless handler'ni chaqiramiz. U req oqimidan body'ni o'zi o'qiydi.
  if (url === "/api/ai" || url.startsWith("/api/ai?")) {
    Promise.resolve(apiHandler(req as IncomingMessage & { body?: unknown }, res)).catch((err) => {
      console.error("API handler error:", err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: String(err?.message || err) }));
      }
    });
    return;
  }

  // Lokal saqlash endpointi: videolarni to'g'ridan-to'g'ri ./output/day_{XX}/{lang}/ papkalariga saqlash
  if ((url === "/api/save-local" || url.startsWith("/api/save-local?")) && req.method === "POST") {
    handleSaveLocal(req, res).catch((err) => {
      console.error("handleSaveLocal error:", err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: false, error: String(err?.message || err) }));
      }
    });
    return;
  }

  const pathname = decodeURIComponent(url.split("?")[0]);
  serveStatic(pathname, res).catch((err) => {
    console.error("Static serve error:", err);
    if (!res.writableEnded) {
      res.statusCode = 500;
      res.end("Server error");
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`✅ Server tayyor — http://localhost:${PORT} (statik: ${DIST})`);
});
