import type { UserProfile } from "../types";

export const PLAN_EXPORT_LIMITS: Record<Exclude<UserProfile["role"], "admin">, number> = {
  free: 1,
  pack10: 10,
  premium: 100,
};

export function getPlanCycle(role: UserProfile["role"]): string {
  if (role === "free") return "free:lifetime";
  if (role === "premium") return `premium:${new Date().toISOString().slice(0, 7)}`;
  if (role === "admin") return "admin:unlimited";
  return "pack10:initial";
}

export function isCurrentPlanCycle(
  role: UserProfile["role"],
  cycle: string | null | undefined,
): boolean {
  if (!cycle) return false;
  return role === "premium"
    ? cycle === getPlanCycle(role)
    : cycle.startsWith(`${role}:`);
}

export function getPlanLimit(profile: UserProfile | null): number | null {
  if (!profile || profile.role === "admin") return null;
  return profile.quotaLimit ?? PLAN_EXPORT_LIMITS[profile.role];
}

export function getPlanUsage(profile: UserProfile | null): number {
  if (!profile) return 0;
  if (Number.isFinite(profile.quotaUsed)) return Math.max(0, profile.quotaUsed);
  // Legacy profillar uchun server bilan bir xil xavfsiz fallback.
  return profile.role === "premium" || profile.role === "admin"
    ? 0
    : Math.max(0, profile.videosCreated || 0);
}

export function hasReachedExportLimit(profile: UserProfile | null): boolean {
  const limit = getPlanLimit(profile);
  return limit !== null && getPlanUsage(profile) >= limit;
}
