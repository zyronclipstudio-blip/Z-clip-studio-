import { cleanupExpired } from "@/lib/cleanup";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDownloadPresignedUrl, B2_BUCKET_EXPORTS } from "@/lib/storage";
export const runtime = "nodejs";
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  cleanupExpired().catch(() => undefined);
  const db = admin();
  const { data: projects, error } = await db.from("projects").select("id,status,purpose,created_at,updated_at").eq("owner_id", user.id).order("updated_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Could not load your projects." }, { status: 500 });
  const ids = (projects ?? []).map((project) => project.id as string);
  const { data: jobs } = ids.length ? await db.from("render_jobs").select("project_id,output_object_key,created_at").in("project_id", ids).order("created_at", { ascending: false }) : { data: [] };
  const latest = new Map<string, string | null>();
  for (const job of jobs ?? []) if (!latest.has(job.project_id as string)) latest.set(job.project_id as string, (job.output_object_key as string | null) ?? null);
  const result = await Promise.all((projects ?? []).map(async (project) => {
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
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  cleanupExpired().catch(() => undefined);
  const { data, error } = await admin().from("projects").insert({ owner_id: user.id, status: "uploading", expires_at: null }).select("id").single();
  if (error || !data) return Response.json({ error: "Could not create the project." }, { status: 500 });
  return Response.json({ projectId: data.id });
}
