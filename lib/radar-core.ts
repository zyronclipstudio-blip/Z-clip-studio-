import { CAPABILITIES } from "./capabilities";
import type { EffectId } from "./types/schema";
import type { Look, Style } from "./styles";

// Pure parts of the trend radar: checking what the AI wrote, and scoring it. No network, fully testable.
export interface RawRecipe {
  name?: unknown; tagline?: unknown; pacing?: unknown; effects?: unknown; maxShare?: unknown;
  captions?: unknown; look?: unknown; directorNote?: unknown; quality?: unknown;
}

const EFFECTS = CAPABILITIES.map((c) => c.id) as EffectId[];
const LOOKS: Look[] = ["none", "soft", "punchy", "cinematic"];

// Text that came from the open internet or an AI never goes into a prompt unchecked.
export function safeText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+/g, " ").trim();
  if (t.length < 3 || t.length > max) return null;
  if (/https?:|www\.|@\w|ignore (all|previous|the)|system prompt|api key|password|<\/?\w+>/i.test(t)) return null;
  return t;
}

export function toStyle(raw: RawRecipe, id: string): (Style & { quality: number }) | null {
  const name = safeText(raw.name, 28);
  const tagline = safeText(raw.tagline, 60) ?? "";
  const note = safeText(raw.directorNote, 420);
  if (!name || !note) return null;
  const pacing = raw.pacing === "fast" || raw.pacing === "medium" || raw.pacing === "slow" ? raw.pacing : null;
  if (!pacing) return null;
  const allowed = Array.isArray(raw.effects) ? [...new Set(raw.effects.filter((e): e is EffectId => EFFECTS.includes(e as EffectId)))] : [];
  const maxShareRaw = typeof raw.maxShare === "number" ? raw.maxShare : 0.2;
  const maxShare = Math.min(0.5, Math.max(0, maxShareRaw)); // a learned style can never be busier than half the cuts
  const captions = raw.captions === "pop" || raw.captions === "clean" || raw.captions === "off" ? raw.captions : "off";
  const look = LOOKS.includes(raw.look as Look) ? (raw.look as Look) : "none";
  const quality = typeof raw.quality === "number" ? Math.min(100, Math.max(0, raw.quality)) : 0;
  return { id, name, tagline, pacing, effects: { allowed: allowed.length ? allowed : [], maxShare: allowed.length ? maxShare : 0 }, captions, look, directorNote: note, quality };
}

// 0 to 100. Mostly how well the video performed for its age, nudged by how well the AI says it understood it.
export function scoreRecipe(views: number, ageDays: number, quality: number): number {
  const perDay = views / Math.max(1, ageDays);
  const perf = Math.min(100, Math.max(0, (Math.log10(Math.max(1, perDay)) / 6) * 100)); // 1M views/day = 100
  return Math.round(perf * 0.6 + quality * 0.4);
}

export const slugFor = (videoId: string) => `radar-${videoId.toLowerCase().replace(/[^a-z0-9_-]/g, "")}`;
