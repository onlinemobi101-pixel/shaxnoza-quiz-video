import { randomUUID } from "crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "./firebase-admin.js";

export type Role = "free" | "premium" | "pack10" | "admin";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
}

export interface ServerUserProfile {
  role: Role;
  videosCreated: number;
  premiumUntil: string | null;
  quotaCycle: string | null;
  quotaUsed: number;
  quotaLimit: number | null;
  activeExportReservation?: {
    id?: string;
    startedAt?: Timestamp;
  } | null;
}

export interface QuotaState {
  role: Role;
  videosCreated: number;
  premiumUntil: string | null;
  quotaCycle: string;
  quotaUsed: number;
  quotaLimit: number | null;
  quotaRemaining: number | null;
}

export interface ModelUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface ExportMetricsInput {
  renderDurationMs?: number;
  videoDurationSeconds?: number;
  outputBytes?: number;
  questionCount?: number;
  audioClipCount?: number;
  imageCount?: number;
  format?: string;
  extension?: string;
}

export class UsageError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const OWNER_EMAIL = "onlinemobi101@gmail.com";
// Eng uzun video 12 daqiqa; sekin mobil qurilmalar uchun 45 daqiqalik xavfsiz oynani qoldiramiz.
const RESERVATION_TTL_MS = 45 * 60 * 1000;

export const PLAN_LIMITS: Record<Exclude<Role, "admin">, number> = {
  free: 1,
  pack10: 10,
  premium: 100,
};

function finiteNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeInteger(value: unknown, fallback = 0): number {
  return Math.max(0, Math.floor(finiteNumber(value, fallback)));
}

function clampNumber(value: unknown, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value, min)));
}

function monthKey(date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

function envRate(name: string, fallback: number): number {
  return Math.max(0, finiteNumber(process.env[name], fallback));
}

function cyclePrefix(role: Role): string {
  return `${role}:`;
}

function defaultQuotaCycle(profile: ServerUserProfile, role: Role): string {
  if (role === "free") return "free:lifetime";
  if (role === "premium") return `premium:${monthKey()}`;
  if (role === "pack10") return "pack10:initial";
  return "admin:unlimited";
}

function resolveQuota(profile: ServerUserProfile, role: Role): QuotaState {
  const storedCycle = profile.quotaCycle || "";
  const expectedCycle = defaultQuotaCycle(profile, role);
  const storedCycleIsCurrent = role === "premium"
    ? storedCycle === expectedCycle
    : storedCycle.startsWith(cyclePrefix(role));
  const cycle = storedCycleIsCurrent
    ? storedCycle
    : expectedCycle;
  const limit = role === "admin" ? null : PLAN_LIMITS[role];

  let used: number;
  if (storedCycle === cycle) {
    used = nonNegativeInteger(profile.quotaUsed);
  } else if (role === "free" || role === "pack10") {
    // Eski foydalanuvchilar yana bepul kredit olmasligi uchun legacy totaldan boshlaymiz.
    used = Math.min(nonNegativeInteger(profile.videosCreated), limit || 0);
  } else {
    // Premium yangi billing siklida noldan boshlaydi.
    used = 0;
  }

  return {
    role,
    videosCreated: nonNegativeInteger(profile.videosCreated),
    premiumUntil: profile.premiumUntil,
    quotaCycle: cycle,
    quotaUsed: used,
    quotaLimit: limit,
    quotaRemaining: limit === null ? null : Math.max(0, limit - used),
  };
}

export function normalizeProfile(data: FirebaseFirestore.DocumentData | undefined): ServerUserProfile {
  const knownRoles = ["free", "premium", "pack10", "admin"];
  return {
    role: (knownRoles.includes(data?.role) ? data?.role : "free") as Role,
    videosCreated: nonNegativeInteger(data?.videosCreated),
    premiumUntil: typeof data?.premiumUntil === "string" ? data.premiumUntil : null,
    quotaCycle: typeof data?.quotaCycle === "string" ? data.quotaCycle : null,
    quotaUsed: nonNegativeInteger(data?.quotaUsed),
    quotaLimit: data?.quotaLimit === null ? null : nonNegativeInteger(data?.quotaLimit),
    activeExportReservation: data?.activeExportReservation || null,
  };
}

export function effectiveRole(profile: ServerUserProfile, email?: string): Role {
  if (email === OWNER_EMAIL || profile.role === "admin") return "admin";
  if (profile.role !== "premium") return profile.role;
  const expiresAt = profile.premiumUntil ? Date.parse(profile.premiumUntil) : Number.NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now() ? "premium" : "free";
}

export async function getUserProfile(uid: string): Promise<ServerUserProfile> {
  const snapshot = await adminDb.collection("users").doc(uid).get();
  if (!snapshot.exists) throw new UsageError(409, "PROFILE_REQUIRED");
  return normalizeProfile(snapshot.data());
}

export async function requirePlanAccess(
  user: AuthenticatedUser,
  errorCode = "PLAN_LIMIT",
): Promise<ServerUserProfile & { effectiveRole: Role; quota: QuotaState }> {
  const profile = await getUserProfile(user.uid);
  const role = effectiveRole(profile, user.email);
  const quota = resolveQuota(profile, role);
  if (quota.quotaLimit !== null && quota.quotaUsed >= quota.quotaLimit) {
    throw new UsageError(403, errorCode);
  }
  return { ...profile, effectiveRole: role, quota };
}

function reservationStartedAtMillis(active: ServerUserProfile["activeExportReservation"]): number {
  const value = active?.startedAt;
  return value instanceof Timestamp ? value.toMillis() : 0;
}

export async function reserveVideoExport(
  user: AuthenticatedUser,
  metadata: { format?: string; questionCount?: number; targetDuration?: number },
): Promise<QuotaState & { reservationId: string }> {
  const userRef = adminDb.collection("users").doc(user.uid);
  const reservationId = randomUUID();
  const reservationRef = adminDb.collection("exportReservations").doc(reservationId);

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) throw new UsageError(409, "PROFILE_REQUIRED");

    const profile = normalizeProfile(snapshot.data());
    const role = effectiveRole(profile, user.email);
    const quota = resolveQuota(profile, role);
    if (quota.quotaLimit !== null && quota.quotaUsed >= quota.quotaLimit) {
      throw new UsageError(403, "VIDEO_LIMIT");
    }

    const active = profile.activeExportReservation;
    const activeStartedAt = reservationStartedAtMillis(active);
    const activeIsFresh = Boolean(
      active?.id &&
      activeStartedAt &&
      Date.now() - activeStartedAt < RESERVATION_TTL_MS,
    );
    if (activeIsFresh) throw new UsageError(409, "EXPORT_IN_PROGRESS");

    if (active?.id) {
      const expiredRef = adminDb.collection("exportReservations").doc(active.id);
      transaction.set(expiredRef, {
        status: "expired",
        failedAt: FieldValue.serverTimestamp(),
        failureCode: "RESERVATION_EXPIRED",
      }, { merge: true });
    }

    const startedAt = Timestamp.now();
    transaction.set(reservationRef, {
      uid: user.uid,
      role,
      quotaCycle: quota.quotaCycle,
      quotaLimit: quota.quotaLimit,
      quotaUsedAtReserve: quota.quotaUsed,
      status: "reserved",
      startedAt,
      format: metadata.format === "youtube" ? "youtube" : "vertical",
      questionCount: Math.min(100, nonNegativeInteger(metadata.questionCount)),
      targetDuration: [8, 10, 12].includes(Number(metadata.targetDuration))
        ? Number(metadata.targetDuration)
        : null,
    });
    transaction.update(userRef, {
      quotaCycle: quota.quotaCycle,
      quotaUsed: quota.quotaUsed,
      quotaLimit: quota.quotaLimit,
      activeExportReservation: { id: reservationId, startedAt },
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { ...quota, reservationId };
  });
}

function normalizeExportMetrics(input: ExportMetricsInput): Required<ExportMetricsInput> {
  const format = input.format === "youtube" ? "youtube" : "vertical";
  const extension = input.extension === "mp4" ? "mp4" : "webm";
  return {
    renderDurationMs: clampNumber(input.renderDurationMs, 0, 6 * 60 * 60 * 1000),
    videoDurationSeconds: clampNumber(input.videoDurationSeconds, 0, 2 * 60 * 60),
    outputBytes: clampNumber(input.outputBytes, 0, 10 * 1024 * 1024 * 1024),
    questionCount: Math.floor(clampNumber(input.questionCount, 0, 100)),
    audioClipCount: Math.floor(clampNumber(input.audioClipCount, 0, 200)),
    imageCount: Math.floor(clampNumber(input.imageCount, 0, 100)),
    format,
    extension,
  };
}

export async function completeVideoExport(
  user: AuthenticatedUser,
  reservationId: string,
  rawMetrics: ExportMetricsInput,
): Promise<QuotaState> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) throw new UsageError(400, "INVALID_RESERVATION");
  const metrics = normalizeExportMetrics(rawMetrics);
  const userRef = adminDb.collection("users").doc(user.uid);
  const reservationRef = adminDb.collection("exportReservations").doc(reservationId);
  const month = monthKey();
  const monthRef = adminDb.collection("usageMonths").doc(month);
  const userMonthRef = monthRef.collection("users").doc(user.uid);

  return adminDb.runTransaction(async (transaction) => {
    const [userSnapshot, reservationSnapshot, userMonthSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(reservationRef),
      transaction.get(userMonthRef),
    ]);
    if (!userSnapshot.exists) throw new UsageError(409, "PROFILE_REQUIRED");
    if (!reservationSnapshot.exists) throw new UsageError(404, "RESERVATION_NOT_FOUND");

    const reservation = reservationSnapshot.data() || {};
    if (reservation.uid !== user.uid) throw new UsageError(403, "RESERVATION_FORBIDDEN");

    const profile = normalizeProfile(userSnapshot.data());
    const role = effectiveRole(profile, user.email);

    if (reservation.status === "completed") {
      return resolveQuota(profile, role);
    }
    if (reservation.status !== "reserved") throw new UsageError(409, "RESERVATION_CLOSED");
    if (profile.activeExportReservation?.id !== reservationId) {
      throw new UsageError(409, "RESERVATION_NOT_ACTIVE");
    }

    // Re-resolve at completion so a calendar-month boundary or an admin plan
    // change during rendering cannot write usage back into an obsolete cycle.
    const currentQuota = resolveQuota(profile, role);
    const quotaLimit = currentQuota.quotaLimit;
    const quotaUsed = currentQuota.quotaUsed + 1;
    if (quotaLimit !== null && quotaUsed > quotaLimit) {
      throw new UsageError(403, "VIDEO_LIMIT");
    }

    const quotaCycle = currentQuota.quotaCycle;
    const videosCreated = nonNegativeInteger(profile.videosCreated) + 1;
    transaction.update(userRef, {
      videosCreated,
      quotaCycle,
      quotaUsed,
      quotaLimit,
      activeExportReservation: FieldValue.delete(),
      lastExportCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(reservationRef, {
      status: "completed",
      completedAt: FieldValue.serverTimestamp(),
      metrics: {
        ...metrics,
        renderMode: "browser",
        serverRenderCostUsd: 0,
        serverStorageBytes: 0,
        serverStorageCostUsd: 0,
      },
    });

    const firstMonthlyExport = !userMonthSnapshot.exists ||
      nonNegativeInteger(userMonthSnapshot.data()?.successfulExports) === 0;
    transaction.set(userMonthRef, {
      uid: user.uid,
      role,
      successfulExports: FieldValue.increment(1),
      renderDurationMs: FieldValue.increment(metrics.renderDurationMs),
      outputBytes: FieldValue.increment(metrics.outputBytes),
      videoDurationSeconds: FieldValue.increment(metrics.videoDurationSeconds),
      questionCount: FieldValue.increment(metrics.questionCount),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(monthRef, {
      successfulExports: FieldValue.increment(1),
      activeExporters: FieldValue.increment(firstMonthlyExport ? 1 : 0),
      renderDurationMs: FieldValue.increment(metrics.renderDurationMs),
      outputBytes: FieldValue.increment(metrics.outputBytes),
      videoDurationSeconds: FieldValue.increment(metrics.videoDurationSeconds),
      questionCount: FieldValue.increment(metrics.questionCount),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      role,
      videosCreated,
      premiumUntil: profile.premiumUntil,
      quotaCycle,
      quotaUsed,
      quotaLimit,
      quotaRemaining: quotaLimit === null ? null : Math.max(0, quotaLimit - quotaUsed),
    };
  });
}

export async function failVideoExport(
  user: AuthenticatedUser,
  reservationId: string,
  failureCode = "EXPORT_FAILED",
): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(reservationId)) return;
  const userRef = adminDb.collection("users").doc(user.uid);
  const reservationRef = adminDb.collection("exportReservations").doc(reservationId);
  const month = monthKey();
  const monthRef = adminDb.collection("usageMonths").doc(month);
  const userMonthRef = monthRef.collection("users").doc(user.uid);

  await adminDb.runTransaction(async (transaction) => {
    const [userSnapshot, reservationSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(reservationRef),
    ]);
    if (!reservationSnapshot.exists) return;
    const reservation = reservationSnapshot.data() || {};
    if (reservation.uid !== user.uid || reservation.status !== "reserved") return;

    transaction.update(reservationRef, {
      status: "failed",
      failedAt: FieldValue.serverTimestamp(),
      failureCode: String(failureCode).slice(0, 100),
    });
    if (userSnapshot.exists) {
      const profile = normalizeProfile(userSnapshot.data());
      if (profile.activeExportReservation?.id === reservationId) {
        transaction.update(userRef, {
          activeExportReservation: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    transaction.set(userMonthRef, {
      uid: user.uid,
      failedExports: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(monthRef, {
      failedExports: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

function estimatedModelCostUsd(
  kind: "text" | "tts" | "image",
  usage: ModelUsageMetadata,
): number {
  if (kind === "image") return 0;
  // 2026-07-20 PayGo narxlari; environment qiymatlari bu fallbacklarni almashtiradi.
  const inputRate = kind === "tts"
    ? envRate("VERTEX_TTS_INPUT_USD_PER_1M_TOKENS", 1)
    : envRate("VERTEX_TEXT_INPUT_USD_PER_1M_TOKENS", 0.25);
  const outputRate = kind === "tts"
    ? envRate("VERTEX_TTS_OUTPUT_USD_PER_1M_TOKENS", 20)
    : envRate("VERTEX_TEXT_OUTPUT_USD_PER_1M_TOKENS", 1.5);
  return (
    nonNegativeInteger(usage.promptTokenCount) * inputRate +
    (
      nonNegativeInteger(usage.candidatesTokenCount) +
      nonNegativeInteger(usage.thoughtsTokenCount)
    ) * outputRate
  ) / 1_000_000;
}

export async function recordModelUsage(
  user: AuthenticatedUser,
  details: {
    action: string;
    model: string;
    kind: "text" | "tts" | "image";
    usage?: ModelUsageMetadata;
    textCharacters?: number;
    audioBytes?: number;
    imageLookups?: number;
    questionCount?: number;
    durationMs?: number;
  },
): Promise<void> {
  try {
    const usage = details.usage || {};
    const estimatedCostUsd = estimatedModelCostUsd(details.kind, usage);
    const costCategory = details.kind === "tts"
      ? "voice"
      : details.kind === "image" || details.action === "imageKeyword"
        ? "image"
        : "question";
    const month = monthKey();
    const monthRef = adminDb.collection("usageMonths").doc(month);
    const userMonthRef = monthRef.collection("users").doc(user.uid);
    const eventRef = adminDb.collection("costEvents").doc();
    const increments = {
      modelCalls: FieldValue.increment(details.kind === "image" ? 0 : 1),
      aiInputTokens: FieldValue.increment(nonNegativeInteger(usage.promptTokenCount)),
      aiOutputTokens: FieldValue.increment(nonNegativeInteger(usage.candidatesTokenCount)),
      aiThoughtTokens: FieldValue.increment(nonNegativeInteger(usage.thoughtsTokenCount)),
      ttsCharacters: FieldValue.increment(nonNegativeInteger(details.textCharacters)),
      ttsAudioBytes: FieldValue.increment(nonNegativeInteger(details.audioBytes)),
      imageLookups: FieldValue.increment(nonNegativeInteger(details.imageLookups)),
      generatedQuestions: FieldValue.increment(nonNegativeInteger(details.questionCount)),
      modelDurationMs: FieldValue.increment(nonNegativeInteger(details.durationMs)),
      estimatedAiCostUsd: FieldValue.increment(estimatedCostUsd),
      questionAiCostUsd: FieldValue.increment(costCategory === "question" ? estimatedCostUsd : 0),
      voiceAiCostUsd: FieldValue.increment(costCategory === "voice" ? estimatedCostUsd : 0),
      imageAiCostUsd: FieldValue.increment(costCategory === "image" ? estimatedCostUsd : 0),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const batch = adminDb.batch();
    batch.set(eventRef, {
      uid: user.uid,
      month,
      action: details.action,
      model: details.model,
      kind: details.kind,
      costCategory,
      promptTokenCount: nonNegativeInteger(usage.promptTokenCount),
      candidatesTokenCount: nonNegativeInteger(usage.candidatesTokenCount),
      thoughtsTokenCount: nonNegativeInteger(usage.thoughtsTokenCount),
      totalTokenCount: nonNegativeInteger(usage.totalTokenCount),
      textCharacters: nonNegativeInteger(details.textCharacters),
      audioBytes: nonNegativeInteger(details.audioBytes),
      imageLookups: nonNegativeInteger(details.imageLookups),
      questionCount: nonNegativeInteger(details.questionCount),
      durationMs: nonNegativeInteger(details.durationMs),
      estimatedCostUsd,
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(userMonthRef, { uid: user.uid, ...increments }, { merge: true });
    batch.set(monthRef, increments, { merge: true });
    await batch.commit();
  } catch (error) {
    // Analitika xatosi foydalanuvchining generatsiyasini buzmasligi kerak.
    console.error("Usage analytics write failed:", error);
  }
}

export async function getAdminUsageSummary(
  user: AuthenticatedUser,
  requestedMonth?: string,
): Promise<Record<string, unknown>> {
  const profile = await getUserProfile(user.uid);
  if (effectiveRole(profile, user.email) !== "admin") {
    throw new UsageError(403, "ADMIN_REQUIRED");
  }
  const month = /^\d{4}-\d{2}$/.test(requestedMonth || "") ? requestedMonth! : monthKey();
  const snapshot = await adminDb.collection("usageMonths").doc(month).get();
  const data = snapshot.data() || {};
  const successfulExports = nonNegativeInteger(data.successfulExports);
  const activeExporters = nonNegativeInteger(data.activeExporters);
  const estimatedAiCostUsd = finiteNumber(data.estimatedAiCostUsd, 0);
  const questionAiCostUsd = finiteNumber(data.questionAiCostUsd, 0);
  const voiceAiCostUsd = finiteNumber(data.voiceAiCostUsd, 0);
  const imageAiCostUsd = finiteNumber(data.imageAiCostUsd, 0);
  const browserRenderCostUsd = 0;
  const serverStorageCostUsd = 0;
  const estimatedTotalCostUsd = estimatedAiCostUsd + browserRenderCostUsd + serverStorageCostUsd;
  return {
    month,
    successfulExports,
    failedExports: nonNegativeInteger(data.failedExports),
    activeExporters,
    averageExportsPerUser: activeExporters > 0 ? successfulExports / activeExporters : 0,
    renderDurationMs: nonNegativeInteger(data.renderDurationMs),
    outputBytes: nonNegativeInteger(data.outputBytes),
    aiInputTokens: nonNegativeInteger(data.aiInputTokens),
    aiOutputTokens: nonNegativeInteger(data.aiOutputTokens),
    ttsCharacters: nonNegativeInteger(data.ttsCharacters),
    ttsAudioBytes: nonNegativeInteger(data.ttsAudioBytes),
    imageLookups: nonNegativeInteger(data.imageLookups),
    generatedQuestions: nonNegativeInteger(data.generatedQuestions),
    estimatedAiCostUsd,
    questionAiCostUsd,
    voiceAiCostUsd,
    imageAiCostUsd,
    estimatedAiCostPerExportUsd: successfulExports > 0 ? estimatedAiCostUsd / successfulExports : 0,
    browserRenderCostUsd,
    serverStorageCostUsd,
    estimatedTotalCostUsd,
    estimatedTotalCostPerExportUsd: successfulExports > 0
      ? estimatedTotalCostUsd / successfulExports
      : 0,
  };
}
