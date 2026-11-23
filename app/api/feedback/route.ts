import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// The quick reasons a person can tap after a thumbs-down.
const REASONS = ["too_fast", "too_slow", "boring_start", "blurry_dark", "repeated_shots", "bad_transitions", "music_timing", "not_my_style"];

// One tap: "good" or "not good" on a finished edit. This is the score the AI learns from.
export async function POST(req: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { projectId?: string; signal?: string; reasons?: unknown };
    if (typeof body.projectId !== "string" || (body.signal !== "like" && body.signal !== "dislike")) return Response.json({ error: "Invalid request." }, { status: 400 });
    const { data: project } = await sb.from("projects").select("id,style").eq("id", body.projectId).maybeSingle();
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const db = admin();
    await db.from("feedback_events").delete().eq("owner_id", user.id).eq("project_id", project.id).in("signal", ["like", "dislike"]);
    const reasons = Array.isArray(body.reasons) ? body.reasons.filter((r): r is string => typeof r === "string" && REASONS.includes(r)).slice(0, 4) : [];
    await db.from("feedback_events").insert({ owner_id: user.id, project_id: project.id, signal: body.signal, detail: { reasons, style: (project as { style?: string | null }).style ?? null } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save that. Please try again." }, { status: 503 });
  }
}
