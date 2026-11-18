import { rowToAsset } from "@/lib/assets";
import { B2_BUCKET_EXPORTS, getDownloadPresignedUrl } from "@/lib/storage";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { EditPlanSchema, type PublicAsset } from "@/lib/types/schema";

export const runtime = "nodejs";

// Reopens a saved edit so the customer can keep fixing it: clips, the latest plan, earlier versions
// and a fresh link to the latest finished video. Only the owner's own project is ever returned.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: project } = await sb.from("projects").select("id, platform, purpose, mood, status").eq("id", id).maybeSingle();
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const db = admin();
  const [{ data: rows }, { data: planRows }, { data: jobs }] = await Promise.all([
    db.from("media_assets").select("*").eq("project_id", id).eq("owner_id", user.id).order("created_at"),
    db.from("edit_plans").select("version, plan, created_at").eq("project_id", id).eq("owner_id", user.id).order("version", { ascending: false }).limit(15),
    db.from("render_jobs").select("output_object_key").eq("project_id", id).eq("owner_id", user.id).eq("status", "succeeded").not("output_object_key", "is", null).order("created_at", { ascending: false }).limit(1),
  ]);
  if (!rows?.length) return Response.json({ error: "The clips for this edit have been removed, so it can no longer be changed." }, { status: 410 });

  const versions = (planRows ?? []).flatMap((r) => {
    const parsed = EditPlanSchema.safeParse(r.plan);
    return parsed.success ? [{ version: r.version as number, createdAt: r.created_at as string, plan: parsed.data }] : [];
  });
  if (!versions.length) return Response.json({ error: "This project has no finished edit yet." }, { status: 409 });

  const assets: PublicAsset[] = rows.map((r) => {
    const { storedName: _omit, ...pub } = rowToAsset(r);
    void _omit;
    return pub;
  });

  let outputUrl: string | undefined;
  let downloadUrl: string | undefined;
  const key = jobs?.[0]?.output_object_key as string | undefined;
  if (key) {
    try {
      [outputUrl, downloadUrl] = await Promise.all([
        getDownloadPresignedUrl(B2_BUCKET_EXPORTS, key, { expiresIn: 3600 }),
        getDownloadPresignedUrl(B2_BUCKET_EXPORTS, key, { downloadName: "zclip-video.mp4", expiresIn: 3600 }),
      ]);
    } catch {
      /* the video link is optional; editing still works */
    }
  }

  return Response.json(
    { projectId: id, platform: project.platform ?? "auto", purpose: project.purpose, mood: project.mood, assets, plan: versions[0].plan, versions, outputUrl, downloadUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
