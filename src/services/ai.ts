import { Question } from "../types";

// Barcha Gemini chaqiruvlari endi /api/ai serverless funksiyasi orqali bajariladi.
// API kaliti klient bundle'ida saqlanmaydi.

async function callAPI(payload: Record<string, unknown>): Promise<any> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || `API xatosi (${response.status})`);
  }
  return data;
}

export async function getUnsplashImageForKeyword(keyword: string): Promise<string> {
  try {
    const data = await callAPI({ action: "imageKeyword", keyword });
    if (data.url) return data.url;
  } catch (error) {
    console.error("Image keyword lookup failed:", error);
  }
  // Beautiful fallback default
  return "https://images.unsplash.com/photo-1505506874110-6a7a48e14c49?q=80&w=1080&auto=format&fit=crop";
}

export async function generateQuizAI(topic: string, language: string = "uz"): Promise<Question[] | null> {
  try {
    const data = await callAPI({ action: "generateQuiz", topic, language });
    return data.questions || null;
  } catch (error) {
    console.error("AI generation failed:", error);
    return null;
  }
}

export async function analyzeQuestionsForImages(questions: { text: string }[]): Promise<string[] | null> {
  try {
    const data = await callAPI({
      action: "analyzeImages",
      questions: questions.map((q) => ({ text: q.text })),
    });
    return data.keywords || null;
  } catch (error) {
    console.error("AI question image analysis failed:", error);
    return null;
  }
}
