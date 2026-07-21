import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf-8");

const renderYaml = read("render.yaml");
const envExample = read(".env.example");
const serverSources = ["api/ai.ts", "api/firebase-admin.ts", "api/usage.ts", "server.ts"]
  .map(read)
  .join("\n");

// Bu qiymatlarsiz server ishlay olmaydi — AI chaqiruvlari ham, kvota tranzaksiyalari ham
// yiqiladi. Har bir deploy konfiguratsiyasi ularni so'rashi shart.
const REQUIRED_SERVER_ENV = ["GCP_SERVICE_ACCOUNT_JSON", "FIREBASE_SERVICE_ACCOUNT_JSON"];

// Kod o'qiydigan BARCHA env o'zgaruvchilar (majburiy + standart qiymatli ixtiyoriylar).
// Yangi env qo'shsangiz shu yerga ham qo'shing — aks holda quyidagi test uni "noma'lum"
// deb belgilaydi.
const KNOWN_ENV = [
  ...REQUIRED_SERVER_ENV,
  "TTS_BATCH_BUDGET_MS",
  "VERTEX_PROJECT",
  "FIREBASE_PROJECT_ID",
  "FIRESTORE_DATABASE_ID",
  "VERTEX_TEXT_INPUT_USD_PER_1M_TOKENS",
  "VERTEX_TEXT_OUTPUT_USD_PER_1M_TOKENS",
  "VERTEX_TTS_INPUT_USD_PER_1M_TOKENS",
  "VERTEX_TTS_OUTPUT_USD_PER_1M_TOKENS",
  "PORT",
  "HOST",
  "DISABLE_HMR",
  "APP_URL",
];

// Render platformasining o'z o'zgaruvchisi — kod uni o'qimaydi.
const PLATFORM_ENV = ["NODE_VERSION"];

const renderEnvKeys = [...renderYaml.matchAll(/^\s*-\s*key:\s*(\S+)/gm)].map((match) => match[1]);

describe("render.yaml", () => {
  it("serverga kerak bo'lgan barcha maxfiy qiymatlarni so'raydi", () => {
    for (const key of REQUIRED_SERVER_ENV) {
      expect(
        renderEnvKeys,
        `${key} kodga kerak, lekin render.yaml uni so'ramaydi — Render'ga deploy qilinganda ` +
          "ilova ishga tushadi-yu, AI chaqiruvlari yiqiladi.",
      ).toContain(key);
    }
  });

  // Aynan shu holat bir marta yuz bergan: render.yaml GEMINI_API_KEY ni so'rardi
  // (u allaqachon ishlatilmasdi) va GCP_SERVICE_ACCOUNT_JSON ni so'ramasdi.
  it("kod o'qimaydigan env o'zgaruvchisini so'ramaydi", () => {
    for (const key of renderEnvKeys) {
      expect(
        [...KNOWN_ENV, ...PLATFORM_ENV],
        `render.yaml ${key} ni so'raydi, lekin kod uni hech qayerda o'qimaydi. ` +
          "Eskirgan bo'lsa o'chiring, yangi bo'lsa KNOWN_ENV ro'yxatiga qo'shing.",
      ).toContain(key);
    }
  });

  it("bir xil kalitni ikki marta e'lon qilmaydi", () => {
    expect(renderEnvKeys).toStrictEqual([...new Set(renderEnvKeys)]);
  });
});

describe(".env.example", () => {
  it("majburiy qiymatlarni hujjatlashtiradi", () => {
    for (const key of REQUIRED_SERVER_ENV) {
      expect(envExample, `${key} .env.example da tushuntirilmagan.`).toContain(key);
    }
  });
});

describe("REQUIRED_SERVER_ENV ro'yxati", () => {
  // Ro'yxat ikki tomonlama rost bo'lishi kerak: kod o'qimaydigan qiymatni majburiy
  // deb belgilash keyingi deploy konfiguratsiyasini keraksiz talab bilan to'ldiradi.
  it("faqat kod haqiqatan o'qiydigan qiymatlardan iborat", () => {
    for (const key of REQUIRED_SERVER_ENV) {
      expect(
        serverSources.includes(key),
        `${key} majburiy deb belgilangan, lekin server kodida o'qilmaydi.`,
      ).toBe(true);
    }
  });
});
