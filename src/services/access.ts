import { auth } from "./firebase";

export interface VideoCreditResult {
  role: "free" | "premium" | "pack10" | "admin";
  videosCreated: number;
  premiumUntil: string | null;
}

export async function consumeVideoCredit(): Promise<VideoCreditResult> {
  const idToken = await auth.currentUser?.getIdToken().catch(() => null);
  if (!idToken) throw new Error("AUTH_REQUIRED");

  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action: "consumeVideoCredit" }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `API xatosi (${response.status})`);
  return data as VideoCreditResult;
}
