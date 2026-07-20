import { Question } from "../types";
import { auth } from "./firebase";

// Barcha Gemini chaqiruvlari endi /api/ai serverless funksiyasi orqali bajariladi.
// API kaliti klient bundle'ida saqlanmaydi.

async function callAPI(payload: Record<string, unknown>): Promise<any> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) throw new Error("AUTH_REQUIRED");
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `API xatosi (${response.status})`);
  }
  return data;
}

export async function getUnsplashImageForKeyword(keyword: string): Promise<string> {
  const data = await callAPI({ action: "imageKeyword", keyword });
  if (data.url) return data.url;
  // Beautiful fallback default
  return "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1080&auto=format&fit=crop";
}

export async function generateQuizAI(topic: string, language: string = "uz", count: number = 5): Promise<Question[] | null> {
  const data = await callAPI({ action: "generateQuiz", topic, language, count });
  return data.questions || null;
}

export async function analyzeQuestionsForImages(questions: { text: string }[]): Promise<string[] | null> {
  if (questions.length > 20) {
    const keywords: string[] = [];
    for (let index = 0; index < questions.length; index += 20) {
      const chunk = await analyzeQuestionsForImages(questions.slice(index, index + 20));
      if (!chunk) return null;
      keywords.push(...chunk);
    }
    return keywords;
  }
  const data = await callAPI({
    action: "analyzeImages",
    questions: questions.map((q) => ({ text: q.text })),
  });
  return data.keywords || null;
}
