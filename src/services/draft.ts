import { Quiz } from "../types";
import { safeGetItem, safeRemoveItem, safeSetItem } from "./storage";

// Foydalanuvchining oxirgi ishini localStorage'da saqlab turadi (brauzer yopilib
// qolsa yo'qolmasligi uchun). Audio bu yerda saqlanmaydi — u tugma bilan qayta
// yaratiladi va hajmi juda katta.
export const AUTOSAVE_KEY = "qv_autosaved_quiz_v3";

export type AutosaveStatus = "ok" | "degraded" | "failed";

function withoutAudio(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map(({ audioBase64, correctAudioBase64, ...rest }) => rest),
  };
}

// Yuklangan rasmlar data: URL sifatida saqlanadi va odatda hajmning katta qismini
// aynan ular egallaydi. Joy yetmasa avval shularni tashlaymiz: savollar matni
// (qayta yozib bo'lmaydigan mehnat) rasmlardan muhimroq.
function withoutEmbeddedImages(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((question) =>
      question.backgroundImage?.startsWith("data:")
        ? { ...question, backgroundImage: "" }
        : question,
    ),
  };
}

function write(quiz: Quiz): boolean {
  return safeSetItem(AUTOSAVE_KEY, JSON.stringify(quiz));
}

// Bosqichma-bosqich pasayadi: to'liq -> rasmlarsiz -> umuman saqlamaydi.
// Qaytgan holat UI'da ko'rsatiladi — ilgari xato jimgina yutilar va foydalanuvchi
// ishi saqlanmayotganini bilmasdan davom etaverardi.
export function saveQuizDraft(quiz: Quiz): AutosaveStatus {
  const light = withoutAudio(quiz);
  if (write(light)) return "ok";
  if (write(withoutEmbeddedImages(light))) return "degraded";

  // Hech narsa sig'masa, eskirgan qoralamani qoldirmaymiz: keyingi ochilishda u
  // joriy ish deb tiklanib, foydalanuvchini chalg'itadi.
  safeRemoveItem(AUTOSAVE_KEY);
  return "failed";
}

// Eski versiyalardagi namuna testlar avtosaqlashga tushib qolgan; ularni tiklash
// o'rniga joriy standart quiz ko'rsatiladi.
function isLegacyStarterQuiz(quiz: { title?: unknown; questions: unknown[] }): boolean {
  const title = typeof quiz.title === "string" ? quiz.title : "";
  return (
    (title === "English Knowledge Challenge" && quiz.questions.length <= 3) ||
    title.includes("20 General Knowledge Questions")
  );
}

export function loadQuizDraft(fallback: Quiz): Quiz {
  try {
    const saved = safeGetItem(AUTOSAVE_KEY);
    if (!saved) return fallback;

    const parsed = JSON.parse(saved);
    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return fallback;
    }
    if (isLegacyStarterQuiz(parsed)) return fallback;

    return parsed as Quiz;
  } catch (error) {
    console.warn("Avtosaqlangan ishni tiklab bo'lmadi:", error);
    return fallback;
  }
}
