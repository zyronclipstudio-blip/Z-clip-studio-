import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { LIMITS, MIME_BY_EXT } from "@/lib/config";
import { putObjectStream, B2_BUCKET_CLIPS } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fallback for phones or networks that cannot reach storage directly: the file is streamed
// through ZClip into the private bucket. The path must be one this account was just given.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle(); // RLS: own projects only
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

  const key = new URL(req.url).searchParams.get("path") ?? "";
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  const allowedTypes = Object.values(MIME_BY_EXT) as string[];
  if (!key.startsWith(`${user.id}/${id}/`) || key.includes("..") || !(ext in MIME_BY_EXT) || !allowedTypes.includes(contentType)) {
    return Response.json({ error: "That upload was not accepted." }, { status: 400 });
  }
  const length = Number(req.headers.get("content-length"));
  if (!Number.isFinite(length) || length <= 0 || length > LIMITS.maxBatchBytes) {
    return Response.json({ error: "That file is too large or its size is unknown." }, { status: 413 });
  }
  if (!req.body) return Response.json({ error: "No file received." }, { status: 400 });

  try {
    await putObjectStream(B2_BUCKET_CLIPS, key, Readable.fromWeb(req.body as unknown as NodeReadableStream), length, contentType);
  } catch (e) {
    console.error("upload proxy failed:", e instanceof Error ? e.name : "error");
    return Response.json({ error: "We could not save that file. Please try again." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
