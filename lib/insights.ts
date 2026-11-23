import { admin } from "./supabase/admin";
import { summarizeObservations, type ObsRow } from "./radar-core";

// The measured facts for a niche, learned from studied trending videos. Null until there is enough data.
export async function nicheInsight(nicheId?: string): Promise<string | null> {
  if (!nicheId) return null;
  const { data } = await admin()
    .from("technique_observations")
    .select("avg_shot_sec, transitions, has_speed_ramp, has_title_card, has_end_card, grade")
    .eq("niche", nicheId)
    .order("created_at", { ascending: false })
    .limit(60);
  return summarizeObservations((data ?? []) as ObsRow[]);
}

// What the AI's own practice edits were marked down for, so the next edit in that style avoids it.
// Only low-scoring runs count, and only the newest few distinct complaints are used.
export async function practiceLesson(styleId?: string): Promise<string | null> {
  if (!styleId) return null;
  const { data } = await admin()
    .from("practice_runs")
    .select("score, issues")
    .eq("style", styleId)
    .not("score", "is", null)
    .lte("score", 5)
    .order("created_at", { ascending: false })
    .limit(8);
  const seen = new Set<string>();
  for (const r of data ?? []) for (const i of (r.issues as string[]) ?? []) seen.add(i.trim().toLowerCase());
  const list = [...seen].slice(0, 4);
  return list.length ? `Recent edits in this style were marked down for: ${list.join("; ")}. Avoid these mistakes.` : null;
}

const REASON_TEXT: Record<string, string> = {
  too_fast: "cuts felt too fast", too_slow: "pacing felt too slow", boring_start: "the start was boring", blurry_dark: "shots were blurry or dark",
  repeated_shots: "shots repeated", bad_transitions: "transitions felt rough", music_timing: "cuts did not match the music", not_my_style: "it did not feel like the chosen style",
};

// What real people said was wrong with recent edits in this style. A reason needs at least 2 reports to count.
export async function userLesson(styleId?: string): Promise<string | null> {
  if (!styleId) return null;
  const { data } = await admin().from("feedback_events").select("detail").eq("signal", "dislike").order("created_at", { ascending: false }).limit(200);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const d = r.detail as { reasons?: string[]; style?: string } | null;
    if (d?.style !== styleId) continue;
    for (const x of d.reasons ?? []) counts.set(x, (counts.get(x) ?? 0) + 1);
  }
  const top = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => REASON_TEXT[k]).filter(Boolean);
  return top.length ? `People marked recent edits in this style down because: ${top.join("; ")}. Fix these.` : null;
}
