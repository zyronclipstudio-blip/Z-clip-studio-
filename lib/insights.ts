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
