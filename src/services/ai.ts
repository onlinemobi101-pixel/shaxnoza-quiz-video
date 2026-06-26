import { GoogleGenAI, Type } from "@google/genai";
import { Question } from "../types";

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

export async function getUnsplashImageForKeyword(keyword: string): Promise<string> {
  const normalized = keyword.toLowerCase().trim();
  if (CURATED_IMAGES[normalized]) {
    return CURATED_IMAGES[normalized];
  }

  // Attempt to match partial keyword
  for (const key of Object.keys(CURATED_IMAGES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return CURATED_IMAGES[key];
    }
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

  // Beautiful fallback default
  return "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1080&auto=format&fit=crop";
}

export async function generateQuizAI(topic: string, language: string = "uz"): Promise<Question[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
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
        return {
          ...q,
          id,
          backgroundImage
        };
      })
    );

    return questions;
  } catch (error) {
    console.error("AI generation failed:", error);
    return null;
  }
}

export async function analyzeQuestionsForImages(questions: { text: string }[]): Promise<string[] | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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

    const data = JSON.parse(response.text || "[]");
    return data;
  } catch (error) {
    console.error("AI question image analysis failed:", error);
    return null;
  }
}

