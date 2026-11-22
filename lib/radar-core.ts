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

// ---- Technique checklist: what the AI measures in each studied video ----
export interface Techniques {
  avgShotSec: number | null;
  firstCutSec: number | null;
  transitions: string[];
  hasSpeedRamp: boolean | null;
  hasTitleCard: boolean | null;
  hasEndCard: boolean | null;
  grade: string | null;
  unknown: string[];
}

const num01 = (v: unknown, max: number): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null;
};
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const words = (v: unknown, max: number): string[] =>
  (Array.isArray(v) ? v : []).map((x) => safeText(x, 30)).filter((x): x is string => Boolean(x)).map((x) => x.toLowerCase()).slice(0, max);

export const GRADES = ["flat", "warm", "cool", "dark-contrasty", "bright-soft", "black-and-white", "vivid"];

export function parseTechniques(raw: unknown): Techniques | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as Record<string, unknown>;
  const grade = typeof t.grade === "string" && GRADES.includes(t.grade) ? t.grade : null;
  const out: Techniques = {
    avgShotSec: num01(t.avgShotSec, 30), firstCutSec: num01(t.firstCutSec, 30),
    transitions: words(t.transitions, 6), hasSpeedRamp: bool(t.hasSpeedRamp), hasTitleCard: bool(t.hasTitleCard), hasEndCard: bool(t.hasEndCard),
    grade, unknown: words(t.unknown, 5),
  };
  return out.avgShotSec === null && out.transitions.length === 0 && out.grade === null ? null : out;
}

export interface ObsRow { avg_shot_sec: number | null; transitions: string[]; has_speed_ramp: boolean | null; has_title_card: boolean | null; has_end_card: boolean | null; grade: string | null }

const pct = (n: number, d: number) => Math.round((n / d) * 100);

// One short, measured sentence per niche for the editor's prompt. Needs enough videos to mean something.
export function summarizeObservations(rows: ObsRow[], minVideos = 5): string | null {
  if (rows.length < minVideos) return null;
  const shots = rows.map((r) => r.avg_shot_sec).filter((n): n is number => typeof n === "number").sort((a, b) => a - b);
  const parts: string[] = [];
  if (shots.length >= 3) parts.push(`typical shot length ${shots[Math.floor(shots.length / 2)]}s`);
  const tc = new Map<string, number>();
  rows.forEach((r) => new Set(r.transitions).forEach((t) => tc.set(t, (tc.get(t) ?? 0) + 1)));
  const top = [...tc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n / rows.length >= 0.2);
  if (top.length) parts.push(`common transitions: ${top.map(([t, n]) => `${t} (${pct(n, rows.length)}%)`).join(", ")}`);
  const share = (k: "has_speed_ramp" | "has_title_card" | "has_end_card", label: string) => {
    const n = rows.filter((r) => r[k] === true).length;
    if (n / rows.length >= 0.25) parts.push(`${label} in ${pct(n, rows.length)}%`);
  };
  share("has_speed_ramp", "speed ramps"); share("has_title_card", "title or logo card"); share("has_end_card", "end card");
  const gc = new Map<string, number>();
  rows.forEach((r) => r.grade && gc.set(r.grade, (gc.get(r.grade) ?? 0) + 1));
  const g = [...gc.entries()].sort((a, b) => b[1] - a[1])[0];
  if (g && g[1] / rows.length >= 0.4) parts.push(`${g[0]} grade in ${pct(g[1], rows.length)}%`);
  return parts.length ? `Measured from ${rows.length} trending videos in this niche: ${parts.join("; ")}. Treat as a guide, not a rule.` : null;
}
