// "My style": what one person tends to like, learned quietly from their thumbs and downloads. Pure, no database.
export interface TasteSample {
  score: number; // +1 liked or downloaded, -1 disliked
  reasons: string[]; // reasons they tapped after a thumbs-down
  pacing?: string;
  effects: string[];
  avgPieceSec: number;
  blends: number;
}

const REASON_PREFERENCE: Record<string, string> = {
  too_fast: "slower, less rushed cuts",
  too_slow: "faster, snappier cuts",
  boring_start: "a stronger, more exciting opening",
  blurry_dark: "only sharp, well-lit shots",
  repeated_shots: "no repeated shots",
  bad_transitions: "gentler transitions",
  music_timing: "cuts that land exactly on the beat",
};

export function features(s: TasteSample): string[] {
  const f: string[] = [];
  if (s.pacing) f.push(`${s.pacing} pacing`);
  if (s.avgPieceSec > 0 && s.avgPieceSec < 1.8) f.push("very quick cuts");
  else if (s.avgPieceSec > 3.5) f.push("long calm holds");
  for (const e of s.effects) f.push(`the ${e} effect`);
  if (s.blends > 0) f.push("smooth blends between shots");
  return f;
}

// Needs at least 3 rated edits. A feature counts once it clearly leans one way (net +2 or -2).
export function tasteSummary(samples: TasteSample[]): string | null {
  if (samples.length < 3) return null;
  const net = new Map<string, number>();
  for (const s of samples) for (const f of new Set(features(s))) net.set(f, (net.get(f) ?? 0) + s.score);
  const likes = [...net].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => f);
  const dislikes = [...net].filter(([, n]) => n <= -2).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([f]) => f);
  const asked = new Set<string>();
  for (const s of samples) for (const r of s.reasons) if (REASON_PREFERENCE[r]) asked.add(REASON_PREFERENCE[r]);
  const parts: string[] = [];
  if (likes.length) parts.push(`they have liked edits with ${likes.join(", ")}`);
  if (dislikes.length) parts.push(`they have disliked edits with ${dislikes.join(", ")}`);
  if (asked.size) parts.push(`they asked for ${[...asked].slice(0, 3).join(", ")}`);
  return parts.length ? `About THIS person's taste: ${parts.join("; ")}. Lean towards what they like, but still follow the chosen style.` : null;
}
