import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EXPORT_DIR, FFMPEG, LIMITS, UPLOAD_DIR } from "./config";
import { probeMedia, run } from "./media";
import type { AspectRatio, EditPlan, MediaAsset, QACheck, QAReport } from "./types/schema";

const DIMENSIONS: Record<AspectRatio, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
};

export type RenderStage = "rendering" | "inspecting";

export interface RenderResult {
  outputName: string;
  durationSec: number;
  qa: QAReport;
  renderMs: number;
}

// Executes a validated plan. Every segment is re-encoded to identical settings,
// then joined, so the concat step never has to guess about formats.
export async function renderPlan(
  plan: EditPlan,
  assets: MediaAsset[],
  onStage?: (s: RenderStage) => void,
): Promise<RenderResult> {
  const started = Date.now();
  const byId = new Map(assets.map((a) => [a.id, a]));
  const [w, h] = DIMENSIONS[plan.aspectRatio];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "zclip-"));
  await fs.mkdir(EXPORT_DIR, { recursive: true });
  const outputName = `${crypto.randomUUID()}.mp4`;
  const outputPath = path.join(EXPORT_DIR, outputName);

  try {
    onStage?.("rendering");
    const partFiles: string[] = [];
    let expected = 0;

    for (let i = 0; i < plan.segments.length; i++) {
      const seg = plan.segments[i];
      const asset = byId.get(seg.assetId);
      if (!asset) throw new Error("Plan references an unknown clip");
      const dur = Math.round((seg.endSec - seg.startSec) * 1000) / 1000;
      if (dur <= 0 || seg.endSec > asset.durationSec + 0.05) throw new Error("Plan contains an invalid time range");
      expected += dur;

      const out = path.join(tmp, `part-${String(i).padStart(3, "0")}.mp4`);
      await run(FFMPEG, segmentArgs(path.join(UPLOAD_DIR, asset.storedName), out, seg.startSec, dur, w, h, asset.hasAudio, seg.transition === "fade", seg.volume ?? 1), LIMITS.renderTimeoutMs);
      partFiles.push(out);
    }

    const list = path.join(tmp, "list.txt");
    await fs.writeFile(list, partFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    await run(
      FFMPEG,
      ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", outputPath],
      LIMITS.renderTimeoutMs,
    );

    onStage?.("inspecting");
    const qa = await inspectOutput(outputPath, w, h, expected);
    return { outputName, durationSec: Math.round(expected * 100) / 100, qa, renderMs: Date.now() - started };
  } catch (err) {
    await fs.unlink(outputPath).catch(() => undefined);
    throw err;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

function segmentArgs(
  src: string,
  out: string,
  start: number,
  dur: number,
  w: number,
  h: number,
  hasAudio: boolean,
  fade: boolean,
  volume = 1,
): string[] {
  let vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p`;
  let af = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  if (volume !== 1) af += `,volume=${Math.min(2, Math.max(0, volume)).toFixed(2)}`;
  if (fade) {
    const f = Math.min(0.2, dur / 4).toFixed(3);
    const out_st = (dur - Number(f)).toFixed(3);
    vf += `,fade=t=in:st=0:d=${f},fade=t=out:st=${out_st}:d=${f}`;
    af += `,afade=t=in:st=0:d=${f},afade=t=out:st=${out_st}:d=${f}`;
  }

  const args = ["-y", "-hide_banner", "-ss", String(start), "-t", String(dur), "-i", src];
  if (hasAudio) {
    args.push("-map", "0:v:0", "-map", "0:a:0");
  } else {
    // Clips without sound get silence so every part has an identical audio track.
    args.push("-f", "lavfi", "-t", String(dur), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    args.push("-map", "0:v:0", "-map", "1:a:0");
  }
  args.push(
    "-vf", vf, "-af", af,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
    out,
  );
  return args;
}

// Technical quality only. Creative taste is deliberately NOT scored here.
export async function inspectOutput(file: string, w: number, h: number, expectedSec: number): Promise<QAReport> {
  const hardChecks: QACheck[] = [];
  const warnings: string[] = [];

  let probe;
  try {
    probe = await probeMedia(file);
  } catch (err) {
    return {
      passed: false,
      hardChecks: [{ name: "File is playable", ok: false, detail: err instanceof Error ? err.message : "Unreadable output" }],
      warnings,
    };
  }

  hardChecks.push({ name: "File is playable", ok: true, detail: `${probe.durationSec.toFixed(1)}s, ${probe.codec}` });
  hardChecks.push({
    name: "Correct dimensions",
    ok: probe.width === w && probe.height === h,
    detail: `${probe.width}x${probe.height} (expected ${w}x${h})`,
  });
  hardChecks.push({
    name: "Duration matches plan",
    ok: Math.abs(probe.durationSec - expectedSec) <= 1.5,
    detail: `${probe.durationSec.toFixed(1)}s vs planned ${expectedSec.toFixed(1)}s`,
  });
  hardChecks.push({ name: "Has audio track", ok: probe.hasAudio, detail: probe.hasAudio ? "Present" : "Missing" });

  try {
    const { stderr } = await run(
      FFMPEG,
      [
        "-hide_banner", "-nostats", "-i", file,
        "-vf", "blackdetect=d=0.5:pix_th=0.10,freezedetect=n=-60dB:d=2",
        "-af", "silencedetect=n=-50dB:d=2",
        "-f", "null", "-",
      ],
      300_000,
    );
    const sum = (re: RegExp) => [...stderr.matchAll(re)].reduce((s, m) => s + Number(m[1]), 0);
    const black = sum(/black_duration:([\d.]+)/g);
    const frozen = sum(/freeze_duration: ([\d.]+)/g);
    const silent = sum(/silence_duration: ([\d.]+)/g);

    hardChecks.push({ name: "No black frames", ok: black <= 2, detail: `${black.toFixed(1)}s of black` });
    if (frozen > 0) warnings.push(`About ${frozen.toFixed(1)}s of the video looks frozen.`);
    if (silent > 0 && silent < probe.durationSec * 0.95)
      warnings.push(`About ${silent.toFixed(1)}s of the audio is silent.`);
  } catch {
    warnings.push("Deep defect scan could not run; basic checks only.");
  }

  return { passed: hardChecks.every((c) => c.ok), hardChecks, warnings };
}
