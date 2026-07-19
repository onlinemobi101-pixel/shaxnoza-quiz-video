// Vercel serverless funksiya: barcha Gemini chaqiruvlari shu yerda bajariladi.
// GEMINI_API_KEY faqat server muhitida saqlanadi va klient bundle'iga tushmaydi.
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "./firebase-admin.js";

const CURATED_IMAGES: Record<string, string> = {
  history: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=1080&auto=format&fit=crop",
  tarix: "https://images.unsplash.com/photo-1461360370896-922624d12aa1?q=80&w=1080&auto=format&fit=crop",
  space: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop",
  kosmos: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop",
  koinot: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1080&auto=format&fit=crop",
  science: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1080&auto=format&fit=crop",
  fan: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1080&auto=format&fit=crop",
  ilm: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=1080&auto=format&fit=crop",
  nature: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1080&auto=format&fit=crop",
  tabiat: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1080&auto=format&fit=crop",
  math: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1080&auto=format&fit=crop",
  matematika: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?q=80&w=1080&auto=format&fit=crop",
  geography: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1080&auto=format&fit=crop",
  geografiya: "https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1080&auto=format&fit=crop",
  art: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=1080&auto=format&fit=crop",
  sanat: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=1080&auto=format&fit=crop",
  music: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1080&auto=format&fit=crop",
  muzika: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1080&auto=format&fit=crop",
  sport: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1080&auto=format&fit=crop",
  tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1080&auto=format&fit=crop",
  texno: "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1080&auto=format&fit=crop",
  literature: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=1080&auto=format&fit=crop",
  adabiyot: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=1080&auto=format&fit=crop",
  kitob: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?q=80&w=1080&auto=format&fit=crop",
  animals: "https://images.unsplash.com/photo-1472491235688-bdc81a63246e?q=80&w=1080&auto=format&fit=crop",
  hayvonlar: "https://images.unsplash.com/photo-1472491235688-bdc81a63246e?q=80&w=1080&auto=format&fit=crop",
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1080&auto=format&fit=crop",
  ovqat: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1080&auto=format&fit=crop",
  business: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1080&auto=format&fit=crop",
  biznes: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1080&auto=format&fit=crop",
  medicine: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1080&auto=format&fit=crop",
  tibbiyot: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=1080&auto=format&fit=crop",
  english: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1080&auto=format&fit=crop",
  ingliz: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?q=80&w=1080&auto=format&fit=crop",
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1080&auto=format&fit=crop";

// Firebase autentifikatsiya va profil tekshiruvi (TTS faqat ruxsatli foydalanuvchilarga)
const OWNER_EMAIL = "onlinemobi101@gmail.com";

type Role = "free" | "premium" | "pack10" | "admin";
type ApiAction = "generateQuiz" | "analyzeImages" | "imageKeyword" | "tts" | "ttsBatch" | "consumeVideoCredit";
type AuthenticatedUser = { uid: string; email?: string };
type UserProfile = { role: Role; videosCreated: number; premiumUntil: string | null };

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const RATE_LIMITS: Record<ApiAction, { max: number; windowMs: number }> = {
  generateQuiz: { max: 12, windowMs: 60 * 60 * 1000 },
  analyzeImages: { max: 20, windowMs: 60 * 60 * 1000 },
  imageKeyword: { max: 40, windowMs: 60 * 60 * 1000 },
  tts: { max: 40, windowMs: 10 * 60 * 1000 },
  ttsBatch: { max: 60, windowMs: 10 * 60 * 1000 },
  consumeVideoCredit: { max: 10, windowMs: 60 * 1000 },
};

function getBearerToken(req: IncomingMessage): string {
  const authHeader = String(req.headers?.authorization || "");
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

async function requireUser(req: IncomingMessage): Promise<AuthenticatedUser> {
  const token = getBearerToken(req);
  if (!token) throw new ApiError(401, "AUTH_REQUIRED");
  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new ApiError(401, "AUTH_REQUIRED");
  }
}

function normalizeProfile(data: FirebaseFirestore.DocumentData | undefined): UserProfile {
  const knownRoles = ["free", "premium", "pack10", "admin"];
  return {
    role: (knownRoles.includes(data?.role) ? data?.role : "free") as Role,
    videosCreated: Number.isFinite(data?.videosCreated) ? data!.videosCreated : 0,
    premiumUntil: typeof data?.premiumUntil === "string" ? data.premiumUntil : null,
  };
}

function effectiveRole(profile: UserProfile, email?: string): Role {
  if (email === OWNER_EMAIL || profile.role === "admin") return "admin";
  if (profile.role !== "premium") return profile.role;
  const expiresAt = profile.premiumUntil ? Date.parse(profile.premiumUntil) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? "premium" : "free";
}

async function getUserProfile(uid: string): Promise<UserProfile> {
  const snapshot = await adminDb.collection("users").doc(uid).get();
  if (!snapshot.exists) throw new ApiError(409, "PROFILE_REQUIRED");
  return normalizeProfile(snapshot.data());
}

async function enforceRateLimit(uid: string, action: ApiAction, cost = 1): Promise<void> {
  const config = RATE_LIMITS[action];
  const ref = adminDb.collection("apiUsage").doc(uid);
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const windowField = `${action}WindowStart`;
    const countField = `${action}Count`;
    const previousStart = data[windowField] instanceof Timestamp ? data[windowField].toMillis() : 0;
    const now = Date.now();
    const windowExpired = !previousStart || now - previousStart >= config.windowMs;
    const count = windowExpired ? 0 : Number(data[countField] || 0);
    if (count + cost > config.max) throw new ApiError(429, "RATE_LIMITED");
    transaction.set(ref, {
      [windowField]: windowExpired ? Timestamp.fromMillis(now) : data[windowField],
      [countField]: count + cost,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function requirePlanAccess(user: AuthenticatedUser, errorCode = "PLAN_LIMIT"): Promise<UserProfile & { effectiveRole: Role }> {
  const profile = await getUserProfile(user.uid);
  const role = effectiveRole(profile, user.email);
  const limit = role === "pack10" ? 10 : 1;
  if (role !== "admin" && role !== "premium" && profile.videosCreated >= limit) {
    throw new ApiError(403, errorCode);
  }
  return { ...profile, effectiveRole: role };
}

async function consumeVideoCredit(user: AuthenticatedUser) {
  const ref = adminDb.collection("users").doc(user.uid);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new ApiError(409, "PROFILE_REQUIRED");
    const profile = normalizeProfile(snapshot.data());
    const role = effectiveRole(profile, user.email);
    if (role === "admin" || role === "premium") return { ...profile, role };

    const limit = role === "pack10" ? 10 : 1;
    if (profile.videosCreated >= limit) throw new ApiError(403, "VIDEO_LIMIT");
    const videosCreated = profile.videosCreated + 1;
    transaction.update(ref, {
      videosCreated,
      lastVideoReservedAt: FieldValue.serverTimestamp(),
    });
    return { ...profile, role, videosCreated };
  });
}

// Vertex AI rejimi: API kalit o'rniga service account ishlatiladi (shahnoza loyihasidagi sxema).
// Matn modellari "global" lokatsiyada, TTS esa "us-central1" da ishlaydi.
const VERTEX_PROJECT = "gen-lang-client-0017562692";

function getVertexCredentials() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON sozlanmagan. Vercel Environment Variables-ga Vertex service account JSON qo'shing.");
  }
  const sa = JSON.parse(raw);
  if (typeof sa.private_key === "string") {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
}

let cachedAI: GoogleGenAI | null = null;
let cachedTTSAI: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!cachedAI) {
    cachedAI = new GoogleGenAI({
      vertexai: true,
      project: VERTEX_PROJECT,
      location: "global",
      googleAuthOptions: { credentials: getVertexCredentials(), scopes: ["https://www.googleapis.com/auth/cloud-platform"] },
    });
  }
  return cachedAI;
}

function getTTSAI(): GoogleGenAI {
  if (!cachedTTSAI) {
    cachedTTSAI = new GoogleGenAI({
      vertexai: true,
      project: VERTEX_PROJECT,
      location: "us-central1",
      googleAuthOptions: { credentials: getVertexCredentials(), scopes: ["https://www.googleapis.com/auth/cloud-platform"] },
    });
  }
  return cachedTTSAI;
}

async function getUnsplashImageForKeyword(keyword: string): Promise<string> {
  const normalized = (keyword || "").toLowerCase().trim();
  if (CURATED_IMAGES[normalized]) {
    return CURATED_IMAGES[normalized];
  }

  for (const key of Object.keys(CURATED_IMAGES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return CURATED_IMAGES[key];
    }
  }

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find a highly-popular, valid, active, and high-resolution Unsplash photo ID that perfectly matches the following search query/keyword: "${keyword}".
The photo must be vertical (or suitable for portrait 1080x1920 cropping), beautiful, atmospheric, and have rich background colors (avoid plain white or overly bright backgrounds since this is used as a full-screen vertical background for a video player).

Some examples of excellent Unsplash IDs:
- "space": "photo-1451187580459-43490279c0fa" (Deep blue galaxy)
- "history": "photo-1461360370896-922624d12aa1" (Ancient ruins)
- "nature": "photo-1470071459604-3b5ec3a7fe05" (Scenic mountains)
- "science": "photo-1507679799987-c73779587ccf" (Laboratory/Microscope)

Return ONLY the Unsplash photo ID as plain text (for example: photo-1541359927273-d76820fc43f9). Do not include any other text, quotes, or markdown. Only the ID itself.`,
    });

    const photoId = response.text?.trim() || "";
    const cleanId = photoId.replace(/[^a-zA-Z0-9-_]/g, "");
    if (cleanId && cleanId.startsWith("photo-")) {
      return `https://images.unsplash.com/${cleanId}?q=80&w=1080&auto=format&fit=crop`;
    }
  } catch (error) {
    console.error("AI photo search failed:", error);
  }

  return FALLBACK_IMAGE;
}

async function generateQuiz(topic: string, language: string) {
  const ai = getAI();

  const langPromptMap: Record<string, string> = {
    uz: "o'zbek tilida tuzing. Har bir savol 3 ta variantdan iborat bo'lsin. To'g'ri javob indeksini (0, 1 yoki 2) ko'rsating. Shu savol mavzusiga mos keluvchi 1 ta inglizcha so'z bering (masalan: history, space, nature) - bu 'imageKeyword' bo'ladi. Savol matni va variantlar faqat o'zbek tilida bo'lsin.",
    en: "in English. Each question must have 3 options. Provide the correct option index (0, 1, or 2). Provide 1 English keyword matching the question topic (e.g. history, space, nature) - this will be 'imageKeyword'. The question text and options must be in English.",
    ru: "на русском языке. Каждый вопрос должен состоять из 3 вариантов. Укажите индекс правильного ответа (0, 1 или 2). Дайте 1 английское слово, соответствующее теме вопроса (например: history, space, nature) — это будет 'imageKeyword'. Текст вопроса и варианты ответов должны быть на русском языке.",
    tr: "Türkçe olarak oluşturun. Her soru 3 seçenekten oluşmalıdır. Doğru cevap indeksini (0, 1 veya 2) belirtin. Soru konusuna uygun 1 İngilizce kelime verin (örneğin: history, space, nature) - bu 'imageKeyword' olacaktır. Soru metni ve seçenekler Türkçe olmalıdır."
  };

  const promptDetails = langPromptMap[language] || langPromptMap.uz;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Mavzu: ${topic}. Shu mavzuda 5 ta qiziqarli test savolini ${promptDetails}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Savol matni / Question text" },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 ta variant / 3 options" },
            correctOptionIndex: { type: Type.INTEGER, description: "To'g'ri javob indeksi (0, 1 yoki 2) / Correct answer index (0, 1 or 2)" },
            imageKeyword: { type: Type.STRING, description: "Mavzuga doir bitta inglizcha so'z / One English word for the topic" }
          },
          required: ["text", "options", "correctOptionIndex", "imageKeyword"]
        }
      }
    }
  });

  const data = JSON.parse(response.text || "[]");

  const questions = await Promise.all(
    data.map(async (q: any) => {
      const id = Math.random().toString(36).substr(2, 9);
      const backgroundImage = await getUnsplashImageForKeyword(q.imageKeyword);
      return { ...q, id, backgroundImage };
    })
  );

  return questions;
}

async function analyzeQuestionsForImages(questions: { text: string }[]): Promise<string[]> {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Quyidagi test savollarini tahlil qiling va har biriga mos keladigan eng muvofiq, inglizcha bitta so'zdan iborat kalit so'z (image search keyword) bering (masalan: history, galaxy, math, science, nature).

Savollar:
${questions.map((q, idx) => `${idx + 1}. Savol: ${q.text}`).join("\n")}

Javobni quyidagi JSON formatida qaytaring:
[ "keyword1", "keyword2", ... ]`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}

async function generateTTS(text: string, voiceName: string): Promise<string | null> {
  const ai = getTTSAI();
  const response = await ai.models.generateContent({
    model: "gemini-3.1-flash-tts-preview",
    contents: text,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
}

// Bir nechta yozuvni cheklangan parallellik bilan qayta ishlaydi (bir vaqtda ko'pi bilan `limit` ta).
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Vaqtinchalik 429 (rate limit) xatolarida qisqa backoff bilan qayta urinadi.
async function generateTTSWithRetry(text: string, voiceName: string, retries = 2): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateTTS(text, voiceName);
    } catch (error: any) {
      const message = error?.message || String(error);
      const is429 = error?.status === 429 || message.includes("429");
      if (is429 && !message.includes("quota") && attempt < retries) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      throw error;
    }
  }
}

// Bitta so'rovda bir nechta klipni yaratadi. Kvota/rate-limit xatosi butun batch'ni to'xtatadi
// (foydalanuvchi sababini ko'radi), boshqa vaqtinchalik xatolarda esa shu klip null bo'lib qoladi.
async function generateTTSBatch(items: { text: string; voiceName: string }[]): Promise<(string | null)[]> {
  return mapWithConcurrency(items, 3, async (item) => {
    try {
      return await generateTTSWithRetry(item.text, item.voiceName);
    } catch (error: any) {
      const message = error?.message || String(error);
      if (message.includes("quota") || error?.status === 429 || message.includes("429")) throw error;
      console.error("Batch TTS klipi muvaffaqiyatsiz:", message);
      return null;
    }
  });
}

// Vercel Node funksiyasida req.body avtomatik parse qilinadi,
// Vite dev-middleware'da esa oqimdan o'zimiz o'qiymiz.
async function readBody(req: IncomingMessage & { body?: any }): Promise<any> {
  if (req.body !== undefined) {
    const serialized = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(serialized, "utf-8") > 64 * 1024) throw new ApiError(413, "PAYLOAD_TOO_LARGE");
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.length;
    if (totalBytes > 64 * 1024) throw new ApiError(413, "PAYLOAD_TOO_LARGE");
    chunks.push(buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : {};
}

function sendJSON(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

export default async function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  if (req.method !== "POST") {
    sendJSON(res, 405, { error: "Method not allowed" });
    return;
  }

  let body: any;
  try {
    body = await readBody(req);
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    sendJSON(res, apiError?.status || 400, { error: apiError?.message || "Invalid JSON body" });
    return;
  }

  const action = body?.action as ApiAction;

  try {
    if (!Object.prototype.hasOwnProperty.call(RATE_LIMITS, action)) {
      throw new ApiError(400, "Noma'lum action");
    }
    const user = await requireUser(req);
    // Batch TTS narxi = kliplar soni (bitta tranzaksiyada), qolganlari uchun 1.
    const cost = action === "ttsBatch" && Array.isArray(body?.items)
      ? Math.min(Math.max(body.items.length, 1), 8)
      : 1;
    await enforceRateLimit(user.uid, action, cost);

    switch (action) {
      case "generateQuiz": {
        const { topic, language } = body;
        if (!topic || typeof topic !== "string" || topic.trim().length > 200) throw new ApiError(400, "INVALID_TOPIC");
        const selectedLanguage = ["uz", "en", "ru", "tr"].includes(language) ? language : "uz";
        await requirePlanAccess(user);
        const questions = await generateQuiz(topic.trim(), selectedLanguage);
        sendJSON(res, 200, { questions });
        return;
      }
      case "analyzeImages": {
        const { questions } = body;
        if (!Array.isArray(questions) || questions.length < 1 || questions.length > 20 ||
            questions.some((q: any) => typeof q?.text !== "string" || q.text.length > 500)) {
          throw new ApiError(400, "INVALID_QUESTIONS");
        }
        await requirePlanAccess(user);
        const keywords = await analyzeQuestionsForImages(questions);
        sendJSON(res, 200, { keywords });
        return;
      }
      case "imageKeyword": {
        const { keyword } = body;
        if (!keyword || typeof keyword !== "string" || keyword.trim().length > 100) throw new ApiError(400, "INVALID_KEYWORD");
        await requirePlanAccess(user);
        const url = await getUnsplashImageForKeyword(keyword.trim());
        sendJSON(res, 200, { url });
        return;
      }
      case "tts": {
        const { text, voiceName } = body;
        if (!text || typeof text !== "string" || text.length > 2000) throw new ApiError(400, "INVALID_TEXT");
        const allowedVoices = ["Kore", "Aoede", "Puck", "Charon", "Fenrir"];
        const selectedVoice = allowedVoices.includes(voiceName) ? voiceName : "Kore";
        const profile = await requirePlanAccess(user, "TTS_LIMIT");
        if (selectedVoice !== "Kore" && profile.effectiveRole !== "premium" && profile.effectiveRole !== "admin") {
          throw new ApiError(403, "PREMIUM_VOICE_REQUIRED");
        }
        const audio = await generateTTS(text, selectedVoice);
        sendJSON(res, 200, { audio });
        return;
      }
      case "ttsBatch": {
        const { items } = body;
        if (!Array.isArray(items) || items.length < 1 || items.length > 8) throw new ApiError(400, "INVALID_BATCH");
        const allowedVoices = ["Kore", "Aoede", "Puck", "Charon", "Fenrir"];
        const normalized = items.map((item: any) => {
          if (!item || typeof item.text !== "string" || !item.text.trim() || item.text.length > 2000) {
            throw new ApiError(400, "INVALID_TEXT");
          }
          return {
            text: item.text,
            voiceName: allowedVoices.includes(item.voiceName) ? item.voiceName : "Kore",
          };
        });
        const profile = await requirePlanAccess(user, "TTS_LIMIT");
        const usesPremiumVoice = normalized.some((item) => item.voiceName !== "Kore");
        if (usesPremiumVoice && profile.effectiveRole !== "premium" && profile.effectiveRole !== "admin") {
          throw new ApiError(403, "PREMIUM_VOICE_REQUIRED");
        }
        const audios = await generateTTSBatch(normalized);
        sendJSON(res, 200, { audios });
        return;
      }
      case "consumeVideoCredit": {
        const result = await consumeVideoCredit(user);
        sendJSON(res, 200, result);
        return;
      }
      default:
        throw new ApiError(400, "Noma'lum action");
    }
  } catch (error: any) {
    if (error instanceof ApiError) {
      sendJSON(res, error.status, { error: error.message });
      return;
    }
    const message = error?.message || String(error);
    const isRateLimited = error?.status === 429 || message.includes("429");
    if (isRateLimited) {
      const isQuota = message.includes("quota");
      sendJSON(res, 429, { error: isQuota ? "QUOTA_EXCEEDED" : "RATE_LIMITED" });
      return;
    }
    console.error(`API action "${action}" failed:`, error);
    sendJSON(res, 500, { error: message });
  }
}
