import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isTelegramWebApp,
  getTelegramUser,
  getTelegramInitData,
  telegramHaptic,
  initTelegramWebApp,
} from "../src/services/telegram";

describe("Telegram WebApp Service", () => {
  const originalWindow = global.window;

  afterEach(() => {
    if ((global as any).window) {
      delete (global as any).window.Telegram;
    }
  });

  it("Telegram bo'lmagan muhitda xavfsiz ishlaydi va null qaytaradi", () => {
    expect(isTelegramWebApp()).toBe(false);
    expect(getTelegramUser()).toBe(null);
    expect(getTelegramInitData()).toBe("");
    // Xatoliksiz chaqirilishi kerak
    expect(() => telegramHaptic("light")).not.toThrow();
    expect(() => initTelegramWebApp()).not.toThrow();
  });

  it("Telegram WebApp muhitida foydalanuvchi ma'lumotlarini to'g'ri o'qiydi", () => {
    const mockUser = {
      id: 123456789,
      first_name: "Akram",
      last_name: "Aliyev",
      username: "akram_dev",
      language_code: "uz",
    };

    (global as any).window = {
      ...(global as any).window,
      Telegram: {
        WebApp: {
          initData: "query_id=AAH...",
          initDataUnsafe: {
            user: mockUser,
          },
          platform: "android",
          ready: vi.fn(),
          expand: vi.fn(),
          setHeaderColor: vi.fn(),
          setBackgroundColor: vi.fn(),
          enableClosingConfirmation: vi.fn(),
          HapticFeedback: {
            impactOccurred: vi.fn(),
            notificationOccurred: vi.fn(),
            selectionChanged: vi.fn(),
          },
        },
      },
    };

    expect(isTelegramWebApp()).toBe(true);
    expect(getTelegramUser()).toEqual(mockUser);
    expect(getTelegramInitData()).toBe("query_id=AAH...");

    // Init chaqirilganda WebApp funksiyalari ishlashi kerak
    initTelegramWebApp();
    expect((global as any).window.Telegram.WebApp.ready).toHaveBeenCalled();
    expect((global as any).window.Telegram.WebApp.expand).toHaveBeenCalled();

    // Haptic feedback testlari
    telegramHaptic("medium");
    expect((global as any).window.Telegram.WebApp.HapticFeedback.impactOccurred).toHaveBeenCalledWith("medium");

    telegramHaptic("success");
    expect((global as any).window.Telegram.WebApp.HapticFeedback.notificationOccurred).toHaveBeenCalledWith("success");

    // Referral link shakllanishi
    const user = getTelegramUser();
    const refCode = user ? String(user.id) : "app";
    const refLink = `https://t.me/QuizVideoAIBot?start=ref_${refCode}`;
    expect(refLink).toBe("https://t.me/QuizVideoAIBot?start=ref_123456789");
  });
});
