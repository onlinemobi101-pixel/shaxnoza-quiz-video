// Vercel serverless funksiya: barcha Gemini chaqiruvlari shu yerda bajariladi.
// Autentifikatsiya Vertex AI service account orqali (GCP_SERVICE_ACCOUNT_JSON) —
// maxfiy qiymatlar faqat server muhitida qoladi va klient bundle'iga tushmaydi.
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { IncomingMessage, ServerResponse } from "http";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { isAdminEmail } from "../shared/admins.js";
import { adminAuth, adminDb } from "./firebase-admin.js";
import {
  AuthenticatedUser,
  UsageError,
  completeVideoExport,
  consumeAiBudget,
  failVideoExport,
  getAdminUsageSummary,
  recordModelUsage,
  refundAiBudget,
  requirePlanAccess,
  reserveVideoExport,
} from "./usage.js";

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

type ApiAction =
  | "generateQuiz"
  | "analyzeImages"
  | "imageKeyword"
  | "tts"
  | "ttsBatch"
  | "reserveVideoExport"
  | "completeVideoExport"
  | "failVideoExport"
  | "getAdminUsageSummary";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// vercel.json dagi maxDuration = 60s. Vercel funksiyani o'ldirib 504 qaytarishidan oldin
// o'zimiz qaytishimiz kerak — aks holda javob ham, byudjet refund'i ham bajarilmay qoladi.
// Render/Vercel Pro'da chegara kattaroq, shuning uchun env orqali ko'tarish mumkin.
const TTS_BATCH_BUDGET_MS = Math.max(5_000, Number(process.env.TTS_BATCH_BUDGET_MS) || 50_000);
// Vercel javob tanasi ~4.5MB. Base64 audio JSON ichida shuncha belgi egallaydi.
const MAX_TTS_RESPONSE_CHARS = 3_500_000;
// Yangi klip boshlashdan oldin uning hajmini oldindan bilmaymiz, shuning uchun ehtiyotkor
// baho bilan "joy band qilamiz". Eng uzun klip — javob + 18 so'zli izoh (~10s audio,
// base64'da ~640K belgi). Kuzatilgan haqiqiy hajm bahodan oshsa, baho o'sib boradi.
const TTS_CLIP_ESTIMATE_CHARS = 700_000;

const RATE_LIMITS: Record<ApiAction, { max: number; windowMs: number }> = {
  generateQuiz: { max: 12, windowMs: 60 * 60 * 1000 },
  analyzeImages: { max: 20, windowMs: 60 * 60 * 1000 },
  imageKeyword: { max: 40, windowMs: 60 * 60 * 1000 },
  tts: { max: 40, windowMs: 10 * 60 * 1000 },
  ttsBatch: { max: 60, windowMs: 10 * 60 * 1000 },
  reserveVideoExport: { max: 10, windowMs: 60 * 1000 },
  completeVideoExport: { max: 20, windowMs: 60 * 1000 },
  failVideoExport: { max: 20, windowMs: 60 * 1000 },
  getAdminUsageSummary: { max: 30, windowMs: 60 * 1000 },
};

function getBearerToken(req: IncomingMessage): string {
  const authHeader = String(req.headers?.authorization || "");
  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
}

async function requireUser(req: IncomingMessage): Promise<AuthenticatedUser> {
  const token = getBearerToken(req);
  if (!token) throw new ApiError(401, "AUTH_REQUIRED");
  try {
    // Signature, issuer, audience and expiry are verified here. Revocation
    // checks require an extra privileged Auth API call and can make valid
    // local sessions fail when only application-default credentials exist.
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    throw new ApiError(401, "AUTH_REQUIRED");
  }
}

async function enforceRateLimit(user: AuthenticatedUser, action: ApiAction, cost = 1): Promise<void> {
  if (isAdminEmail(user.email)) {
    return; // Admins are exempt from rate limiting
  }

  const config = RATE_LIMITS[action];
  const ref = adminDb.collection("apiUsage").doc(user.uid);
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

// Vertex AI rejimi: API kalit o'rniga service account ishlatiladi.
// Matn modellari "global" lokatsiyada, TTS esa "us-central1" da ishlaydi.
//
// DIQQAT: bu Firebase loyihasidan BOSHQA GCP loyihasi (Firebase uchun —
// api/firebase-admin.ts). Boshqa loyihaga ko'chirilganda VERTEX_PROJECT env orqali
// almashtiriladi; standart qiymat hozirgi ishlab turgan sozlamani saqlaydi.
const VERTEX_PROJECT = process.env.VERTEX_PROJECT || "gen-lang-client-0604912271";

function getVertexCredentials() {
  const raw = process.env.GCP_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GCP_SERVICE_ACCOUNT_JSON sozlanmagan. Host'ning Environment Variables bo'limiga Vertex service account JSON qo'shing.");
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

function base64ByteLength(value: string | null | undefined): number {
  if (!value) return 0;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

async function getUnsplashImageForKeyword(
  keyword: string,
  user?: AuthenticatedUser,
  trackImageLookup = true,
): Promise<string> {
  const normalized = (keyword || "").toLowerCase().trim();
  if (CURATED_IMAGES[normalized]) {
    if (user && trackImageLookup) {
      await recordModelUsage(user, {
        action: "imageLookup",
        model: "unsplash-curated",
        kind: "image",
        imageLookups: 1,
      });
    }
    return CURATED_IMAGES[normalized];
  }

  for (const key of Object.keys(CURATED_IMAGES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      if (user && trackImageLookup) {
        await recordModelUsage(user, {
          action: "imageLookup",
          model: "unsplash-curated",
          kind: "image",
          imageLookups: 1,
        });
      }
      return CURATED_IMAGES[key];
    }
  }

  try {
    const ai = getAI();
    const startedAt = Date.now();
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
    if (user) {
      await recordModelUsage(user, {
        action: "imageKeyword",
        model: "gemini-3-flash-preview",
        kind: "text",
        usage: response.usageMetadata,
        imageLookups: trackImageLookup ? 1 : 0,
        durationMs: Date.now() - startedAt,
      });
    }

    const photoId = response.text?.trim() || "";
    const cleanId = photoId.replace(/[^a-zA-Z0-9-_]/g, "");
    if (cleanId && cleanId.startsWith("photo-")) {
      return `https://images.unsplash.com/${cleanId}?q=80&w=1080&auto=format&fit=crop`;
    }
  } catch (error) {
    console.error("AI photo search failed:", error);
    if (user && trackImageLookup) {
      await recordModelUsage(user, {
        action: "imageLookup",
        model: "unsplash-fallback",
        kind: "image",
        imageLookups: 1,
      });
    }
  }

  return FALLBACK_IMAGE;
}

async function generateQuizChunk(
  topic: string,
  language: string,
  count: number,
  user: AuthenticatedUser,
) {
  const ai = getAI();

  const langPromptMap: Record<string, string> = {
    uz: "o'zbek tilida tuzing. Har bir savol 3 ta variantdan iborat bo'lsin. To'g'ri javob indeksini (0, 1 yoki 2) ko'rsating. Har bir javob uchun 8–18 so'zli, takrorlanmaydigan qisqa tushuntirish yozing. Savol matni, variantlar va tushuntirish o'zbek tilida bo'lsin.",
    en: "in natural English. Each question must have exactly 3 options. Provide the correct option index (0, 1, or 2). Add a unique, accurate 8–18 word English explanation that teaches why the answer is correct. The question, options, and explanation must all be in English.",
    ru: "на русском языке. Каждый вопрос должен состоять ровно из 3 вариантов. Укажите индекс правильного ответа (0, 1 или 2). Добавьте уникальное точное объяснение ответа длиной 8–18 слов. Вопрос, варианты и объяснение должны быть на русском языке.",
    tr: "Türkçe olarak oluşturun. Her soru tam 3 seçenekten oluşmalıdır. Doğru cevap indeksini (0, 1 veya 2) belirtin. Doğru cevabı öğreten, 8–18 kelimelik özgün ve doğru bir açıklama ekleyin. Soru, seçenekler ve açıklama Türkçe olmalıdır."
  };

  const promptDetails = langPromptMap[language] || langPromptMap.uz;

  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Topic: ${topic}.
Create exactly ${count} varied quiz questions ${promptDetails}
STRICT LANGUAGE MATCHING RULE: Detect the language of the topic ("${topic}") or target language ("${language}"). ALL generated question texts, 3 option choices, and explanations MUST be written 100% in that exact target language. If the topic is in Uzbek (e.g. "Kino va Mashhur Filmlar"), write all questions, options, and explanations in 100% natural, fluent Uzbek. If in Russian, write 100% in Russian. Do not mix languages or fallback to English.
CRITICAL CORRECTNESS RULES:
1. FIRST decide the correct answer, THEN place it at a RANDOM position (0, 1, or 2) among the 3 options.
2. The correctOptionIndex MUST exactly match the 0-based position of the correct answer in the options array.
3. DOUBLE-CHECK: After generating each question, verify that options[correctOptionIndex] is truly the correct answer. If not, fix the index.
4. The explanation must clearly explain why the answer at correctOptionIndex is correct.
5. All facts must be 100% accurate and up-to-date. Do not invent fake facts.
6. Each question must have exactly 3 distinct, plausible options. No duplicate or near-identical options.
Avoid outdated facts, duplicate questions, near-identical wording, trick questions, and ambiguous answers.
Set imageKeyword to exactly one of these supported English categories:
history, space, science, nature, math, geography, art, music, sport, tech, literature, animals, food, business, medicine, english.`,
    config: {
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING, description: "Savol matni / Question text" },
            options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "3 ta variant / 3 options" },
            correctOptionIndex: { type: Type.INTEGER, description: "To'g'ri javob indeksi (0, 1 yoki 2) / Correct answer index (0, 1 or 2)" },
            explanation: { type: Type.STRING, description: "8–18 so'zli qisqa tushuntirish / Concise 8–18 word explanation" },
            imageKeyword: { type: Type.STRING, description: "Mavzuga doir bitta inglizcha so'z / One English word for the topic" }
          },
          required: ["text", "options", "correctOptionIndex", "explanation", "imageKeyword"]
        }
      }
    }
  });
  const data = JSON.parse(response.text || "[]");
  const generatedCount = Array.isArray(data) ? data.length : 0;
  await recordModelUsage(user, {
    action: "generateQuiz",
    model: "gemini-3-flash-preview",
    kind: "text",
    usage: response.usageMetadata,
    imageLookups: generatedCount,
    questionCount: generatedCount,
    durationMs: Date.now() - startedAt,
  });

  const questions = await Promise.all(
    data.map(async (q: any) => {
      const id = Math.random().toString(36).substr(2, 9);
      const backgroundImage = await getUnsplashImageForKeyword(q.imageKeyword, user, false);
      return { ...q, id, backgroundImage };
    })
  );

  return questions;
}

async function generateQuiz(
  topic: string,
  language: string,
  count: number,
  user: AuthenticatedUser,
) {
  if (count > 10) {
    const chunk1 = Math.ceil(count / 2);
    const chunk2 = count - chunk1;
    const [part1, part2] = await Promise.all([
      generateQuizChunk(topic, language, chunk1, user),
      generateQuizChunk(topic, language, chunk2, user),
    ]);
    return [...part1, ...part2];
  }
  return generateQuizChunk(topic, language, count, user);
}

async function analyzeQuestionsForImages(
  questions: { text: string }[],
  user: AuthenticatedUser,
): Promise<string[]> {
  const ai = getAI();
  const startedAt = Date.now();
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
  await recordModelUsage(user, {
    action: "analyzeImages",
    model: "gemini-3-flash-preview",
    kind: "text",
    usage: response.usageMetadata,
    durationMs: Date.now() - startedAt,
  });

  return JSON.parse(response.text || "[]");
}

async function generateTTS(
  text: string,
  voiceName: string,
  user: AuthenticatedUser,
): Promise<string | null> {
  const ai = getTTSAI();
  const startedAt = Date.now();
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

  const audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  await recordModelUsage(user, {
    action: "tts",
    model: "gemini-3.1-flash-tts-preview",
    kind: "tts",
    usage: response.usageMetadata,
    textCharacters: text.length,
    audioBytes: base64ByteLength(audio),
    durationMs: Date.now() - startedAt,
  });
  return audio;
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
// `deadlineAt` dan oshib ketadigan backoff'ni kutmaymiz — kechikkan qayta urinish
// funksiyani 504 ga olib boradi va butun batch yo'qoladi.
async function generateTTSWithRetry(
  text: string,
  voiceName: string,
  user: AuthenticatedUser,
  deadlineAt: number,
  retries = 2,
): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateTTS(text, voiceName, user);
    } catch (error: any) {
      const message = error?.message || String(error);
      const is429 = error?.status === 429 || message.includes("429");
      const backoffMs = (attempt + 1) * 2000;
      if (
        is429 && !message.includes("quota") && attempt < retries &&
        Date.now() + backoffMs < deadlineAt
      ) {
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw error;
    }
  }
}

// Bitta so'rovda bir nechta klipni yaratadi. Kvota/rate-limit xatosi butun batch'ni to'xtatadi
// (foydalanuvchi sababini ko'radi), boshqa vaqtinchalik xatolarda esa shu klip null bo'lib qoladi.
//
// Ikkita platforma chegarasi bor va ikkalasi ham butun so'rovni yiqitadi:
//   1. Funksiya vaqti (Vercel maxDuration = 60s) — oshib ketsa 504, hech qanday javob yo'q.
//   2. Javob tanasi (~4.5MB) — oshib ketsa javob yetkazilmaydi.
// Shuning uchun chegaraga yaqinlashganda qolgan kliplarni YARATMAYMIZ va ularni null
// qilib qaytaramiz. Klient yetishmaganlarini keyingi so'rovda so'rab oladi, byudjet esa
// refundAiBudget orqali qaytariladi. Qisman natija — yiqilgan so'rovdan yaxshi.
async function generateTTSBatch(
  items: { text: string; voiceName: string }[],
  user: AuthenticatedUser,
  deadlineAt: number,
): Promise<(string | null)[]> {
  let committedChars = 0;
  let inFlightClips = 0;
  let clipEstimateChars = TTS_CLIP_ESTIMATE_CHARS;

  return mapWithConcurrency(items, 3, async (item) => {
    if (Date.now() >= deadlineAt) return null;
    // Tugagan kliplar + hozir uchayotganlar + shu klip uchun baho. Faqat tugaganlarini
    // sanash yetarli emas: parallellik 3 bo'lgani uchun yangi klip boshlanayotganda
    // oldingilarning aksariyati hali qaytmagan bo'ladi.
    if (committedChars + (inFlightClips + 1) * clipEstimateChars > MAX_TTS_RESPONSE_CHARS) return null;

    inFlightClips++;
    try {
      const audio = await generateTTSWithRetry(item.text, item.voiceName, user, deadlineAt);
      const audioChars = audio?.length || 0;
      committedChars += audioChars;
      // Haqiqiy klip bahodan uzun chiqdi — keyingi bahoni shunga moslaymiz.
      if (audioChars > clipEstimateChars) clipEstimateChars = audioChars;
      return audio;
    } catch (error: any) {
      const message = error?.message || String(error);
      if (message.includes("quota") || error?.status === 429 || message.includes("429")) throw error;
      console.error("Batch TTS klipi muvaffaqiyatsiz:", message);
      return null;
    } finally {
      inFlightClips--;
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
  // Deadline so'rov boshidan hisoblanadi — auth, rate-limit va byudjet tranzaksiyalari
  // ham funksiya vaqtidan yeydi.
  const requestStartedAt = Date.now();
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
    await enforceRateLimit(user, action, cost);

    switch (action) {
      case "generateQuiz": {
        const { topic, language, count } = body;
        if (!topic || typeof topic !== "string" || topic.trim().length > 200) throw new ApiError(400, "INVALID_TOPIC");
        const isAdmin = isAdminEmail(user.email);
        const requestedCount = Number(count ?? 5);
        if (!Number.isInteger(requestedCount) || requestedCount < 5 || requestedCount > 30) {
          throw new ApiError(400, "INVALID_QUESTION_COUNT");
        }
        if (!isAdmin && requestedCount > 5) {
          throw new ApiError(403, "CLIENTS_LIMITED_TO_5_QUESTIONS");
        }
        const selectedLanguage = ["uz", "en", "ru", "tr"].includes(language) ? language : "uz";
        await requirePlanAccess(user);
        await consumeAiBudget(user, "quizzes", 1, "AI_QUIZ_LIMIT");
        let questions;
        try {
          questions = await generateQuiz(topic.trim(), selectedLanguage, requestedCount, user);
        } catch (error) {
          await refundAiBudget(user, "quizzes", 1);
          throw error;
        }
        sendJSON(res, 200, { questions });
        return;
      }
      case "analyzeImages": {
        const { questions } = body;
        if (!Array.isArray(questions) || questions.length < 1 || questions.length > 30 ||
            questions.some((q: any) => typeof q?.text !== "string" || q.text.length > 500)) {
          throw new ApiError(400, "INVALID_QUESTIONS");
        }
        await requirePlanAccess(user);
        await consumeAiBudget(user, "imageCalls", 1, "AI_IMAGE_LIMIT");
        let keywords;
        try {
          keywords = await analyzeQuestionsForImages(questions, user);
        } catch (error) {
          await refundAiBudget(user, "imageCalls", 1);
          throw error;
        }
        sendJSON(res, 200, { keywords });
        return;
      }
      case "imageKeyword": {
        const { keyword } = body;
        if (!keyword || typeof keyword !== "string" || keyword.trim().length > 100) throw new ApiError(400, "INVALID_KEYWORD");
        await requirePlanAccess(user);
        await consumeAiBudget(user, "imageCalls", 1, "AI_IMAGE_LIMIT");
        const url = await getUnsplashImageForKeyword(keyword.trim(), user);
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
        await consumeAiBudget(user, "ttsClips", 1, "AI_VOICE_LIMIT");
        let audio: string | null;
        try {
          audio = await generateTTS(text, selectedVoice, user);
        } catch (error) {
          await refundAiBudget(user, "ttsClips", 1);
          throw error;
        }
        // Model audiosiz javob qaytardi — klipni byudjetga qaytaramiz.
        if (!audio) await refundAiBudget(user, "ttsClips", 1);
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
        await consumeAiBudget(user, "ttsClips", normalized.length, "AI_VOICE_LIMIT");
        let audios: (string | null)[];
        try {
          audios = await generateTTSBatch(normalized, user, requestStartedAt + TTS_BATCH_BUDGET_MS);
        } catch (error) {
          await refundAiBudget(user, "ttsClips", normalized.length);
          throw error;
        }
        // Yaratilmagan kliplar uchun byudjet yechilmasin.
        const failedClips = audios.filter((clip) => !clip).length;
        if (failedClips > 0) await refundAiBudget(user, "ttsClips", failedClips);
        sendJSON(res, 200, { audios });
        return;
      }
      case "reserveVideoExport": {
        const result = await reserveVideoExport(user, {
          format: body?.format,
          questionCount: body?.questionCount,
          targetDuration: body?.targetDuration,
          force: Boolean(body?.force),
        });
        sendJSON(res, 200, result);
        return;
      }
      case "completeVideoExport": {
        const result = await completeVideoExport(
          user,
          String(body?.reservationId || ""),
          body?.metrics || {},
        );
        sendJSON(res, 200, result);
        return;
      }
      case "failVideoExport": {
        await failVideoExport(
          user,
          String(body?.reservationId || ""),
          String(body?.failureCode || "EXPORT_FAILED"),
        );
        sendJSON(res, 200, { ok: true });
        return;
      }
      case "getAdminUsageSummary": {
        const result = await getAdminUsageSummary(user, body?.month);
        sendJSON(res, 200, result);
        return;
      }
      default:
        throw new ApiError(400, "Noma'lum action");
    }
  } catch (error: any) {
    if (error instanceof ApiError || error instanceof UsageError) {
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
