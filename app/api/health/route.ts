import { admin } from "@/lib/supabase/admin";
import { canDrawText, canXfade } from "@/lib/renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A tiny health report (counts only, no private data): is the AI planning, rendering and judging properly right now?
export async function GET() {
  try {
    const db = admin();
    const since = new Date(Date.now() - 6 * 3_600_000).toISOString();
    const [runs, fallbacks, withheld, failedJobs] = await Promise.all([
      db.from("practice_runs").select("score, error").gte("created_at", since),
      db.from("guardian_events").select("id", { count: "exact", head: true }).eq("event_type", "ai_fallback").gte("created_at", since),
      db.from("guardian_events").select("id", { count: "exact", head: true }).eq("event_type", "render_withheld").gte("created_at", since),
      db.from("render_jobs").select("id", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since),
    ]);
    const r = runs.data ?? [];
    const practiceErrors = r.filter((x) => x.error).length;
    const unscored = r.filter((x) => x.score === null && !x.error).length;
    const problems: string[] = [];
    // Does this server's FFmpeg have what the editing tools need? (text, smooth blends)
    const [text, blends] = await Promise.all([canDrawText(), canXfade()]);
    if (!text) problems.push("this server cannot draw text (captions and titles will be skipped)");
    if (!blends) problems.push("this server cannot do smooth blends");
    if (practiceErrors > 0) problems.push(`${practiceErrors} practice edit(s) hit an error`);
    if (unscored > 0) problems.push(`${unscored} practice edit(s) were not scored`);
    if ((fallbacks.count ?? 0) > 0) problems.push(`${fallbacks.count} edit(s) fell back to the basic editor`);
    if ((withheld.count ?? 0) > 0) problems.push(`${withheld.count} render(s) withheld by the quality check`);
    if ((failedJobs.count ?? 0) > 0) problems.push(`${failedJobs.count} render job(s) failed`);
    return Response.json({ ok: problems.length === 0, windowHours: 6, practiceRuns: r.length, tools: { text, blends }, problems });
  } catch {
    return Response.json({ ok: false, problems: ["health check could not read the database"] }, { status: 503 });
  }
}
