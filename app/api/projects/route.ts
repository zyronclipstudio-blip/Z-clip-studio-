import { cleanupExpired } from "@/lib/cleanup";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDownloadPresignedUrl, B2_BUCKET_EXPORTS } from "@/lib/storage";
export const runtime = "nodejs";
const setupError = (e: unknown) =>
  Response.json(
    { error: e instanceof Error && /SUPABASE_SECRET_KEY|B2_|storage/i.test(e.message) ? "ZClip's storage is not connected yet. Please try again soon." : "Something went wrong. Please try again." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );

export async function GET() {
  try {
    return await listProjects();
  } catch (e) {
    return setupError(e);
  }
}

async function listProjects() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  cleanupExpired().catch(() => undefined);
  const db = admin();
  const { data: projects, error } = await db.from("projects").select("id,status,purpose,created_at,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Could not load your projects." }, { status: 500 });
  // Uploads that never finished (no clips saved) are not "edits": do not list them.
  const allIds = (projects ?? []).map((project) => project.id as string);
  const { data: withClips } = allIds.length ? await db.from("media_assets").select("project_id").in("project_id", allIds) : { data: [] };
  const hasClips = new Set((withClips ?? []).map((r) => r.project_id as string));
  const visible = (projects ?? []).filter((p) => hasClips.has(p.id as string) || !["uploading", "draft"].includes(p.status as string));
  const ids = visible.map((project) => project.id as string);
  const { data: jobs } = ids.length ? await db.from("render_jobs").select("project_id,output_object_key,created_at").in("project_id", ids).order("created_at", { ascending: false }) : { data: [] };
  const latest = new Map<string, string | null>();
  for (const job of jobs ?? []) if (!latest.has(job.project_id as string)) latest.set(job.project_id as string, (job.output_object_key as string | null) ?? null);
  const result = await Promise.all(visible.map(async (project) => {
    const outputKey = latest.get(project.id as string);
    if (project.status !== "ready" || !outputKey) return { id: project.id, status: project.status, purpose: project.purpose, createdAt: project.created_at };
    try {
      const [outputUrl, downloadUrl] = await Promise.all([
        getDownloadPresignedUrl(B2_BUCKET_EXPORTS, outputKey, { expiresIn: 3600 }),
        getDownloadPresignedUrl(B2_BUCKET_EXPORTS, outputKey, { downloadName: "zclip-video.mp4", expiresIn: 3600 }),
      ]);
      return { id: project.id, status: project.status, purpose: project.purpose, createdAt: project.created_at, outputUrl, downloadUrl };
    } catch { return { id: project.id, status: "unavailable", purpose: project.purpose, createdAt: project.created_at }; }
  }));
  return Response.json({ projects: result }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST() {
  try {
    return await createProject();
  } catch (e) {
    return setupError(e);
  }
}

async function createProject() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  cleanupExpired().catch(() => undefined);
  // Clear this person's earlier uploads that never saved a clip, so retries do not pile up.
  const db = admin();
  const { data: mine } = await db.from("projects").select("id").eq("owner_id", user.id).in("status", ["uploading", "draft"]);
  const mineIds = (mine ?? []).map((r) => r.id as string);
  if (mineIds.length) {
    const { data: used } = await db.from("media_assets").select("project_id").in("project_id", mineIds);
    const usedSet = new Set((used ?? []).map((r) => r.project_id as string));
    const empty = mineIds.filter((id) => !usedSet.has(id));
    if (empty.length) await db.from("projects").delete().in("id", empty).eq("owner_id", user.id);
  }
  const { data, error } = await db.from("projects").insert({ owner_id: user.id, status: "uploading", expires_at: null }).select("id").single();
  if (error || !data) {
    console.error("create project failed:", error?.code, error?.message);
    return Response.json({ error: "Could not create the project." }, { status: 500 });
  }
  return Response.json({ projectId: data.id });
}
