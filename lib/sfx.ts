import path from "node:path";
import { FFMPEG } from "./config";
import { run } from "./media";

// Sound effects made by FFmpeg itself (no files, no licences): a whoosh into a cut, an impact on a hit, a riser into the first big hit.
export type SfxKind = "whoosh" | "impact" | "riser";
export interface SfxEvent { kind: SfxKind; at: number; gain: number }

const LEN: Record<SfxKind, number> = { whoosh: 0.55, impact: 0.9, riser: 1.4 };
const GAIN: Record<SfxKind, number> = { whoosh: 0.5, impact: 0.75, riser: 0.35 };

interface SegLike { blend?: string; effects?: string[] }

// Where the effects land. starts are each piece's start in the finished video. Pure.
export function sfxEvents(segs: SegLike[], bases: number[]): SfxEvent[] {
  const raw: SfxEvent[] = [];
  let at = 0;
  let riser = false;
  segs.forEach((s, i) => {
    const fx = s.effects ?? [];
    if (i > 0 && (s.blend || fx.some((e) => ["whip", "spin", "zoomblur"].includes(e)))) raw.push({ kind: "whoosh", at: Math.max(0, at - 0.3), gain: GAIN.whoosh });
    if (fx.some((e) => ["flash", "shake", "punch", "glitch"].includes(e))) {
      raw.push({ kind: "impact", at, gain: GAIN.impact });
      if (!riser && at >= 1.6 && fx.includes("flash")) { raw.push({ kind: "riser", at: at - LEN.riser, gain: GAIN.riser }); riser = true; }
    }
    at += bases[i] ?? 0;
  });
  // Not too busy: at most one effect every 0.4s, and no more than 24 in a video.
  raw.sort((a, b) => a.at - b.at);
  const out: SfxEvent[] = [];
  for (const e of raw) {
    const last = out[out.length - 1];
    if (last && e.at - last.at < 0.4 && e.kind !== "riser") continue;
    if (out.length >= 24) break;
    out.push({ ...e, at: Math.round(e.at * 1000) / 1000 });
  }
  return out;
}

export async function makeSfxFiles(dir: string, kinds: SfxKind[]): Promise<Record<SfxKind, string>> {
  const files = {} as Record<SfxKind, string>;
  for (const k of new Set(kinds)) {
    const f = path.join(dir, `sfx-${k}.wav`);
    const common = ["-y", "-hide_banner"];
    const tail = ["-ar", "48000", "-ac", "2", f];
    if (k === "whoosh") {
      await run(FFMPEG, [...common, "-f", "lavfi", "-i", "anoisesrc=d=0.55:c=pink:r=48000:a=0.6", "-af", "highpass=f=400,lowpass=f=7000,afade=t=in:st=0:d=0.38,afade=t=out:st=0.38:d=0.17", ...tail], 30_000);
    } else if (k === "impact") {
      await run(FFMPEG, [...common, "-filter_complex", "aevalsrc='0.9*sin(2*PI*(55+110*exp(-9*t))*t)*exp(-4.5*t)':d=0.9:s=48000[b];anoisesrc=d=0.9:c=white:r=48000:a=0.5,lowpass=f=2500,afade=t=out:st=0:d=0.12[n];[b][n]amix=inputs=2:normalize=0", ...tail], 30_000);
    } else {
      await run(FFMPEG, [...common, "-f", "lavfi", "-i", "anoisesrc=d=1.4:c=pink:r=48000:a=0.5", "-af", "highpass=f=700,afade=t=in:st=0:d=1.4:curve=qua", ...tail], 30_000);
    }
    files[k] = f;
  }
  return files;
}

// Mixes the effects into the finished video's sound. The picture is copied untouched.
export function sfxMixArgs(video: string, events: SfxEvent[], files: Record<SfxKind, string>, out: string): string[] {
  const args = ["-y", "-hide_banner", "-i", video];
  for (const e of events) args.push("-i", files[e.kind]);
  const parts = events.map((e, i) => `[${i + 1}:a]adelay=${Math.round(e.at * 1000)}|${Math.round(e.at * 1000)},volume=${e.gain.toFixed(2)}[e${i}]`);
  const mix = `[0:a]${events.map((_, i) => `[e${i}]`).join("")}amix=inputs=${events.length + 1}:duration=first:normalize=0,alimiter=limit=0.95[a]`;
  args.push("-filter_complex", [...parts, mix].join(";"), "-map", "0:v:0", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
  return args;
}
