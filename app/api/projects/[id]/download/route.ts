import { Readable } from "node:stream";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { B2_BUCKET_EXPORTS, getB2Client } from "@/lib/storage";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Saves the latest finished video through ZClip itself, so the phone gets a proper .mp4 download
// instead of a raw storage page, and the link never expires. Only the owner's own project is served.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
    const { data: jobs } = await admin()
      .from("render_jobs")
      .select("output_object_key")
      .eq("project_id", id)
      .eq("owner_id", user.id)
      .eq("status", "succeeded")
      .not("output_object_key", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const key = jobs?.[0]?.output_object_key as string | undefined;
    if (!key) return Response.json({ error: "This video is no longer available." }, { status: 404 });
    const obj = await getB2Client().send(new GetObjectCommand({ Bucket: B2_BUCKET_EXPORTS, Key: key }));
    if (!obj.Body) return Response.json({ error: "This video is no longer available." }, { status: 404 });
    const headers = new Headers({
      "Content-Type": "video/mp4",
      "Content-Disposition": 'attachment; filename="zclip-video.mp4"',
      "Cache-Control": "private, no-store",
    });
    if (obj.ContentLength) headers.set("Content-Length", String(obj.ContentLength));
    return new Response(Readable.toWeb(obj.Body as Readable) as unknown as ReadableStream, { headers });
  } catch {
    return Response.json({ error: "Could not prepare the download. Please try again." }, { status: 503 });
  }
}
