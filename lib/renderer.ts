import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EXPORT_DIR, FFMPEG, LIMITS, UPLOAD_DIR } from "./config";
import { probeMedia, run } from "./media";
import { isImageName } from "./image";
import type { AspectRatio, EditPlan, EffectId, MediaAsset, QACheck, QAReport } from "./types/schema";

// 720p exports: sharp on phones, small for WhatsApp, and light enough for a small server.
const DIMENSIONS: Record<AspectRatio, [number, number]> = {
  "9:16": [720, 1280],
  "16:9": [1280, 720],
  "1:1": [720, 720],
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
  soundFile?: string,
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
    const grades = new Map<string, string>();
    let expected = 0;

    for (let i = 0; i < plan.segments.length; i++) {
      const seg = plan.segments[i];
      const asset = byId.get(seg.assetId);
      if (!asset) throw new Error("Plan references an unknown clip");
      const dur = Math.round((seg.endSec - seg.startSec) * 1000) / 1000;
      if (dur <= 0 || seg.endSec > asset.durationSec + 0.05) throw new Error("Plan contains an invalid time range");
      const spd = seg.speed && seg.speed !== 1 ? seg.speed : 1;
      expected += dur / spd;

      const out = path.join(tmp, `part-${String(i).padStart(3, "0")}.mp4`);
      const src = path.join(UPLOAD_DIR, asset.storedName);
      const still = isImageName(asset.originalName);
      let capVf = "";
      const grade = still ? "" : await exposureFix(src, asset.durationSec, grades);
      if (plan.captions?.enabled && !still && spd === 1 && (await canDrawText())) {
        const pw = wordsForPiece(plan.captions.words, seg.assetId, seg.startSec, seg.endSec);
        if (pw.length) capVf = await captionFilter(pw, tmp, String(i), w, h, plan.captions.style);
      }
      try {
        await run(FFMPEG, segmentArgs(src, out, seg.startSec, dur, w, h, asset.hasAudio, seg.transition === "fade", seg.volume ?? 1, seg.effects, still, capVf, plan.look, spd, grade), LIMITS.renderTimeoutMs);
      } catch (err) {
        if (!capVf) throw err;
        // Captions are a bonus: if they cannot be drawn, the piece still renders without them.
        await run(FFMPEG, segmentArgs(src, out, seg.startSec, dur, w, h, asset.hasAudio, seg.transition === "fade", seg.volume ?? 1, seg.effects, still, "", plan.look, spd, grade), LIMITS.renderTimeoutMs);
      }
      partFiles.push(out);
    }

    const list = path.join(tmp, "list.txt");
    await fs.writeFile(list, partFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
    if (soundFile && plan.sound) {
      // Their own sound leads; the clips' own audio stays quietly underneath. The edit's length decides the end.
      const joined = path.join(tmp, "joined.mp4");
      await run(FFMPEG, ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined], LIMITS.renderTimeoutMs);
      const total = (Math.round(expected * 1000) / 1000).toFixed(3);
      const fadeAt = Math.max(0, expected - 0.6).toFixed(3);
      await run(
        FFMPEG,
        [
          "-y", "-hide_banner", "-i", joined, "-ss", String(plan.sound.startSec), "-i", soundFile,
          "-filter_complex",
          `[0:a]volume=${(plan.sound.clipVolume ?? 0.2).toFixed(2)}[a0];[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${plan.sound.volume.toFixed(2)},afade=t=out:st=${fadeAt}:d=0.6[a1];[a0][a1]amix=inputs=2:duration=longest:normalize=0,atrim=0:${total},loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
          "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", total, "-movflags", "+faststart", outputPath,
        ],
        LIMITS.renderTimeoutMs,
      );
    } else {
      await run(
        FFMPEG,
        // Even loudness across clips: video is copied, only the audio is levelled.
        ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-movflags", "+faststart", outputPath],
        LIMITS.renderTimeoutMs,
      );
    }

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

// ---- Word-by-word captions (burned in per piece, in the piece's own time).
const CAPTION_FONT = path.join(process.cwd(), "assets", "fonts", "Poppins-Bold.ttf");
let drawtextOk: boolean | undefined;
async function canDrawText(): Promise<boolean> {
  if (drawtextOk !== undefined) return drawtextOk;
  try {
    const { stdout } = await run(FFMPEG, ["-hide_banner", "-filters"], 20_000);
    drawtextOk = /\bdrawtext\b/.test(stdout) && (await fs.access(CAPTION_FONT).then(() => true, () => false));
  } catch {
    drawtextOk = false;
  }
  return drawtextOk;
}

export interface PieceWord { start: number; end: number; text: string }

// Words from the source clip that fall inside this piece, moved into the piece's own timeline.
export function wordsForPiece(words: { assetId: string; startSec: number; endSec: number; text: string }[], assetId: string, segStart: number, segEnd: number): PieceWord[] {
  const dur = segEnd - segStart;
  return words
    .filter((w) => w.assetId === assetId && w.endSec > segStart && w.startSec < segEnd)
    .map((w) => ({ start: Math.max(0, w.startSec - segStart), end: Math.min(dur, Math.max(w.endSec - segStart, w.startSec - segStart + 0.25)), text: w.text }))
    .filter((w) => w.end - w.start >= 0.12);
}

export async function captionFilter(words: PieceWord[], dir: string, tag: string, w: number, h: number, style: "pop" | "clean"): Promise<string> {
  let vf = "";
  for (let i = 0; i < words.length; i++) {
    const f = path.join(dir, `cap-${tag}-${i}.txt`);
    await fs.writeFile(f, style === "pop" ? words[i].text.toUpperCase() : words[i].text);
    const size = Math.round(w * (style === "pop" ? 0.085 : 0.06));
    vf += `,drawtext=fontfile='${CAPTION_FONT}':textfile='${f}':expansion=none:fontsize=${size}:fontcolor=white:borderw=${Math.max(3, Math.round(size / 11))}:bordercolor=black:x=(w-text_w)/2:y=h*0.70:enable='between(t,${words[i].start.toFixed(2)},${words[i].end.toFixed(2)})'`;
  }
  return vf;
}

// Colour looks, applied before effects. Each keeps the frame size and pixel format.
export function lookFilter(look: EditPlan["look"] = "none"): string {
  switch (look) {
    case "soft": return ",eq=brightness=0.03:saturation=1.08:contrast=0.97,colorbalance=rs=0.03:bs=-0.03";
    case "punchy": return ",eq=contrast=1.1:saturation=1.2";
    case "cinematic": return ",eq=contrast=1.07:saturation=0.92,colorbalance=rs=-0.02:bs=0.04,vignette=angle=PI/6,format=yuv420p";
    default: return "";
  }
}

// Motion effects. Each one acts on the start of a piece, where the beat lands.
// Filters are chained after the base crop; every one keeps the frame size and pixel format.
export function effectFilter(effect: EffectId, w: number, h: number): string {
  switch (effect) {
    case "punch": // quick push-in that settles
      return `,scale=w='iw*(1+0.07*max(0,1-t/0.3))':h=-2:eval=frame,crop=${w}:${h},setsar=1,format=yuv420p`;
    case "shake": // handheld jitter
      return `,scale=iw*1.04:ih*1.04,crop=${w}:${h}:'(in_w-out_w)/2+8*sin(t*47)':'(in_h-out_h)/2+8*cos(t*53)',setsar=1,format=yuv420p`;
    case "flash": // white flash that fades out
      return `,eq=brightness='0.5*max(0,1-t/0.15)':eval=frame`;
    case "glitch": // colour split in short bursts
      return `,rgbashift=rh=-10:bh=10:enable='lt(mod(t,0.4),0.1)'`;
    case "whip": // blur streak into the piece
      return `,boxblur=luma_radius=14:luma_power=1:enable='lt(t,0.2)'`;
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
  effects: EffectId[] = [],
  still = false,
  captionVf = "",
  look: EditPlan["look"] = "none",
  speed = 1,
  grade = "",
): string[] {
  // Speed: the source range is read as is; the piece plays shorter or longer.
  const outDur = dur / speed;
  let vf = `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1,fps=30,format=yuv420p`;
  // A photo gets a slow push-in so it feels alive instead of frozen.
  if (still) vf += `,scale=w='2*ceil(iw*(1+0.08*t/${dur.toFixed(3)})/2)':h=-2:eval=frame,crop=${w}:${h},setsar=1,format=yuv420p`;
  if (speed !== 1) vf = `setpts=PTS/${speed.toFixed(3)},` + vf;
  vf += grade;
  vf += lookFilter(look);
  for (const e of effects) vf += effectFilter(e, w, h);
  vf += captionVf;
  let af = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  if (speed !== 1) af += `,atempo=${speed.toFixed(3)}`;
  if (volume !== 1) af += `,volume=${Math.min(2, Math.max(0, volume)).toFixed(2)}`;
  if (fade) {
    const f = Math.min(0.2, outDur / 4).toFixed(3);
    const out_st = (outDur - Number(f)).toFixed(3);
    vf += `,fade=t=in:st=0:d=${f},fade=t=out:st=${out_st}:d=${f}`;
    af += `,afade=t=in:st=0:d=${f},afade=t=out:st=${out_st}:d=${f}`;
  }

  const args = still
    ? ["-y", "-hide_banner", "-loop", "1", "-framerate", "30", "-t", String(dur), "-i", src]
    : ["-y", "-hide_banner", "-ss", String(start), "-t", String(dur), "-i", src];
  if (hasAudio) {
    args.push("-map", "0:v:0", "-map", "0:a:0");
  } else {
    // Clips without sound get silence so every part has an identical audio track.
    args.push("-f", "lavfi", "-t", String(outDur), "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    args.push("-map", "0:v:0", "-map", "1:a:0");
  }
  args.push(
    "-vf", vf, "-af", af,
    // Low-memory encode: few threads, short look-ahead, so a small server is not killed for memory.
    "-threads", "2", "-filter_threads", "1",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
    "-x264-params", "rc-lookahead=10:sync-lookahead=0:threads=2",
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

// Even exposure across clips: measure one frame per source and nudge brightness toward a shared middle.
// Small, capped correction so a naturally dark or bright scene is never flattened.
async function exposureFix(src: string, durationSec: number, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(src);
  if (hit !== undefined) return hit;
  let filter = "";
  try {
    const { stderr, stdout } = await run(FFMPEG, ["-hide_banner", "-ss", String(Math.max(0, durationSec / 2)), "-i", src, "-frames:v", "1", "-vf", "signalstats,metadata=print", "-f", "null", "-"], 20_000);
    const m = /lavfi\.signalstats\.YAVG=([0-9.]+)/.exec(`${stdout}\n${stderr}`);
    if (m) {
      const delta = Math.max(-0.08, Math.min(0.08, ((118 - Number(m[1])) / 255) * 0.5));
      if (Math.abs(delta) > 0.015) filter = `,eq=brightness=${delta.toFixed(3)}`;
    }
  } catch {
    filter = "";
  }
  cache.set(src, filter);
  return filter;
}
