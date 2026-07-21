// @google/genai ning test o'rnini bosuvchisi.
//
// Ishlatilishi (test faylida):
//   vi.mock("@google/genai", () => import("./helpers/genai-stub"));
//
// Klip kechikishi va audio hajmi boshqariladi — shu orqali api/ai.ts dagi vaqt va
// javob-hajmi chegaralarini haqiqiy tarmoqsiz sinash mumkin.

export const Type = {
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
  STRING: "STRING",
  INTEGER: "INTEGER",
} as const;

export const Modality = { AUDIO: "AUDIO" } as const;

let clipLatencyMs = 0;
let clipChars = 1_000;
let textResponse = "[]";
let generateCalls = 0;

export function __configure(options: {
  clipLatencyMs?: number;
  clipChars?: number;
  textResponse?: string;
}) {
  if (options.clipLatencyMs !== undefined) clipLatencyMs = options.clipLatencyMs;
  if (options.clipChars !== undefined) clipChars = options.clipChars;
  if (options.textResponse !== undefined) textResponse = options.textResponse;
}

export function __generateCalls(): number {
  return generateCalls;
}

export function __reset() {
  clipLatencyMs = 0;
  clipChars = 1_000;
  textResponse = "[]";
  generateCalls = 0;
}

const USAGE = { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 };

export class GoogleGenAI {
  models: { generateContent: (params: any) => Promise<any> };

  constructor(_options: unknown) {
    this.models = {
      generateContent: async (params: any) => {
        generateCalls++;
        if (clipLatencyMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, clipLatencyMs));
        }
        if (String(params?.model || "").includes("tts")) {
          return {
            candidates: [
              { content: { parts: [{ inlineData: { data: "A".repeat(clipChars) } }] } },
            ],
            usageMetadata: USAGE,
            text: "",
          };
        }
        return { text: textResponse, usageMetadata: USAGE };
      },
    };
  }
}
