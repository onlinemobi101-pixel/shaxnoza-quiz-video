import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api/firebase-admin.js", () => import("./helpers/firebase-admin-stub"));

import { __getUserDoc, __reset, __setUserDoc } from "./helpers/firebase-admin-stub";
import { AI_BUDGETS, consumeAiBudget, refundAiBudget } from "../api/usage";

const FREE_USER = { uid: "u-free", email: "someone@gmail.com" };
const ADMIN_USER = { uid: "u-admin", email: "optombazar9@gmail.com" };
const PREMIUM_USER = { uid: "u-prem", email: "prem@gmail.com" };

const inDays = (days: number) => new Date(Date.now() + days * 864e5).toISOString();
const currentMonth = () => new Date().toISOString().slice(0, 7);

beforeEach(() => {
  __reset();
});

describe("AI byudjeti — eksport kvotasidan alohida cheklov", () => {
  it("bepul tarifda TTS chegarasiga yetganda rad etadi", async () => {
    __setUserDoc("u-free", { role: "free", videosCreated: 0, quotaUsed: 0 });
    const limit = AI_BUDGETS.free.ttsClips;

    await consumeAiBudget(FREE_USER, "ttsClips", limit, "AI_VOICE_LIMIT");
    expect(__getUserDoc("u-free").aiTtsClipsUsed).toBe(limit);
    expect(__getUserDoc("u-free").aiCycle).toBe("free:lifetime");

    await expect(
      consumeAiBudget(FREE_USER, "ttsClips", 1, "AI_VOICE_LIMIT"),
    ).rejects.toThrow("AI_VOICE_LIMIT");

    // Rad etilgan urinish hisoblagichni surmasligi kerak.
    expect(__getUserDoc("u-free").aiTtsClipsUsed).toBe(limit);
  });

  it("resurslarni bir-biridan mustaqil hisoblaydi", async () => {
    __setUserDoc("u-free", { role: "free", videosCreated: 0, quotaUsed: 0 });
    await consumeAiBudget(FREE_USER, "ttsClips", AI_BUDGETS.free.ttsClips, "AI_VOICE_LIMIT");

    // Ovoz tugagan bo'lsa ham savol yaratish alohida byudjetdan ishlaydi.
    await consumeAiBudget(FREE_USER, "quizzes", 1, "AI_QUIZ_LIMIT");
    expect(__getUserDoc("u-free").aiQuizzesUsed).toBe(1);
  });

  it("bir vaqtda ko'p klip so'ralganda chegaradan oshirmaydi", async () => {
    __setUserDoc("u-free", { role: "free", videosCreated: 0, quotaUsed: 0 });
    await expect(
      consumeAiBudget(FREE_USER, "ttsClips", AI_BUDGETS.free.ttsClips + 1, "AI_VOICE_LIMIT"),
    ).rejects.toThrow("AI_VOICE_LIMIT");
    expect(__getUserDoc("u-free").aiTtsClipsUsed).toBeUndefined();
  });

  it("adminni byudjetdan ozod qiladi va hisoblagich yozmaydi", async () => {
    __setUserDoc("u-admin", { role: "admin", videosCreated: 0 });
    await consumeAiBudget(ADMIN_USER, "ttsClips", 100_000, "AI_VOICE_LIMIT");
    expect(__getUserDoc("u-admin").aiTtsClipsUsed).toBeUndefined();
  });
});

describe("AI byudjeti — refund", () => {
  beforeEach(() => {
    __setUserDoc("u-free", { role: "free", videosCreated: 0, quotaUsed: 0 });
  });

  it("qaytarilgan byudjetni qayta ishlatish mumkin", async () => {
    const limit = AI_BUDGETS.free.ttsClips;
    await consumeAiBudget(FREE_USER, "ttsClips", limit, "AI_VOICE_LIMIT");

    await refundAiBudget(FREE_USER, "ttsClips", 4);
    expect(__getUserDoc("u-free").aiTtsClipsUsed).toBe(limit - 4);

    await consumeAiBudget(FREE_USER, "ttsClips", 4, "AI_VOICE_LIMIT");
    expect(__getUserDoc("u-free").aiTtsClipsUsed).toBe(limit);
  });

  it("haddan ortiq refund hisoblagichni manfiyga tushirmaydi", async () => {
    await consumeAiBudget(FREE_USER, "ttsClips", 5, "AI_VOICE_LIMIT");
    await refundAiBudget(FREE_USER, "ttsClips", 9_999);
    expect(__getUserDoc("u-free").aiTtsClipsUsed).toBe(0);
  });
});

describe("AI byudjeti — tarif sikllari", () => {
  it("premium oyi almashganda BARCHA hisoblagichni nolga tushiradi", async () => {
    __setUserDoc("u-prem", {
      role: "premium",
      premiumUntil: inDays(30),
      videosCreated: 0,
      aiCycle: "premium:2020-01", // eski oy
      aiTtsClipsUsed: 2_000,
      aiQuizzesUsed: 150,
      aiImageCallsUsed: 900,
    });

    await consumeAiBudget(PREMIUM_USER, "ttsClips", 5, "AI_VOICE_LIMIT");

    const doc = __getUserDoc("u-prem");
    expect(doc.aiCycle).toBe(`premium:${currentMonth()}`);
    expect(doc.aiTtsClipsUsed).toBe(5);
    // Sarflanayotgan resurs emas, qolganlari ham yangi siklda noldan boshlanadi.
    expect(doc.aiQuizzesUsed).toBe(0);
    expect(doc.aiImageCallsUsed).toBe(0);
  });

  it("muddati tugagan premium 'free' byudjetiga tushadi", async () => {
    __setUserDoc("u-exp", {
      role: "premium",
      premiumUntil: inDays(-1), // kecha tugagan
      videosCreated: 0,
    });

    await expect(
      consumeAiBudget(
        { uid: "u-exp", email: "exp@gmail.com" },
        "ttsClips",
        AI_BUDGETS.free.ttsClips + 1,
        "AI_VOICE_LIMIT",
      ),
    ).rejects.toThrow("AI_VOICE_LIMIT");
  });

  it("bepul tarifda sikl umrbod — hisoblagich hech qachon o'z-o'zidan tiklanmaydi", async () => {
    __setUserDoc("u-free", {
      role: "free",
      videosCreated: 0,
      aiCycle: "free:lifetime",
      aiTtsClipsUsed: AI_BUDGETS.free.ttsClips,
    });

    await expect(
      consumeAiBudget(FREE_USER, "ttsClips", 1, "AI_VOICE_LIMIT"),
    ).rejects.toThrow("AI_VOICE_LIMIT");
  });
});
