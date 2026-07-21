import { auth } from "./firebase";

export interface PlanUsageResult {
  role: "free" | "premium" | "pack10" | "admin";
  videosCreated: number;
  premiumUntil: string | null;
  quotaCycle: string;
  quotaUsed: number;
  quotaLimit: number | null;
  quotaRemaining: number | null;
}

export interface VideoReservationResult extends PlanUsageResult {
  reservationId: string;
}

export interface ExportMetrics {
  renderDurationMs: number;
  videoDurationSeconds: number;
  outputBytes: number;
  questionCount: number;
  audioClipCount: number;
  imageCount: number;
  format: "youtube" | "vertical";
  extension: "mp4" | "webm";
}

export interface AdminUsageSummary {
  month: string;
  successfulExports: number;
  failedExports: number;
  activeExporters: number;
  averageExportsPerUser: number;
  renderDurationMs: number;
  outputBytes: number;
  aiInputTokens: number;
  aiOutputTokens: number;
  ttsCharacters: number;
  ttsAudioBytes: number;
  imageLookups: number;
  generatedQuestions: number;
  estimatedAiCostUsd: number;
  questionAiCostUsd: number;
  voiceAiCostUsd: number;
  imageAiCostUsd: number;
  estimatedAiCostPerExportUsd: number;
  browserRenderCostUsd: 0;
  serverStorageCostUsd: 0;
  estimatedTotalCostUsd: number;
  estimatedTotalCostPerExportUsd: number;
}

async function callAccessAPI(payload: Record<string, unknown>): Promise<any> {
  // Firebase restores the persisted session asynchronously. Waiting here avoids
  // a false AUTH_REQUIRED response when a protected request runs on first paint.
  await auth.authStateReady();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("AUTH_REQUIRED");
  const idToken = await currentUser.getIdToken();

  const response = await fetch("/api/ai", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || `API xatosi (${response.status})`);
  return data;
}

export async function reserveVideoExport(metadata: {
  format: "youtube" | "vertical";
  questionCount: number;
  targetDuration?: 8 | 10 | 12;
  force?: boolean;
}): Promise<VideoReservationResult> {
  return callAccessAPI({ action: "reserveVideoExport", ...metadata });
}

export async function completeVideoExport(
  reservationId: string,
  metrics: ExportMetrics,
): Promise<PlanUsageResult> {
  return callAccessAPI({ action: "completeVideoExport", reservationId, metrics });
}

export async function failVideoExport(
  reservationId: string,
  failureCode = "EXPORT_FAILED",
): Promise<void> {
  await callAccessAPI({ action: "failVideoExport", reservationId, failureCode });
}

export async function getAdminUsageSummary(month?: string): Promise<AdminUsageSummary> {
  return callAccessAPI({ action: "getAdminUsageSummary", month });
}
