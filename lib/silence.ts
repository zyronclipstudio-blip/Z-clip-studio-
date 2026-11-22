import path from "node:path";
import { run } from "./media";
import { FFMPEG, UPLOAD_DIR } from "./config";
import type { EditPlan, MediaAsset } from "./types/schema";

export interface QuietSpan { start: number; end: number }

// Parses ffmpeg silencedetect output into spans, in the analysed range's own time.
export function parseSilence(stderr: string, rangeLen: number): QuietSpan[] {
  const out: QuietSpan[] = [];
  let open: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = /silence_start: (-?[\d.]+)/.exec(line);
    if (s) open = Math.max(0, Number(s[1]));
    const e = /silence_end: ([\d.]+)/.exec(line);
    if (e && open !== null) {
      out.push({ start: open, end: Number(e[1]) });
      open = null;
    }
  }
  if (open !== null) out.push({ start: open, end: rangeLen });
  return out;
}

// Dead air at the very start or end of a piece is cut off. Middle pauses are left alone (they can be meaningful).
export function trimEdges(spans: QuietSpan[], rangeLen: number, minSilence = 0.45, keepMin = 1.0, pad = 0.08): { head: number; tail: number } {
  let head = 0;
  let tail = 0;
  const first = spans.find((s) => s.start <= 0.05 && s.end - s.start >= minSilence);
  if (first) head = Math.max(0, first.end - pad);
  const last = [...spans].reverse().find((s) => s.end >= rangeLen - 0.05 && s.end - s.start >= minSilence);
  if (last) tail = Math.max(0, rangeLen - last.start - pad);
  if (rangeLen - head - tail < keepMin) return { head: 0, tail: 0 };
  return { head, tail };
}

export async function trimDeadAir(plan: EditPlan, assets: MediaAsset[]): Promise<{ plan: EditPlan; trimmedSec: number }> {
  const byId = new Map(assets.map((a) => [a.id, a]));
  let trimmed = 0;
  const segments = [];
  for (const seg of plan.segments) {
    const asset = byId.get(seg.assetId);
    const len = seg.endSec - seg.startSec;
    if (!asset || !asset.hasAudio || /\.(jpe?g|png|webp|heic)$/i.test(asset.originalName) || len < 1.6 || seg.speed || seg.reverse) {
      segments.push(seg);
      continue;
    }
    try {
      const { stderr } = await run(FFMPEG, ["-hide_banner", "-nostats", "-ss", String(seg.startSec), "-t", String(len), "-i", path.join(UPLOAD_DIR, asset.storedName), "-vn", "-af", "silencedetect=n=-45dB:d=0.3", "-f", "null", "-"], 60_000);
      const { head, tail } = trimEdges(parseSilence(stderr, len), len);
      if (head + tail > 0.15) {
        trimmed += head + tail;
        segments.push({ ...seg, startSec: Math.round((seg.startSec + head) * 1000) / 1000, endSec: Math.round((seg.endSec - tail) * 1000) / 1000 });
        continue;
      }
    } catch {
      // keep the piece as planned
    }
    segments.push(seg);
  }
  return { plan: { ...plan, segments }, trimmedSec: Math.round(trimmed * 10) / 10 };
}
