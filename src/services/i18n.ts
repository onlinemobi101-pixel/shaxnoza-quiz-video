// Video ichida KO'RINADIGAN va ESHITILADIGAN matnlar — quiz tiliga mos.
// Diqqat: bu ilova UI tili emas (u o'zbekcha qoladi), faqat video kontenti.
import { Quiz } from "../types";

export type QuizLanguage = NonNullable<Quiz["language"]>;

export interface VideoStrings {
  questionBadge: string; // "SAVOL" (badge: SAVOL 1/5)
  thinking: string; // taymer yorlig'i
  correctAnswer: string; // javob ochilgandagi yorliq
  introBadge: string; // intro'dagi rangli badge
  introCount: (n: number) => string; // intro pastki matni
  outroTitle: string;
  outroSubtitle: string;
  seconds: string; // preview taymeridagi "Soniya"
  ready: string; // preview taymeridagi "Tayyor"
  ttsCorrect: (letter: string, option: string, explanation?: string) => string; // TTS o'qiydigan javob va izoh
}

const STRINGS: Record<QuizLanguage, VideoStrings> = {
  uz: {
    questionBadge: "SAVOL",
    thinking: "O'YLASH VAQTI...",
    correctAnswer: "TO'G'RI JAVOB",
    introBadge: "NECHTASINI TOPASIZ?",
    introCount: (n) => `${n} ta savol • Javoblari ichida`,
    outroTitle: "Videoga Like Bosing!",
    outroSubtitle: "Kanalga obuna bo'lishni unutmang",
    seconds: "Soniya",
    ready: "Tayyor",
    ttsCorrect: (letter, option, explanation) =>
      `To'g'ri javob: ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
  en: {
    questionBadge: "QUESTION",
    thinking: "TIME TO THINK...",
    correctAnswer: "CORRECT ANSWER",
    introBadge: "HOW MANY CAN YOU GET?",
    introCount: (n) => `${n} questions • Answers inside`,
    outroTitle: "Like this video!",
    outroSubtitle: "Don't forget to subscribe",
    seconds: "Seconds",
    ready: "Done",
    ttsCorrect: (letter, option, explanation) =>
      `The correct answer is ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
  ru: {
    questionBadge: "ВОПРОС",
    thinking: "ВРЕМЯ ПОДУМАТЬ...",
    correctAnswer: "ПРАВИЛЬНЫЙ ОТВЕТ",
    introBadge: "СКОЛЬКО УГАДАЕШЬ?",
    introCount: (n) => `Вопросов: ${n} • Ответы внутри`,
    outroTitle: "Ставь лайк!",
    outroSubtitle: "Не забудь подписаться на канал",
    seconds: "Секунды",
    ready: "Готово",
    ttsCorrect: (letter, option, explanation) =>
      `Правильный ответ: ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
  tr: {
    questionBadge: "SORU",
    thinking: "DÜŞÜNME ZAMANI...",
    correctAnswer: "DOĞRU CEVAP",
    introBadge: "KAÇINI BİLEBİLİRSİN?",
    introCount: (n) => `${n} soru • Cevaplar içinde`,
    outroTitle: "Videoyu beğen!",
    outroSubtitle: "Kanala abone olmayı unutma",
    seconds: "Saniye",
    ready: "Hazır",
    ttsCorrect: (letter, option, explanation) =>
      `Doğru cevap: ${letter}, ${option}.${explanation ? ` ${explanation}` : ""}`,
  },
};

export function getVideoStrings(language?: string): VideoStrings {
  return STRINGS[(language as QuizLanguage) || "uz"] || STRINGS.uz;
}
