import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { makeSfxFiles, sfxEvents, sfxMixArgs } from "./sfx";
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

// Photos never sit still: each one gets a different camera move so a run of photos does not feel repeated.
const PHOTO_MOVES: EffectId[] = ["drift", "panleft", "driftout", "rise", "panright"];

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
    const plannedTotal = plan.segments.reduce((t, x) => {
      const a = byId.get(x.assetId);
      return t + (x.endSec - x.startSec) / (x.speed && x.speed !== 1 ? x.speed : 1) + (x.freeze && a && !isImageName(a.originalName) ? x.freeze : 0);
    }, 0);
    let expected = 0;
    const blending = plan.segments.some((x) => x.blend) && plan.segments.length >= 2 && plan.segments.length <= 60 && (await canXfade());
    const bases: number[] = [];

    for (let i = 0; i < plan.segments.length; i++) {
      const seg = plan.segments[i];
      const asset = byId.get(seg.assetId);
      if (!asset) throw new Error("Plan references an unknown clip");
      const dur = Math.round((seg.endSec - seg.startSec) * 1000) / 1000;
      if (dur <= 0 || seg.endSec > asset.durationSec + 0.05) throw new Error("Plan contains an invalid time range");
      const spd = seg.speed && seg.speed !== 1 ? seg.speed : 1;
      const hold = seg.freeze && !isImageName(asset.originalName) ? seg.freeze : 0;
      const rev = seg.reverse === true && dur <= 4 && !isImageName(asset.originalName);
      expected += dur / spd + hold;
      // A blend into the NEXT piece overlaps the end of this one, so this piece is held a little longer to cover it.
      const next = plan.segments[i + 1];
      const tail = blending && next?.blend ? blendLength(next) : 0;

      const out = path.join(tmp, `part-${String(i).padStart(3, "0")}.mp4`);
      const src = path.join(UPLOAD_DIR, asset.storedName);
      const still = isImageName(asset.originalName);
      let capVf = "";
      const grade = await exposureFix(src, still ? 0 : asset.durationSec / 2, grades);
      if (plan.captions?.enabled && !still && spd === 1 && (await canDrawText())) {
        const pw = wordsForPiece(plan.captions.words, seg.assetId, seg.startSec, seg.endSec);
        if (pw.length) capVf = await captionFilter(pw, tmp, String(i), w, h, plan.captions.style);
      }
      // On-screen text: a hook over the first ~2.6s and a closing line over the last ~1.8s, even when those span several short
      // pieces. Both are a bonus and never block the render.
      const played = dur / spd + hold;
      const pieceStart = bases.reduce((t, b) => t + b, 0);
      if ((plan.title?.hook || plan.title?.endCard) && (await canDrawText())) {
        if (plan.title?.hook) {
          const hs = 0.3, he = 2.6;
          const ls = Math.max(0, hs - pieceStart), le = Math.min(played - 0.02, he - pieceStart);
          if (pieceStart < he - 0.3 && le - ls >= 0.3) capVf += await titleFilter(plan.title.hook, tmp, `h${i}`, w, h, ls, le, "top", pieceStart <= hs + 0.25, he - pieceStart <= played);
        }
        if (plan.title?.endCard) {
          const es = Math.max(0, plannedTotal - 1.8), ee = plannedTotal - 0.05;
          const ls = Math.max(0, es - pieceStart), le = Math.min(played - 0.02, ee - pieceStart);
          if (pieceStart + played > es + 0.3 && le - ls >= 0.3) {
            // The picture sinks into the dark under the closing line, which glows gold.
            capVf += `,eq=brightness='-0.4*min(1,max(0,(t-${ls.toFixed(2)})/0.7))':eval=frame`;
            capVf += await titleFilter(plan.title.endCard, tmp, `e${i}`, w, h, ls, le, "middle", pieceStart <= es + 0.25, ee - pieceStart <= played + 0.05, true);
          }
        }
      }
      // Photos never sit frozen: unless a motion effect was chosen, they get a slow push-in or pull-out, alternating.
      const fx = still && !(seg.effects ?? []).some((e) => ["punch", "pulse", "shake", "zoomblur", "spin", "drophit", "panleft", "panright", "rise"].includes(e)) ? [...(seg.effects ?? []), PHOTO_MOVES[i % PHOTO_MOVES.length]] : seg.effects;
      try {
        await run(FFMPEG, segmentArgs(src, out, seg.startSec, dur, w, h, asset.hasAudio, seg.transition === "fade", seg.volume ?? 1, fx, still, capVf, plan.look, spd, grade, hold + tail, rev, plan.polish, seg.ramp, plan.sound?.bpm, { x: seg.focusX, y: seg.focusY }, seg.zoom), LIMITS.renderTimeoutMs);
      } catch (err) {
        if (!capVf) throw err;
        // Captions are a bonus: if they cannot be drawn, the piece still renders without them.
        await run(FFMPEG, segmentArgs(src, out, seg.startSec, dur, w, h, asset.hasAudio, seg.transition === "fade", seg.volume ?? 1, fx, still, "", plan.look, spd, grade, hold + tail, rev, plan.polish, seg.ramp, plan.sound?.bpm, { x: seg.focusX, y: seg.focusY }, seg.zoom), LIMITS.renderTimeoutMs);
      }
      partFiles.push(out);
      bases.push(dur / spd + hold);
    }

    // Smooth blends: only the runs of pieces that are linked by a blend are merged (small, cheap passes);
    // everything else is joined without re-encoding. If a blend pass fails, those pieces are simply cut together instead.
    const entries: string[] = [];
    const q = (f: string) => f.replace(/'/g, "'\\''");
    for (let i = 0; i < partFiles.length; ) {
      let j = i;
      while (blending && j + 1 < partFiles.length && plan.segments[j + 1].blend) j++;
      if (j === i) {
        entries.push(`file '${q(partFiles[i])}'`);
        i++;
        continue;
      }
      const grp = path.join(tmp, `group-${i}.mp4`);
      try {
        await run(FFMPEG, blendJoinArgs(partFiles.slice(i, j + 1), plan.segments.slice(i, j + 1), bases.slice(i, j + 1), grp), LIMITS.renderTimeoutMs);
        entries.push(`file '${q(grp)}'`);
      } catch {
        for (let k = i; k <= j; k++) entries.push(`file '${q(partFiles[k])}'\noutpoint ${bases[k].toFixed(3)}`);
      }
      i = j + 1;
    }
    const list = path.join(tmp, "list.txt");
    await fs.writeFile(list, entries.join("\n"));
    if (soundFile && plan.sound) {
      // Their own sound leads; the clips' own audio stays quietly underneath. The edit's length decides the end.
      const joined = path.join(tmp, "joined.mp4");
      await run(FFMPEG, ["-y", "-hide_banner", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined], LIMITS.renderTimeoutMs);
      const total = (Math.round(expected * 1000) / 1000).toFixed(3);
      const fadeAt = Math.max(0, expected - 0.6).toFixed(3);
      // The music dips under the clips' own sound only when that sound is actually kept in the mix.
      const cv = plan.sound.clipVolume ?? 0.2;
      const duck = cv >= 0.1;
      await run(
        FFMPEG,
        [
          "-y", "-hide_banner", "-i", joined, "-ss", String(plan.sound.startSec), "-i", soundFile,
          "-filter_complex",
          duck
            ? `[0:a]asplit=2[s1][s2];[s1]volume=${cv.toFixed(2)}[a0];[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${plan.sound.volume.toFixed(2)},afade=t=out:st=${fadeAt}:d=0.6[m];[m][s2]sidechaincompress=threshold=0.12:ratio=2.5:attack=30:release=500:makeup=1[a1];[a0][a1]amix=inputs=2:duration=longest:normalize=0,atrim=0:${total},loudnorm=I=-16:TP=-1.5:LRA=11[a]`
            : `[0:a]volume=${cv.toFixed(2)}[a0];[1:a]aresample=48000,aformat=channel_layouts=stereo,volume=${plan.sound.volume.toFixed(2)},afade=t=out:st=${fadeAt}:d=0.6[a1];[a0][a1]amix=inputs=2:duration=longest:normalize=0,atrim=0:${total},loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
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

    // Sound effects (whooshes, impacts, a riser) go on last. A failure here must never cost the person their video.
    if (plan.polish?.sfx) {
      try {
        const events = sfxEvents(plan.segments, bases);
        if (events.length) {
          const files = await makeSfxFiles(tmp, events.map((e) => e.kind));
          const mixed = path.join(tmp, "with-sfx.mp4");
          await run(FFMPEG, sfxMixArgs(outputPath, events, files, mixed), LIMITS.renderTimeoutMs);
          await fs.copyFile(mixed, outputPath);
        }
      } catch {
        /* keep the video as it was */
      }
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
export async function canDrawText(): Promise<boolean> {
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

// A title card text: fades in and out, large and centred, with a soft outline so it reads on any footage.
export async function titleFilter(text: string, dir: string, tag: string, w: number, h: number, start: number, end: number, where: "top" | "middle", fadeIn = true, fadeOut = true, gold = false): Promise<string> {
  const f = path.join(dir, `title-${tag}.txt`);
  await fs.writeFile(f, text.toUpperCase());
  const size = Math.round(Math.min(w * 0.11, (w * 0.9) / Math.max(6, text.length * 0.6)));
  const y = where === "top" ? "h*0.16" : "(h-text_h)/2";
  const a = `if(${fadeIn ? 1 : 0}*lt(t,${(start + 0.25).toFixed(2)}),(t-${start.toFixed(2)})/0.25,if(${fadeOut ? 1 : 0}*gt(t,${(end - 0.25).toFixed(2)}),(${end.toFixed(2)}-t)/0.25,1))`;
  return `,drawtext=fontfile='${CAPTION_FONT}':textfile='${f}':expansion=none:fontsize=${size}:fontcolor=${gold ? "0xecd083" : "white"}:borderw=${Math.max(3, Math.round(size / 12))}:bordercolor=black@0.85${gold ? ":shadowcolor=0xd9b45b@0.55:shadowx=0:shadowy=0" : ""}:x=(w-text_w)/2:y=${y}:alpha='${a}':enable='between(t,${start.toFixed(2)},${end.toFixed(2)})'`;
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
    case "tealorange": return ",colorbalance=rs=-0.08:bs=0.08:gs=0.02:rh=0.10:bh=-0.10,eq=contrast=1.08:saturation=1.1,format=yuv420p";
    case "warm": return ",colorbalance=rm=0.06:bm=-0.06:rh=0.05:bh=-0.05,eq=saturation=1.08:brightness=0.02,format=yuv420p";
    case "cold": return ",colorbalance=rm=-0.05:bm=0.07,eq=saturation=0.95:contrast=1.06,format=yuv420p";
    case "noir": return ",hue=s=0,eq=contrast=1.25:brightness=-0.03,vignette=angle=PI/5,format=yuv420p";
    case "vibrant": return ",eq=saturation=1.35:contrast=1.08,format=yuv420p";
    case "faded": return ",curves=m='0/0.06 1/0.94',eq=saturation=0.85,format=yuv420p";
    default: return "";
  }
}

// Motion effects. Each one acts on the start of a piece, where the beat lands.
// Filters are chained after the base crop; every one keeps the frame size and pixel format.
export function effectFilter(effect: EffectId, w: number, h: number, bpm?: number): string {
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
    case "spin": // the shot swings in from a tilt and settles (oversized first so no corners show)
      return `,scale=iw*1.7:ih*1.7,rotate=a='0.5*pow(max(0,1-t/0.4),2)':ow=iw:oh=ih:fillcolor=black,crop=${w}:${h},setsar=1,format=yuv420p`;
    case "zoomblur": // fast zoom-out with a short blur, like a lens pull
      return `,scale=w='iw*(1+0.4*pow(max(0,1-t/0.35),2))':h=-2:eval=frame,crop=${w}:${h},boxblur=luma_radius=9:luma_power=1:enable='lt(t,0.2)',setsar=1,format=yuv420p`;
    case "pulse": { // the picture breathes in time with the music: a small push on every beat
      const period = bpm && bpm >= 50 ? 60 / bpm : 0.5;
      return `,scale=w='iw*(1+0.045*pow(max(0,1-mod(t,${period.toFixed(4)})/0.18),2))':h=-2:eval=frame,crop=${w}:${h},setsar=1,format=yuv420p`;
    }
    case "grain": // film grain across the whole piece
      return `,noise=alls=14:allf=t+u`;
    case "glow": // soft bloom on the highlights
      return `,split[gl_a][gl_b];[gl_b]gblur=sigma=16,eq=brightness=0.04[gl_g];[gl_a][gl_g]blend=all_mode=screen:all_opacity=0.35,format=yuv420p`;
    case "leak": // a warm light flare that fades over the start of the piece
      return `,eq=brightness='0.16*max(0,1-t/0.5)':saturation='1+0.4*max(0,1-t/0.5)':eval=frame,colorbalance=rs=0.12:rm=0.10:gm=0.03:enable='lt(t,0.5)'`;
    case "drift": // slow push-in so a photo is never frozen
      return `,scale=w='iw*(1+0.06*min(t,3))':h=-2:eval=frame,crop=${w}:${h},setsar=1,format=yuv420p`;
    case "driftout": // slow pull-out
      return `,scale=w='iw*(1+0.06*max(0,3-t))':h=-2:eval=frame,crop=${w}:${h},setsar=1,format=yuv420p`;
    case "panleft": // slow camera pan across an enlarged still
      return `,scale=w='trunc(iw*1.22/2)*2':h='trunc(ih*1.22/2)*2',crop=${w}:${h}:'(in_w-out_w)*(1-min(t,3)/3)':'(in_h-out_h)/2',setsar=1,format=yuv420p`;
    case "panright":
      return `,scale=w='trunc(iw*1.22/2)*2':h='trunc(ih*1.22/2)*2',crop=${w}:${h}:'(in_w-out_w)*min(t,3)/3':'(in_h-out_h)/2',setsar=1,format=yuv420p`;
    case "rise": // slow tilt up, like a camera lifting over the subject
      return `,scale=w='trunc(iw*1.22/2)*2':h='trunc(ih*1.22/2)*2',crop=${w}:${h}:'(in_w-out_w)/2':'(in_h-out_h)*(1-min(t,3)/3)',setsar=1,format=yuv420p`;
    case "drophit": // the big hit on the drop: punch-in, a few frames of shake and a white flash, all at once, then it settles
      return `,scale=w='iw*(1+0.1*max(0,1-t/0.35))':h=-2:eval=frame,crop=${w}:${h}:'(in_w-out_w)/2+16*sin(t*61)*max(0,1-t/0.5)':'(in_h-out_h)/2+16*cos(t*73)*max(0,1-t/0.5)',setsar=1,format=yuv420p,eq=brightness='0.45*max(0,1-t/0.18)':eval=frame`;
    case "steady": // calms handheld shake
      return `,deshake=rx=16:ry=16:edge=mirror`;
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
  hold = 0,
  reverse = false,
  polish?: EditPlan["polish"],
  ramp?: "up" | "down",
  bpm?: number,
  focus?: { x?: number; y?: number },
  zoomIn?: number,
): string[] {
  // Speed: the source range is read as is; the piece plays shorter or longer.
  const outDur = dur / speed + hold;
  // The crop follows the subject (focus) instead of always taking the centre, so faces and the main subject stay in view.
  const fx0 = Math.min(1, Math.max(0, focus?.x ?? 0.5));
  const fy0 = Math.min(1, Math.max(0, focus?.y ?? 0.5));
  const zoom = Math.min(3, Math.max(1, zoomIn ?? 1));
  const sw = Math.round((w * zoom) / 2) * 2;
  const sh = Math.round((h * zoom) / 2) * 2;
  const cropAt = fx0 === 0.5 && fy0 === 0.5 && zoom === 1 ? `crop=${w}:${h}` : `crop=${w}:${h}:'(iw-ow)*${fx0.toFixed(3)}':'(ih-oh)*${fy0.toFixed(3)}'`;
  let vf = `scale=${sw}:${sh}:force_original_aspect_ratio=increase,${cropAt},setsar=1,fps=30,format=yuv420p`;
  // A photo gets a slow push-in so it feels alive instead of frozen.
  if (still) vf += `,scale=w='2*ceil(iw*(1+0.08*t/${dur.toFixed(3)})/2)':h=-2:eval=frame,crop=${w}:${h},setsar=1,format=yuv420p`;
  if (ramp && speed === 1 && !still) {
    // Smooth speed ramp: the playback speed changes steadily across the piece (0.5x <-> 1.76x), and the piece keeps its length.
    const a = ramp === "up" ? 0.5 : 1.76;
    const b = ramp === "up" ? 1.76 : 0.5;
    const D = Math.max(0.2, dur);
    vf = `setpts='(${(D / (b - a)).toFixed(5)})*log((${a}+${((b - a) / D).toFixed(5)}*PTS*TB)/${a})/TB',` + vf.replace('fps=30', 'minterpolate=fps=30:mi_mode=blend');
  } else if (speed !== 1) {
    vf = `setpts=PTS/${speed.toFixed(3)},` + (speed < 0.85 ? vf.replace('fps=30', 'minterpolate=fps=30:mi_mode=blend') : vf);
  }
  if (reverse) vf = `reverse,` + vf;
  if (polish?.sharpen) vf += ",unsharp=5:5:0.5:5:5:0.0";
  vf += grade;
  vf += lookFilter(look);
  for (const e of effects) vf += effectFilter(e, w, h, bpm);
  vf += captionVf;
  let af = "aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo";
  if (reverse) af = `areverse,` + af;
  if (polish?.audio) af += ",afftdn=nr=12:nf=-40";
  if (speed !== 1) af += `,atempo=${speed.toFixed(3)}`;
  if (hold > 0) {
    vf += `,tpad=stop_mode=clone:stop_duration=${hold.toFixed(3)}`;
    af += `,apad=pad_dur=${hold.toFixed(3)}`;
  }
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
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-maxrate", "3500k", "-bufsize", "7000k",
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

// Pure: how much to correct a shot whose average brightness (0-255) is y. Dark shots get a real lift (gamma opens the shadows
// without blowing out the highlights); bright ones a small pull-down. Capped, so a naturally moody scene is never flattened.
export function exposureFilter(y: number): string {
  if (!Number.isFinite(y)) return "";
  if (y < 95) {
    const gamma = Math.min(1.5, 1 + ((110 - y) / 110) * 0.8);
    const lift = Math.min(0.05, ((110 - y) / 255) * 0.2);
    return `,eq=gamma=${gamma.toFixed(3)}:brightness=${lift.toFixed(3)}:saturation=1.08`;
  }
  const delta = Math.max(-0.08, Math.min(0.08, ((118 - y) / 255) * 0.5));
  return Math.abs(delta) > 0.015 ? `,eq=brightness=${delta.toFixed(3)}` : "";
}

// Even exposure across clips: measure one frame per source and nudge brightness toward a shared middle.
// Small, capped correction so a naturally dark or bright scene is never flattened.
export async function exposureFix(src: string, atSec: number, cache: Map<string, string>): Promise<string> {
  const hit = cache.get(src);
  if (hit !== undefined) return hit;
  let filter = "";
  try {
    const { stderr, stdout } = await run(FFMPEG, ["-hide_banner", "-ss", String(Math.max(0, atSec)), "-i", src, "-frames:v", "1", "-vf", "signalstats,metadata=print", "-f", "null", "-"], 20_000);
    const m = /lavfi\.signalstats\.YAVG=([0-9.]+)/.exec(`${stdout}\n${stderr}`);
    if (m) filter = exposureFilter(Number(m[1]));
  } catch {
    filter = "";
  }
  cache.set(src, filter);
  return filter;
}

// ---- Smooth blends between pieces ----
const XFADE: Record<string, string> = { dissolve: "fade", slide: "slideleft", zoom: "zoomin", wipe: "wipeleft", circle: "circleopen", fadeblack: "fadeblack" };
const BLEND_SEC = 0.3; // a visible blend

export function blendLength(seg: { blend?: string }): number {
  return seg.blend && XFADE[seg.blend] ? BLEND_SEC : 0;
}

let xfadeOk: boolean | undefined;
export async function canXfade(): Promise<boolean> {
  if (xfadeOk !== undefined) return xfadeOk;
  try {
    const { stdout } = await run(FFMPEG, ["-hide_banner", "-filters"], 20_000);
    xfadeOk = /\bxfade\b/.test(stdout) && /\bacrossfade\b/.test(stdout);
  } catch {
    xfadeOk = false;
  }
  return xfadeOk;
}

// bases[i] is piece i's own length (without its overlap tail). Piece i starts at the sum of the bases before it,
// so beats and captions keep their exact timing; the tails are what the blends overlap.
export function blendJoinArgs(parts: string[], segs: { blend?: string }[], bases: number[], out: string): string[] {
  const args = ["-y", "-hide_banner"];
  for (const p of parts) args.push("-i", p);
  const v: string[] = [];
  const a: string[] = [];
  let start = 0;
  for (let i = 1; i < parts.length; i++) {
    start += bases[i - 1];
    const d = blendLength(segs[i]);
    const name = XFADE[segs[i].blend as string] ?? "fade";
    const vin = i === 1 ? "[0:v]" : `[v${i - 1}]`;
    const ain = i === 1 ? "[0:a]" : `[a${i - 1}]`;
    v.push(`${vin}[${i}:v]xfade=transition=${name}:duration=${d}:offset=${start.toFixed(3)}[v${i}]`);
    a.push(`${ain}[${i}:a]acrossfade=d=${d}:c1=tri:c2=tri[a${i}]`);
  }
  const last = parts.length - 1;
  args.push("-filter_complex", [...v, ...a].join(";"), "-map", `[v${last}]`, "-map", `[a${last}]`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-maxrate", "3500k", "-bufsize", "7000k", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", out);
  return args;
}
