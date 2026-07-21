import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/firebase-admin.js", () => import("./helpers/firebase-admin-stub"));
vi.mock("@google/genai", () => import("./helpers/genai-stub"));

import { __getUserDoc, __reset, __setUserDoc } from "./helpers/firebase-admin-stub";
import { __configure, __generateCalls, __reset as __resetGenAI } from "./helpers/genai-stub";
import handler from "../api/ai";

// vitest.config.ts dagi TTS_BATCH_BUDGET_MS bilan mos bo'lishi kerak.
const BUDGET_MS = 5_000;
// Vercel serverless javob tanasining qattiq chegarasi.
const VERCEL_RESPONSE_LIMIT = 4_500_000;

async function invokeTtsBatch(clipCount: number) {
  const req: any = {
    method: "POST",
    headers: { authorization: "Bearer test-token" },
    body: {
      action: "ttsBatch",
      items: Array.from({ length: clipCount }, (_, i) => ({
        text: `Savol matni ${i}`,
        voiceName: "Kore",
      })),
    },
  };

  let status = 0;
  let payload: any = null;
  const res: any = {
    statusCode: 200,
    setHeader: () => {},
    end: (chunk: string) => {
      status = res.statusCode;
      payload = JSON.parse(chunk);
    },
  };

  await handler(req, res);
  return { status, audios: (payload?.audios ?? []) as (string | null)[], payload };
}

const deliveredCount = (audios: (string | null)[]) => audios.filter(Boolean).length;
const budgetUsed = () => __getUserDoc("u1").aiTtsClipsUsed ?? 0;

beforeEach(() => {
  __reset();
  __resetGenAI();
  // Premium: eksport kvotasi ham, AI byudjeti ham cheklovchi omil bo'lmasin.
  __setUserDoc("u1", {
    role: "premium",
    premiumUntil: new Date(Date.now() + 30 * 864e5).toISOString(),
    videosCreated: 0,
    quotaUsed: 0,
  });
});

describe("ttsBatch — oddiy holat", () => {
  it("hamma klipni yetkazadi va byudjetdan aynan shuncha yechadi", async () => {
    __configure({ clipLatencyMs: 10, clipChars: 1_000 });

    const { status, audios } = await invokeTtsBatch(4);

    expect(status).toBe(200);
    expect(deliveredCount(audios)).toBe(4);
    expect(budgetUsed()).toBe(4);
  });
});

describe("ttsBatch — funksiya vaqti chegarasi", () => {
  it("504 o'rniga qisman natija qaytaradi va ulgurmagan klip byudjetini qaytaradi", async () => {
    // Birinchi to'lqin (3 parallel klip) deadline'dan KEYIN tugaydi, shuning uchun
    // 4-klip umuman boshlanmasligi kerak.
    __configure({ clipLatencyMs: BUDGET_MS + 1_000, clipChars: 1_000 });

    const startedAt = Date.now();
    const { status, audios } = await invokeTtsBatch(4);
    const elapsedMs = Date.now() - startedAt;

    expect(status).toBe(200);
    expect(deliveredCount(audios)).toBe(3);
    expect(audios[3]).toBeNull();

    // Ulgurmagan klip uchun model UMUMAN chaqirilmasligi kerak — shu tufayli
    // funksiya Vercel uni o'ldirishidan oldin qaytadi.
    expect(__generateCalls()).toBe(3);
    expect(elapsedMs).toBeLessThan(60_000);

    // Yetkazilmagan klip byudjetdan yechilmasin.
    expect(budgetUsed()).toBe(3);
  });
});

describe("ttsBatch — javob hajmi chegarasi", () => {
  it("Vercel limitidan oshmaydi va yaratilmagan kliplar byudjetdan yechilmaydi", async () => {
    // Haqiqiy eng uzun klip ~640K belgi; bu yerda ataylab ikki barobar og'irroq
    // shart qo'yamiz, chunki hajm bahosi ham shunga moslashishi kerak.
    __configure({ clipLatencyMs: 10, clipChars: 1_300_000 });

    const { status, audios } = await invokeTtsBatch(4);
    const totalChars = audios.reduce((sum, clip) => sum + (clip?.length ?? 0), 0);

    expect(status).toBe(200);
    expect(totalChars).toBeLessThan(VERCEL_RESPONSE_LIMIT);
    // Chegaraga yetgach qolgan kliplar uchun model chaqirilmaydi.
    expect(__generateCalls()).toBeLessThan(4);
    expect(budgetUsed()).toBe(deliveredCount(audios));
  });

  it("odatiy hajmdagi kliplarni cheklamaydi", async () => {
    // ~640K belgi — eng uzun realistik klip. 4 tasi ham yetkazilishi kerak.
    __configure({ clipLatencyMs: 10, clipChars: 640_000 });

    const { audios } = await invokeTtsBatch(4);

    expect(deliveredCount(audios)).toBe(4);
    expect(audios.reduce((sum, clip) => sum + (clip?.length ?? 0), 0))
      .toBeLessThan(VERCEL_RESPONSE_LIMIT);
  });
});
