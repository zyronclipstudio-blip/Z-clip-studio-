import path from "node:path";
import { run } from "./media";
import { FFMPEG, UPLOAD_DIR } from "./config";
import type { EditPlan, MediaAsset } from "./types/schema";

// Shot quality: one frame from the middle of each piece. Very dark or very blurry shots are dropped,
// the way an editor skips an accidental pocket shot. Conservative on purpose: when unsure, keep the shot.
export const DARK_LUMA = 30; // 0-255 average brightness
export const BLUR_DETAIL = 0.55; // average edge strength after edge detection, 0-255

export function isWeakShot(m: { luma: number; detail: number }): "dark" | "blurry" | null {
  if (m.luma < DARK_LUMA) return "dark";
  if (m.detail < BLUR_DETAIL) return "blurry";
  return null;
}

async function yavg(src: string, at: number, vf: string): Promise<number | null> {
  const { stderr } = await run(FFMPEG, ["-hide_banner", "-ss", String(at), "-i", src, "-frames:v", "1", "-vf", `scale=320:-2,${vf}signalstats,metadata=print`, "-f", "null", "-"], 20_000);
  const m = /YAVG=([0-9.]+)/.exec(stderr);
  return m ? Number(m[1]) : null;
}

export async function measureShot(src: string, at: number): Promise<{ luma: number; detail: number } | null> {
  try {
    const luma = await yavg(src, at, "");
    const detail = await yavg(src, at, "edgedetect=low=0.08:high=0.25,");
    return luma === null || detail === null ? null : { luma, detail };
  } catch {
    return null;
  }
}

export async function dropWeakShots(plan: EditPlan, assets: MediaAsset[]): Promise<{ plan: EditPlan; dropped: string[] }> {
  const byId = new Map(assets.map((a) => [a.id, a]));
  const weak: (string | null)[] = [];
  for (let i = 0; i < plan.segments.length; i += 4) {
    const batch = plan.segments.slice(i, i + 4);
    const res = await Promise.all(
      batch.map(async (s) => {
        const a = byId.get(s.assetId);
        if (!a || /\.(jpe?g|png|webp|heic)$/i.test(a.originalName)) return null;
        const m = await measureShot(path.join(UPLOAD_DIR, a.storedName), (s.startSec + s.endSec) / 2);
        return m ? isWeakShot(m) : null;
      }),
    );
    weak.push(...res);
  }
  const limit = Math.floor(plan.segments.length * 0.3); // never gut the edit
  const keep: typeof plan.segments = [];
  const dropped: string[] = [];
  plan.segments.forEach((s, i) => {
    if (weak[i] && dropped.length < limit && plan.segments.length - dropped.length > 3) dropped.push(weak[i] as string);
    else keep.push(s);
  });
  return { plan: dropped.length ? { ...plan, segments: keep } : plan, dropped };
}
