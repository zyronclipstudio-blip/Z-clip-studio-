import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { UPLOAD_DIR } from "./config";
import { getDownloadPresignedUrl, B2_BUCKET_CLIPS } from "./storage";
import type { MediaAsset } from "./types/schema";

interface AssetRow {
  id: string;
  object_key: string;
  original_name: string;
  duration_sec: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  has_audio: boolean;
  size_bytes: number;
  created_at: string;
}

export function rowToAsset(r: AssetRow): MediaAsset {
  return {
    id: r.id,
    originalName: r.original_name,
    storedName: path.basename(r.object_key),
    sizeBytes: Number(r.size_bytes),
    durationSec: Number(r.duration_sec),
    width: r.width,
    height: r.height,
    fps: Number(r.fps),
    hasAudio: r.has_audio,
    codec: r.codec,
    createdAt: r.created_at,
  };
}

// Media lives in the private Backblaze B2 bucket; FFmpeg needs a local file, so we stream it
// into a temporary working folder and delete it as soon as the job ends.
export async function downloadToWorkDir(objectKey: string, storedName: string): Promise<string> {
  await fsp.mkdir(UPLOAD_DIR, { recursive: true });
  const dest = path.join(UPLOAD_DIR, storedName);
  const signedUrl = await getDownloadPresignedUrl(B2_BUCKET_CLIPS, objectKey, { expiresIn: 600 });
  const res = await fetch(signedUrl);
  if (!res.ok || !res.body) throw new Error("Could not download an uploaded clip from storage");
  await pipeline(Readable.fromWeb(res.body as never), fs.createWriteStream(dest));
  return dest;
}

export async function removeLocal(storedNames: string[]): Promise<void> {
  await Promise.all(storedNames.map((n) => fsp.unlink(path.join(UPLOAD_DIR, n)).catch(() => undefined)));
}
