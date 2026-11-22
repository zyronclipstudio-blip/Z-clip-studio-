import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { FFMPEG } from "./config";

const exec = promisify(execFile);

// The AI watches its own finished video (a few small frames) and scores it like an editor would.
// The frames are taken here, used once and thrown away; nothing is kept but the score and short notes.
export async function extractFrames(videoPath: string, durationSec: number, count = 6): Promise<string[]> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "zclip-review-"));
  try {
    await exec(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", videoPath, "-vf", `fps=${(count / Math.max(1, durationSec)).toFixed(4)},scale=270:-2`, "-frames:v", String(count), "-q:v", "5", path.join(dir, "f%02d.jpg")], { timeout: 30_000 });
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".jpg")).sort();
    return await Promise.all(files.map(async (f) => (await fs.readFile(path.join(dir, f))).toString("base64")));
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export interface Review { score: number; hook: number; issues: string[] }

export function parseReview(text: string): Review | null {
  try {
    const j = JSON.parse(text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as Record<string, unknown>;
    const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(10, Math.round(v * 10) / 10)) : null);
    const score = n(j.score), hook = n(j.hook);
    if (score === null || hook === null) return null;
    const issues = (Array.isArray(j.issues) ? j.issues : []).filter((x): x is string => typeof x === "string").map((x) => x.replace(/[^\p{L}\p{N} ,.'%-]/gu, "").slice(0, 120)).slice(0, 4);
    return { score, hook, issues };
  } catch {
    return null;
  }
}

