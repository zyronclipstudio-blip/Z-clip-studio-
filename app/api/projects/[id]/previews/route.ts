import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getDownloadPresignedUrl, B2_BUCKET_CLIPS } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Short-lived links so the editor can play the person's own clips for live preview.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle(); // RLS: own projects only
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const { data: rows } = await admin().from("media_assets").select("id, object_key").eq("project_id", id).eq("owner_id", user.id);
  const urls: Record<string, string> = {};
  await Promise.all(
    (rows ?? []).map(async (r) => {
      try {
        urls[r.id as string] = await getDownloadPresignedUrl(B2_BUCKET_CLIPS, r.object_key as string, { expiresIn: 3600 });
      } catch {
        /* a missing link just means that clip has no preview */
      }
    }),
  );
  return Response.json({ urls }, { headers: { "Cache-Control": "no-store" } });
}
