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

export async function sendVideoToTelegramChat(
  videoBlob: Blob,
  fileName: string = "quiz_video.mp4",
  caption?: string
): Promise<{ success: boolean; error?: string }> {
  const initData = getTelegramInitData();
  const user = getTelegramUser();

  const formData = new FormData();
  formData.append("video", videoBlob, fileName);
  if (initData) formData.append("initData", initData);
  if (user?.id) formData.append("chatId", String(user.id));
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
