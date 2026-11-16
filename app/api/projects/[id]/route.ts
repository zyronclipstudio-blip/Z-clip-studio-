import { deleteObjects, B2_BUCKET_CLIPS, B2_BUCKET_EXPORTS } from "@/lib/storage";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
export const runtime = "nodejs";
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle();
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const db = admin();
  const [{ data: assets }, { data: jobs }] = await Promise.all([
    db.from("media_assets").select("object_key").eq("project_id", id).eq("owner_id", user.id),
    db.from("render_jobs").select("output_object_key").eq("project_id", id).eq("owner_id", user.id).not("output_object_key", "is", null),
  ]);
  const clipKeys = (assets ?? []).map((row) => row.object_key as string);
  const exportKeys = (jobs ?? []).map((row) => row.output_object_key as string).filter(Boolean);
  try { await Promise.all([deleteObjects(B2_BUCKET_CLIPS, clipKeys), deleteObjects(B2_BUCKET_EXPORTS, exportKeys)]); }
  catch { return Response.json({ error: "The stored video could not be removed. Your project was kept safe; please try again." }, { status: 502 }); }
  const { error } = await db.from("projects").delete().eq("id", id).eq("owner_id", user.id);
  if (error) return Response.json({ error: "The files were removed, but the project record could not be deleted. Please retry." }, { status: 500 });
  return Response.json({ deleted: true });
}
