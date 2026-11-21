import crypto from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import { LIMITS, MIME_BY_EXT } from "@/lib/config";
import { B2_BUCKET_CLIPS, putObjectStream } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resumable upload for weak connections. The phone sends the file in small pieces; each piece can be
// retried on its own, and an interrupted upload picks up where it stopped. When every piece has
// arrived, ZClip joins them and saves the file into the private bucket.
const MAX_CHUNK = 2 * 1024 * 1024;

async function authorise(req: Request, id: string) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { error: Response.json({ error: "Please sign in." }, { status: 401 }) } as const;
  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle(); // RLS: own projects only
  if (!project) return { error: Response.json({ error: "Project not found." }, { status: 404 }) } as const;
  const q = new URL(req.url).searchParams;
  const key = q.get("path") ?? "";
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  if (!key.startsWith(`${user.id}/${id}/`) || key.includes("..") || !(ext in MIME_BY_EXT)) {
    return { error: Response.json({ error: "That upload was not accepted." }, { status: 400 }) } as const;
  }
  const dir = path.join(os.tmpdir(), "zclip-chunks", crypto.createHash("sha256").update(key).digest("hex").slice(0, 40));
  return { user, key, ext, q, dir } as const;
}

// Which pieces have already arrived (so an interrupted upload can resume).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authorise(req, id);
  if ("error" in a) return a.error;
  const have = await fs.readdir(a.dir).catch(() => [] as string[]);
  return Response.json({ have: have.filter((n) => /^\d+$/.test(n)).map(Number) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await authorise(req, id);
  if ("error" in a) return a.error;
  const index = Number(a.q.get("index"));
  const total = Number(a.q.get("total"));
  const size = Number(a.q.get("size"));
  if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || total < 1 || total > 1000 || index >= total || !Number.isFinite(size) || size <= 0 || size > LIMITS.maxBatchBytes) {
    return Response.json({ error: "That upload was not accepted." }, { status: 400 });
  }
  const bytes = Buffer.from(await req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_CHUNK) return Response.json({ error: "That piece is the wrong size." }, { status: 413 });

  await fs.mkdir(a.dir, { recursive: true });
  const tmp = path.join(a.dir, `${index}.part`);
  await fs.writeFile(tmp, bytes);
  await fs.rename(tmp, path.join(a.dir, String(index)));

  const have = (await fs.readdir(a.dir)).filter((n) => /^\d+$/.test(n));
  if (have.length < total) return Response.json({ ok: true, received: have.length, total });

  // All pieces are here: check the size, join them in order, and save the file.
  const lock = path.join(a.dir, "assembling");
  try {
    await fs.mkdir(lock);
  } catch {
    return Response.json({ ok: true, received: have.length, total, assembling: true });
  }
  try {
    let sum = 0;
    for (let i = 0; i < total; i++) sum += (await fs.stat(path.join(a.dir, String(i)))).size;
    if (sum !== size) {
      await fs.rm(a.dir, { recursive: true, force: true });
      return Response.json({ error: "The pieces did not add up. Please upload that file again." }, { status: 422 });
    }
    const joined = new PassThrough();
    (async () => {
      for (let i = 0; i < total; i++) {
        await new Promise<void>((resolve, reject) => {
          const rs = createReadStream(path.join(a.dir, String(i)));
          rs.on("error", reject);
          rs.on("end", resolve);
          rs.pipe(joined, { end: false });
        });
      }
      joined.end();
    })().catch((e) => joined.destroy(e));
    await putObjectStream(B2_BUCKET_CLIPS, a.key, Readable.from(joined), size, MIME_BY_EXT[a.ext]);
    await fs.rm(a.dir, { recursive: true, force: true });
    return Response.json({ ok: true, done: true });
  } catch (e) {
    console.error("chunk assemble failed:", e instanceof Error ? e.name : "error");
    await fs.rm(lock, { recursive: true, force: true }).catch(() => undefined);
    return Response.json({ error: "We could not save that file. Please try again." }, { status: 502 });
  }
}
