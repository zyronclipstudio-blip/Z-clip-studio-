import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { downloadToWorkDir, removeLocal } from "@/lib/assets";
import { checkDurations, logEvent } from "@/lib/guardian";
import { probeMedia, type ProbeResult } from "@/lib/media";
import { deleteObjects, B2_BUCKET_CLIPS } from "@/lib/storage";
import { admin } from "@/lib/supabase/admin";
import { getSettings, num } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ files: z.array(z.object({ path: z.string().min(1), name: z.string().min(1).max(200) })).min(1).max(100) });

// Step 2 of upload: after the browser has uploaded to Backblaze B2, the server checks that every
// file really is a readable video before recording it.
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

  const { data: project } = await sb.from("projects").select("id, expires_at").eq("id", id).maybeSingle();
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const prefix = `${user.id}/${id}/`;
  const db = admin();
  const allPaths = body.files.map((f) => f.path);
  const rejectAll = async (message: string, status = 400) => {
    await deleteObjects(B2_BUCKET_CLIPS, allPaths.filter((p) => p.startsWith(prefix) && !p.includes("..")));
    await removeLocal(allPaths.map((p) => path.basename(p)));
    await logEvent("upload_rejected", "warn", message, { projectId: id }, user.id);
    return Response.json({ error: message }, { status: status });
  };

  const metas: { file: (typeof body.files)[number]; meta: ProbeResult; size: number }[] = [];
  for (const f of body.files) {
    if (!f.path.startsWith(prefix) || f.path.includes("..")) return rejectAll("Invalid file location.", 403);
    try {
      const local = await downloadToWorkDir(f.path, path.basename(f.path));
      const meta = await probeMedia(local); // proves it is a real, readable video
      metas.push({ file: f, meta, size: (await fsp.stat(local)).size });
    } catch {
      return rejectAll(`"${f.name}" could not be read as a video. It may be corrupt or the upload may be incomplete.`);
    }
  }

  const issues = checkDurations(metas.map((m) => m.meta.durationSec));
  if (issues.length) return rejectAll(issues.join(" "));

  const settings = await getSettings();
  const sourceRetentionExpiresAt = new Date(Date.now() + num(settings.retention_hours, 24) * 3600_000).toISOString();
  const rows = metas.map((m) => ({
    id: crypto.randomUUID(),
    project_id: id,
    owner_id: user.id,
    object_key: m.file.path,
    original_name: m.file.name,
    duration_sec: m.meta.durationSec,
    width: m.meta.width,
    height: m.meta.height,
    fps: m.meta.fps,
    codec: m.meta.codec,
    has_audio: m.meta.hasAudio,
    size_bytes: m.size,
    retention_expires_at: sourceRetentionExpiresAt,
  }));
  const { error } = await db.from("media_assets").insert(rows);
  await removeLocal(allPaths.map((p) => path.basename(p))); // processing re-downloads when needed
  if (error) return rejectAll("Could not save your clips.", 500);

  return Response.json({ count: rows.length });
}
