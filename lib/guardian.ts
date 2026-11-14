import { LIMITS } from "./config";
import { admin } from "./supabase/admin";
import type { GuardianSeverity } from "./types/schema";

// ZClip Guardian: lightweight, deterministic, event-driven protection. No AI calls here.
// Hard limits that must be atomic (render slots, credits, signup cap) live in the
// database; this file holds the cheap checks and the audit trail.

export async function logEvent(
  type: string,
  severity: GuardianSeverity,
  message: string,
  data?: Record<string, unknown>,
  ownerId?: string,
): Promise<void> {
  try {
    await admin()
      .from("guardian_events")
      .insert({ owner_id: ownerId ?? null, event_type: type, severity, evidence: { message, ...data } });
  } catch {
    /* logging must never break a request */
  }
}

export function checkBatch(input: { count: number; totalBytes: number }): { allowed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (input.count < 1) reasons.push("Add at least one video clip.");
  if (input.count > LIMITS.maxClips) reasons.push(`Too many clips (max ${LIMITS.maxClips}).`);
  if (input.totalBytes > LIMITS.maxBatchBytes)
    reasons.push(`Upload is too large (max ${Math.round(LIMITS.maxBatchBytes / 1024 / 1024)} MB per batch).`);
  return { allowed: reasons.length === 0, reasons };
}

export function checkDurations(durations: number[]): string[] {
  const reasons: string[] = [];
  if (durations.some((d) => d > LIMITS.maxClipSeconds))
    reasons.push(`A clip is longer than ${LIMITS.maxClipSeconds / 60} minutes.`);
  if (durations.reduce((a, b) => a + b, 0) > LIMITS.maxTotalSeconds)
    reasons.push(`Total footage is longer than ${LIMITS.maxTotalSeconds / 60} minutes.`);
  return reasons;
}

// Per-instance request rate limit. With several server instances, move this to the database or Redis.
const hits = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}
