import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// One tap: "good" or "not good" on a finished edit. This is the score the AI learns from.
export async function POST(req: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
    const body = (await req.json().catch(() => ({}))) as { projectId?: string; signal?: string };
    if (typeof body.projectId !== "string" || (body.signal !== "like" && body.signal !== "dislike")) return Response.json({ error: "Invalid request." }, { status: 400 });
    const { data: project } = await sb.from("projects").select("id").eq("id", body.projectId).maybeSingle();
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const db = admin();
    await db.from("feedback_events").delete().eq("owner_id", user.id).eq("project_id", project.id).in("signal", ["like", "dislike"]);
    await db.from("feedback_events").insert({ owner_id: user.id, project_id: project.id, signal: body.signal, detail: {} });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Could not save that. Please try again." }, { status: 503 });
  }
}
