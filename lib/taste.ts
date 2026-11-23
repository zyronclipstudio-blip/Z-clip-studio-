import { admin } from "./supabase/admin";
import { tasteSummary, type TasteSample } from "./taste-core";

// Reads one person's recent thumbs and downloads, looks at the plans of those edits, and summarises their taste.
export async function userTaste(ownerId: string): Promise<string | null> {
  const db = admin();
  const { data: events } = await db
    .from("feedback_events")
    .select("project_id, signal, detail")
    .eq("owner_id", ownerId)
    .in("signal", ["like", "dislike", "download"])
    .order("created_at", { ascending: false })
    .limit(40);
  if (!events?.length) return null;
  const ids = [...new Set(events.map((e) => e.project_id as string))];
  const { data: plans } = await db.from("edit_plans").select("project_id, version, plan").in("project_id", ids).order("version", { ascending: false });
  const latest = new Map<string, Record<string, unknown>>();
  for (const p of plans ?? []) if (!latest.has(p.project_id as string)) latest.set(p.project_id as string, p.plan as Record<string, unknown>);
  const samples: TasteSample[] = [];
  for (const e of events) {
    const plan = latest.get(e.project_id as string) as { pacing?: string; segments?: { startSec: number; endSec: number; effects?: string[]; blend?: string }[] } | undefined;
    if (!plan?.segments?.length) continue;
    const segs = plan.segments;
    samples.push({
      score: e.signal === "dislike" ? -1 : 1,
      reasons: ((e.detail as { reasons?: string[] } | null)?.reasons ?? []).filter((r) => typeof r === "string"),
      pacing: plan.pacing,
      effects: [...new Set(segs.flatMap((s) => s.effects ?? []))],
      avgPieceSec: segs.reduce((t, s) => t + (s.endSec - s.startSec), 0) / segs.length,
      blends: segs.filter((s) => s.blend).length,
    });
  }
  return tasteSummary(samples);
}
