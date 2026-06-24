import express from "express";
import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import Database from "better-sqlite3";
import { GoogleGenAI, Type, Modality } from "@google/genai";

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in environment variables!");
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Initialize SQLite Cache for TTS
// Vercel serverless environment has a read-only filesystem except for /tmp
const dbPath = process.env.VERCEL
  ? path.join("/tmp", "tts_cache.db")
  : path.resolve("tts_cache.db");

const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS tts_cache (
    id TEXT PRIMARY KEY,
    text TEXT,
    voice_name TEXT,
    audio_base64 TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Helpers for SQLite caching
function getCachedTTS(text: string, voiceName: string): string | null {
  try {
    const hash = crypto
      .createHash("md5")
      .update(`${text}_${voiceName}`)
      .digest("hex");
    const stmt = db.prepare("SELECT audio_base64 FROM tts_cache WHERE id = ?");
    const row = stmt.get(hash) as { audio_base_64: string } | undefined;
    return row ? row.audio_base_64 : null;
  } catch (err) {
    console.error("Cache lookup error:", err);
    return null;
  }
}

function saveCachedTTS(text: string, voiceName: string, audioBase64: string) {
  try {
    const hash = crypto
      .createHash("md5")
      .update(`${text}_${voiceName}`)
      .digest("hex");
    const stmt = db.prepare(
      "INSERT OR REPLACE INTO tts_cache (id, text, voice_name, audio_base64) VALUES (?, ?, ?, ?)"
    );
    stmt.run(hash, text, voiceName, audioBase64);
  } catch (err) {
    console.error("Cache save error:", err);
  }
}

// Route: Generate Quiz questions from Topic
app.post("/api/generate-quiz", async (req: express.Request, res: express.Response) => {
  const { topic } = req.body;
  if (!topic) {
    res.status(400).json({ error: "Topic is required" });
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Mavzu: ${topic}. Shu mavzuda 5 ta qiziqarli test savolini o'zbek tilida tuzing. Har bir savol 4 ta variantdan iborat bo'lsin. To'g'ri javob indeksini (0 dan 3 gacha) ko'rsating. Shuningdek to'g'ri javob bilan bog'liq qiziqarli qo'shimcha ma'lumot (fact) bering. Shu savol mavzusiga mos keluvchi 1 ta inglizcha so'z bering (masalan: history, space, nature) - bu 'imageKeyword' bo'ladi.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Savol matni" },
              options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "4 ta variant" },
              correctOptionIndex: { type: Type.INTEGER, description: "To'g'ri javob indeksi (0 dan 3 gacha)" },
              fact: { type: Type.STRING, description: "To'g'ri javob bilan bog'liq fakt" },
              imageKeyword: { type: Type.STRING, description: "Mavzuga doir bitta inglizcha so'z" }
            },
            required: ["text", "options", "correctOptionIndex", "fact", "imageKeyword"]
          }
        }
      }
    });

    const data = JSON.parse(response.text || "[]");
    const questions = data.map((q: any) => ({
      ...q,
      id: Math.random().toString(36).substr(2, 9),
      backgroundImage: `https://picsum.photos/seed/${encodeURIComponent(q.imageKeyword)}/1080/1920`
    }));

    res.json(questions);
  } catch (error: any) {
    console.error("Quiz generation failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate quiz" });
  }
});

// Route: Generate TTS Audio (Base64 PCM)
app.post("/api/generate-tts", async (req: express.Request, res: express.Response) => {
  const { text, voiceName } = req.body;
  const selectedVoice = voiceName || "Kore";

  if (!text) {
    res.status(400).json({ error: "Text is required" });
    return;
  }

  try {
    // Check Cache first
    const cachedAudio = getCachedTTS(text, selectedVoice);
    if (cachedAudio) {
      console.log(`[TTS CACHE HIT] for text: "${text.slice(0, 30)}..."`);
      res.json({ audioBase64: cachedAudio });
      return;
    }

    console.log(`[TTS CACHE MISS] calling Gemini for text: "${text.slice(0, 30)}..."`);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: selectedVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      saveCachedTTS(text, selectedVoice, base64Audio);
      res.json({ audioBase64: base64Audio });
    } else {
      res.status(500).json({ error: "No audio data received from Gemini API" });
    }
  } catch (error: any) {
    console.error("TTS generation failed:", error);
    res.status(500).json({ error: error.message || "Failed to generate TTS" });
  }
});

// Production: serve built static frontend files (used locally when running in production mode)
if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  app.use(express.static(path.resolve("dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve("dist/index.html"));
  });
}

// Start local listener only if not running as a Vercel Serverless Function
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server is running on port ${PORT}`);
  });
}

// Export the Express app as default for Vercel's Node.js Serverless Function handler
export default app;
