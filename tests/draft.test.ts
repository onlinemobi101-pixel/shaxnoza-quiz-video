import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Quiz } from "../src/types";
import { AUTOSAVE_KEY, loadQuizDraft, saveQuizDraft } from "../src/services/draft";

// Kvotasi boshqariladigan localStorage — brauzerdagi QuotaExceededError'ni takrorlaydi.
class FakeStorage {
  private data = new Map<string, string>();
  quotaBytes = Number.POSITIVE_INFINITY;
  disabled = false;

  getItem(key: string): string | null {
    if (this.disabled) throw new Error("SecurityError");
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.disabled) throw new Error("SecurityError");
    let used = 0;
    for (const [otherKey, otherValue] of this.data) {
      if (otherKey !== key) used += otherValue.length;
    }
    if (used + value.length > this.quotaBytes) {
      const error = new Error("The quota has been exceeded.");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    if (this.disabled) throw new Error("SecurityError");
    this.data.delete(key);
  }
}

let storage: FakeStorage;

const FALLBACK: Quiz = { title: "Standart", questions: [{
  id: "f1", text: "Fallback?", options: ["a", "b", "c"], correctOptionIndex: 0, backgroundImage: "",
}] };

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    title: "Mening testim",
    questions: [
      {
        id: "q1",
        text: "Poytaxt qaysi shahar?",
        options: ["Toshkent", "Samarqand", "Buxoro"],
        correctOptionIndex: 0,
        backgroundImage: "https://images.unsplash.com/photo-123",
        audioBase64: "AAAA".repeat(500),
        correctAudioBase64: "BBBB".repeat(500),
      },
      {
        id: "q2",
        text: "Yer nechta oyga ega?",
        options: ["1", "2", "3"],
        correctOptionIndex: 0,
        // Yuklangan rasm — hajmning katta qismini aynan shu egallaydi.
        backgroundImage: `data:image/jpeg;base64,${"Z".repeat(4000)}`,
      },
    ],
    ...overrides,
  };
}

const storedDraft = (): any => JSON.parse(storage.getItem(AUTOSAVE_KEY)!);

beforeEach(() => {
  storage = new FakeStorage();
  vi.stubGlobal("localStorage", storage);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveQuizDraft — normal holat", () => {
  it("saqlaydi va qayta o'qiganda bir xil savollarni qaytaradi", () => {
    const quiz = makeQuiz();
    expect(saveQuizDraft(quiz)).toBe("ok");

    const restored = loadQuizDraft(FALLBACK);
    expect(restored.title).toBe("Mening testim");
    expect(restored.questions.map((q) => q.text)).toStrictEqual(quiz.questions.map((q) => q.text));
  });

  it("audioni saqlamaydi — u tugma bilan qayta yaratiladi va juda katta", () => {
    saveQuizDraft(makeQuiz());
    const draft = storedDraft();
    expect(draft.questions[0].audioBase64).toBeUndefined();
    expect(draft.questions[0].correctAudioBase64).toBeUndefined();
  });

  it("yuklangan rasmni joy yetganda saqlab qoladi", () => {
    saveQuizDraft(makeQuiz());
    expect(storedDraft().questions[1].backgroundImage).toMatch(/^data:image\/jpeg/);
  });
});

describe("saveQuizDraft — joy yetmaganda bosqichma-bosqich pasayadi", () => {
  it("rasmlarni tashlab bo'lsa ham savollarni saqlaydi", () => {
    // To'liq variant sig'maydi, rasmsizi sig'adi.
    storage.quotaBytes = 2_000;

    expect(saveQuizDraft(makeQuiz())).toBe("degraded");

    const draft = storedDraft();
    // Eng qimmatlisi — matn — saqlanib qoldi.
    expect(draft.questions.map((q: any) => q.text)).toStrictEqual([
      "Poytaxt qaysi shahar?",
      "Yer nechta oyga ega?",
    ]);
    // Yuklangan rasm tashlandi...
    expect(draft.questions[1].backgroundImage).toBe("");
    // ...lekin oddiy URL (joy egallamaydi) saqlanib qoldi.
    expect(draft.questions[0].backgroundImage).toBe("https://images.unsplash.com/photo-123");
  });

  it("umuman sig'masa 'failed' qaytaradi va eskirgan qoralamani qoldirmaydi", () => {
    storage.quotaBytes = 10_000;
    expect(saveQuizDraft(makeQuiz())).toBe("ok");

    // Endi hech narsa sig'maydi.
    storage.quotaBytes = 10;
    expect(saveQuizDraft(makeQuiz({ title: "Yangilangan" }))).toBe("failed");

    // Eski qoralama qolsa, keyingi ochilishda u joriy ish deb tiklanardi.
    expect(storage.getItem(AUTOSAVE_KEY)).toBeNull();
  });

  it("localStorage butunlay o'chirilgan bo'lsa yiqilmaydi", () => {
    storage.disabled = true;
    expect(saveQuizDraft(makeQuiz())).toBe("failed");
  });
});

describe("loadQuizDraft", () => {
  it("qoralama yo'q bo'lsa standart quizni qaytaradi", () => {
    expect(loadQuizDraft(FALLBACK)).toBe(FALLBACK);
  });

  it("buzilgan JSON'da yiqilmaydi", () => {
    storage.setItem(AUTOSAVE_KEY, "{buzilgan json");
    expect(loadQuizDraft(FALLBACK)).toBe(FALLBACK);
  });

  it("bo'sh savollar ro'yxatini tiklamaydi", () => {
    storage.setItem(AUTOSAVE_KEY, JSON.stringify({ title: "Bo'sh", questions: [] }));
    expect(loadQuizDraft(FALLBACK)).toBe(FALLBACK);
  });

  it("eski namuna testlarni tiklamaydi", () => {
    storage.setItem(AUTOSAVE_KEY, JSON.stringify({
      title: "20 General Knowledge Questions | Can You Score 20/20?",
      questions: [{ id: "a", text: "x", options: [], correctOptionIndex: 0, backgroundImage: "" }],
    }));
    expect(loadQuizDraft(FALLBACK)).toBe(FALLBACK);
  });

  it("localStorage o'chirilgan bo'lsa standart quizga qaytadi", () => {
    storage.disabled = true;
    expect(loadQuizDraft(FALLBACK)).toBe(FALLBACK);
  });
});
