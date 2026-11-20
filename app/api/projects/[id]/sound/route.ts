import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { allSoundKeys, SOUND_EXTS, SOUND_MAX_BYTES, SOUND_MIME, soundKey } from "@/lib/sound";
import { deleteObjects, putObjectStream, B2_BUCKET_CLIPS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The person's own sound for this edit. It is streamed through ZClip into their private storage.
// One sound per project: a new one replaces the old.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle(); // RLS: own projects only
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const ext = (new URL(req.url).searchParams.get("ext") ?? "").toLowerCase();
  if (!(SOUND_EXTS as readonly string[]).includes(ext))
    return Response.json({ error: "Use an MP3, M4A, WAV, OGG file, or a video to take its sound." }, { status: 400 });
  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > SOUND_MAX_BYTES)
    return Response.json({ error: "That sound is too large (limit 40 MB)." }, { status: 413 });
  if (!req.body) return Response.json({ error: "No file received." }, { status: 400 });

  const key = soundKey(user.id, id, ext);
  try {
    await deleteObjects(B2_BUCKET_CLIPS, allSoundKeys(user.id, id).filter((k) => k !== key)).catch(() => undefined);
    await putObjectStream(B2_BUCKET_CLIPS, key, Readable.fromWeb(req.body as unknown as NodeReadableStream), length, SOUND_MIME[ext]);
  } catch {
    return Response.json({ error: "We could not save that sound. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true, key });
}
