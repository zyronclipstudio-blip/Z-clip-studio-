import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { TEST_DIR } from "./setup";
import { UPLOAD_DIR } from "../lib/config";
import { probeMedia } from "../lib/media";
import type { MediaAsset } from "../lib/types/schema";

const SRC = path.join(TEST_DIR, "src");
fs.mkdirSync(SRC, { recursive: true });

export interface ClipOpts {
  seconds: number;
  w: number;
  h: number;
  fps?: number;
  audio?: boolean;
  pattern?: "moving" | "black" | "still";
}

// Generates a real video file with FFmpeg so tests exercise the real pipeline.
export function makeClip(name: string, o: ClipOpts): string {
  const out = path.join(SRC, name);
  const fps = o.fps ?? 30;
  const video =
    o.pattern === "black"
      ? `color=c=black:s=${o.w}x${o.h}:r=${fps}:d=${o.seconds}`
      : o.pattern === "still"
        ? `color=c=0x2244aa:s=${o.w}x${o.h}:r=${fps}:d=${o.seconds}`
        : `testsrc2=s=${o.w}x${o.h}:r=${fps}:d=${o.seconds}`;
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", video];
  if (o.audio) args.push("-f", "lavfi", "-i", `sine=frequency=440:duration=${o.seconds}`, "-c:a", "aac");
  args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-shortest", out);
  execFileSync("ffmpeg", args);
  return out;
}

// Registers a generated file the way the upload flow would: a stored name inside UPLOAD_DIR plus probed metadata.
export async function assetFrom(file: string, originalName = path.basename(file)): Promise<MediaAsset> {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const id = crypto.randomUUID();
  const storedName = `${id}${path.extname(file)}`;
  fs.copyFileSync(file, path.join(UPLOAD_DIR, storedName));
  const meta = await probeMedia(path.join(UPLOAD_DIR, storedName));
  return { id, originalName, storedName, sizeBytes: fs.statSync(file).size, createdAt: new Date().toISOString(), ...meta };
}

export function fakeAsset(durationSec: number, i = 0): MediaAsset {
  return {
    id: `asset-${i}`,
    originalName: `clip-${i}.mp4`,
    storedName: `asset-${i}.mp4`,
    sizeBytes: 1000,
    durationSec,
    width: 1920,
    height: 1080,
    fps: 30,
    hasAudio: true,
    codec: "h264",
    createdAt: new Date().toISOString(),
  };
}
