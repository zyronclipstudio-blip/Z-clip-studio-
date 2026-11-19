import crypto from "node:crypto";
import path from "node:path";
import { z } from "zod";
import { LIMITS, MIME_BY_EXT } from "@/lib/config";
import { checkBatch, logEvent } from "@/lib/guardian";
import { getUploadPresignedUrl, ensureUploadCors, B2_BUCKET_CLIPS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  files: z.array(z.object({ name: z.string().min(1).max(300), size: z.number().int().positive() })).min(1).max(100),
});

// Step 1 of upload: the server decides the allowed storage paths and hands out
// short-lived Backblaze B2 signed PUT upload URLs. The browser never chooses where files go.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle(); // RLS: own projects only
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const { count } = await sb.from("media_assets").select("id", { count: "exact", head: true }).eq("project_id", id);
  if (count) return Response.json({ error: "This project already has clips. Start a new project." }, { status: 409 });

  const gate = checkBatch({ count: body.files.length, totalBytes: body.files.reduce((s, f) => s + f.size, 0) });
  if (!gate.allowed) {
    await logEvent("upload_blocked", "block", gate.reasons.join(" "), { projectId: id }, user.id);
    return Response.json({ error: gate.reasons.join(" ") }, { status: 400 });
  }
  for (const f of body.files) {
    const ext = path.extname(f.name).toLowerCase();
    if (!(LIMITS.allowedExtensions as readonly string[]).includes(ext))
      return Response.json({ error: `"${path.basename(f.name)}" is not a supported video type (use MP4, MOV, M4V, WebM or AVI).` }, { status: 400 });
  }

  const uploads: { path: string; token: string; url: string; name: string; contentType: string }[] = [];
  for (const f of body.files) {
    const ext = path.extname(f.name).toLowerCase();
    const contentType = MIME_BY_EXT[ext];
    if (!contentType) return Response.json({ error: `Unsupported video type: ${ext || "unknown"}.` }, { status: 400 });
    const objectPath = `${user.id}/${id}/${crypto.randomUUID()}${ext}`;
    await ensureUploadCors([process.env.APP_ORIGIN || new URL(req.url).origin]);
    const uploadUrl = await getUploadPresignedUrl(B2_BUCKET_CLIPS, objectPath, contentType, 900);
    uploads.push({
      path: objectPath,
      token: "", // Kept for backwards compatibility with front-end contract
      url: uploadUrl,
      name: path.basename(f.name).replace(/[^\w .()-]/g, "_").slice(0, 120),
      contentType,
    });
  }
  return Response.json({ uploads });
}
