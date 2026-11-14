import { num } from "./settings";

// Credit estimate for one edit. All weights come from app_settings (versioned), and the
// defaults there are PLACEHOLDERS, not approved pricing: replace them after measuring real
// per-job cost (spec section 11).
export interface Estimate {
  totalSeconds: number;
  estimated: number; // expected credits
  ceiling: number; // maximum the customer authorises; this is what gets reserved
  scheduleVersion: number;
}

export function estimateCredits(totalSeconds: number, s: Record<string, unknown>): Estimate {
  const perCredit = Math.max(1, num(s.credit_seconds_per_credit, 300));
  const minCredits = Math.max(1, Math.floor(num(s.credit_min_per_job, 1)));
  const multiplier = Math.max(1, num(s.credit_ceiling_multiplier, 1.25));
  const estimated = Math.max(minCredits, Math.ceil(totalSeconds / perCredit));
  const ceiling = Math.max(estimated, Math.ceil(estimated * multiplier));
  return { totalSeconds, estimated, ceiling, scheduleVersion: num(s.credit_schedule_version, 1) };
}
