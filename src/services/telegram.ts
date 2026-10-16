import { auth } from "./firebase";

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

export function getTelegramWebApp(): any {
  if (typeof window !== "undefined" && (window as any).Telegram?.WebApp) {
    return (window as any).Telegram.WebApp;
  }
  return null;
}

export function isTelegramWebApp(): boolean {
  const webApp = getTelegramWebApp();
  if (!webApp) return false;
  return Boolean(webApp.initData || (webApp.platform && webApp.platform !== "unknown"));
}

export function getTelegramUser(): TelegramUser | null {
  const webApp = getTelegramWebApp();
  if (!webApp?.initDataUnsafe?.user) return null;
  return webApp.initDataUnsafe.user as TelegramUser;
}

export function getTelegramInitData(): string {
  const webApp = getTelegramWebApp();
  return webApp?.initData || "";
}

export function initTelegramWebApp(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  try {
    webApp.ready();
    webApp.expand();
    if (webApp.setHeaderColor) webApp.setHeaderColor("#020617");
    if (webApp.setBackgroundColor) webApp.setBackgroundColor("#020617");
    if (webApp.enableClosingConfirmation) webApp.enableClosingConfirmation();
  } catch (e) {
    console.warn("Telegram WebApp init warning:", e);
  }
}

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection";

export function telegramHaptic(type: HapticType = "light"): void {
  const webApp = getTelegramWebApp();
  if (!webApp?.HapticFeedback) return;

  try {
    const hf = webApp.HapticFeedback;
    if (type === "selection") {
      hf.selectionChanged();
    } else if (type === "success" || type === "warning" || type === "error") {
      hf.notificationOccurred(type);
    } else {
      hf.impactOccurred(type);
    }
  } catch (e) {
    // Ignore haptic errors
  }
}

export async function fetchTelegramConfig(): Promise<{ botToken: string; defaultChatId: string } | null> {
  try {
    const idToken = await auth.currentUser?.getIdToken().catch(() => null);
    if (!idToken) return null;

    const res = await fetch("/api/telegram?action=getTelegramConfig", {
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    if (data.ok && data.botToken) {
      return {
        botToken: data.botToken,
        defaultChatId: data.defaultChatId || "",
      };
    }
    return null;
  } catch (e) {
    console.warn("fetchTelegramConfig error:", e);
    return null;
  }
}

export async function sendVideoDirectToTelegram(
  botToken: string,
  chatId: string | number,
  videoBlob: Blob,
  fileName: string = "quiz_video.mp4",
  caption?: string
): Promise<{ success: boolean; messageId?: number; error?: string }> {
  if (!botToken) {
    return { success: false, error: "Telegram bot token topilmadi" };
  }
  if (!chatId) {
    return { success: false, error: "Telegram Chat ID kiritilmagan" };
  }

  const cleanFileName = fileName.endsWith(".mp4") ? fileName : `${fileName}.mp4`;

  // 1-urinish: sendVideo orqali to'g'ridan-to'g'ri Telegram API ga yuborish
  try {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    if (caption) {
      formData.append("caption", caption.slice(0, 1024));
      formData.append("parse_mode", "HTML");
    }
    formData.append("video", videoBlob, cleanFileName);
    formData.append("supports_streaming", "true");

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { success: true, messageId: data.result?.message_id };
    }

    console.warn("sendVideo failed, attempting sendDocument fallback:", data);
  } catch (err: any) {
    console.warn("sendVideo fetch error, attempting sendDocument fallback:", err);
  }

  // 2-urinish (Fallback): sendDocument orqali yuborish (.webm va har qanday video formatini xatosiz qabul qiladi)
  try {
    const docFormData = new FormData();
    docFormData.append("chat_id", String(chatId));
    if (caption) {
      docFormData.append("caption", caption.slice(0, 1024));
      docFormData.append("parse_mode", "HTML");
    }
    docFormData.append("document", videoBlob, cleanFileName);

    const docRes = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      body: docFormData,
    });
    const docData = await docRes.json().catch(() => ({}));
    if (docRes.ok && docData.ok) {
      return { success: true, messageId: docData.result?.message_id };
    }
    return {
      success: false,
      error: docData.description || `Telegram xatosi (${docRes.status})`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Telegram tarmog'iga ulanib bo'lmadi",
    };
  }
}

export async function getLatestTelegramChatId(
  botToken: string
): Promise<{ success: boolean; chatId?: string; user?: any; error?: string }> {
  if (!botToken) {
    return { success: false, error: "Bot token mavjud emas" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getUpdates?limit=25&offset=-25`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return { success: false, error: data?.description || `getUpdates xatosi (${res.status})` };
    }

    const updates: any[] = data.result || [];
    for (let i = updates.length - 1; i >= 0; i--) {
      const u = updates[i];
      const msg = u.message || u.callback_query?.message || u.channel_post;
      if (msg?.chat?.id) {
        const fromUser = u.message?.from || u.callback_query?.from || msg.chat;
        return {
          success: true,
          chatId: String(msg.chat.id),
          user: fromUser,
        };
      }
    }

    return {
      success: false,
      error: "Botga hali hech kim yozmagan yoki /start bosmagan. Iltimos, Telegramda botingizga /start bosing va qayta tekshiring!",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Telegram API bilan bog'lanib bo'lmadi",
    };
  }
}

export async function sendTestTelegramMessage(
  botToken: string,
  chatId: string | number
): Promise<{ success: boolean; error?: string }> {
  if (!botToken) return { success: false, error: "Bot token mavjud emas" };
  if (!chatId) return { success: false, error: "Chat ID kiritilmagan" };

  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: String(chatId),
        text: "✅ <b>Quiz Avto-Zavod boti muvaffaqiyatli ulandi!</b>\n\nVideolar va ijtimoiy tarmoq tavsiflari shu yerga avtomatik keladi 🎬🚀",
        parse_mode: "HTML",
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      return { success: true };
    }
    return { success: false, error: data?.description || `Xatolik: ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err?.message || "Tarmoq xatosi" };
  }
}

export async function sendVideoToTelegramChat(
  videoBlob: Blob,
  fileName: string = "quiz_video.mp4",
  caption?: string,
  targetChatId?: string | number
): Promise<{ success: boolean; error?: string }> {
  const initData = getTelegramInitData();
  const user = getTelegramUser();
  const effectiveChatId = targetChatId || user?.id;

  const formData = new FormData();
  formData.append("video", videoBlob, fileName);
  if (initData) formData.append("initData", initData);
  if (effectiveChatId) {
    formData.append("chatId", String(effectiveChatId));
    formData.append("chat_id", String(effectiveChatId));
  }
  if (caption) formData.append("caption", caption);

  try {
    const response = await fetch("/api/telegram?action=sendVideo", {
      method: "POST",
      body: formData,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: data?.error || `Xatolik: ${response.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Tarmoq xatosi" };
  }
}
