import { spawn } from "node:child_process";
import { FFMPEG } from "./config";

export interface BeatInfo {
  bpm: number;
  /** Beat times in seconds from the start of the sound. */
  beats: number[];
  durationSec: number;
  /** Where the music really kicks in (a beat time), good as the start of the edit. */
  dropSec: number;
}

const SR = 11025;
const HOP = 256; // ~23 ms per analysis step

/** Beat tracking on raw mono samples: onset strength, tempo by autocorrelation, then the best beat grid. */
export function analyzeBeats(samples: Float32Array, sampleRate = SR): BeatInfo {
  const durationSec = samples.length / sampleRate;
  const step = HOP / sampleRate;
  const frames = Math.floor(samples.length / HOP);
  if (frames < 64) return { bpm: 0, beats: [], durationSec, dropSec: 0 };

  // Energy of the sharp, high part of the signal: drums and hits show up here.
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let e = 0;
    const base = f * HOP;
    for (let i = 1; i < HOP; i++) {
      const d = samples[base + i] - samples[base + i - 1];
      e += d * d;
    }
    energy[f] = Math.sqrt(e / HOP);
  }

  // Onset strength: how much louder than the recent past.
  const onset = new Float32Array(frames);
  for (let f = 1; f < frames; f++) {
    let avg = 0;
    const from = Math.max(0, f - 12);
    for (let k = from; k < f; k++) avg += energy[k];
    avg /= Math.max(1, f - from);
    onset[f] = Math.max(0, energy[f] - avg);
  }

  // Tempo: strongest repeat distance between 70 and 180 BPM.
  const minLag = Math.round(60 / 180 / step);
  const maxLag = Math.round(60 / 70 / step);
  let bestLag = minLag;
  let bestScore = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let score = 0;
    for (let f = lag; f < frames; f++) score += onset[f] * onset[f - lag];
    score /= frames - lag;
    // Gentle preference for common dance tempos so half/double-time does not win by accident.
    const bpm = 60 / (lag * step);
    const pref = bpm >= 85 && bpm <= 160 ? 1.1 : 1;
    if (score * pref > bestScore) {
      bestScore = score * pref;
      bestLag = lag;
    }
  }
  // Refine: the best whole-frame lag drifts over a long track, so search fractional periods
  // and phases for the grid that lands on the most onset energy.
  let bestP = bestLag;
  let bestPh = 0;
  let bestGrid = -1;
  for (let p = bestLag - 1; p <= bestLag + 1; p += 0.05) {
    for (let ph = 0; ph < p; ph += 0.5) {
      let sc = 0;
      for (let pos = ph; pos < frames - 1; pos += p) {
        const i = Math.round(pos);
        sc += onset[i] + 0.5 * (onset[i - 1] ?? 0) + 0.5 * (onset[i + 1] ?? 0);
      }
      if (sc > bestGrid) {
        bestGrid = sc;
        bestP = p;
        bestPh = ph;
      }
    }
  }
  const period = bestP * step;
  const bpm = 60 / period;
  const beats: number[] = [];
  for (let t = bestPh * step; t < durationSec - 0.05; t += period) beats.push(Math.round(t * 1000) / 1000);

  // Drop: the beat where the next ~8 seconds are the most energetic compared to the track.
  const win = Math.max(1, Math.round(8 / step));
  const prefix = new Float64Array(frames + 1);
  for (let f = 0; f < frames; f++) prefix[f + 1] = prefix[f] + energy[f];
  let dropSec = beats[0] ?? 0;
  let bestWin = -1;
  for (const b of beats) {
    const f = Math.round(b / step);
    if (f + win > frames) break;
    const w = prefix[f + win] - prefix[f];
    if (w > bestWin * 1.02) {
      bestWin = w;
      dropSec = b;
    }
  }
  return { bpm: Math.round(bpm * 10) / 10, beats, durationSec: Math.round(durationSec * 100) / 100, dropSec };
}

/** Decodes a sound (or the sound of a video) to mono samples and analyses it. */
export async function analyzeSoundFile(file: string, maxSec = 300): Promise<BeatInfo> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const child = spawn(FFMPEG, ["-v", "error", "-i", file, "-t", String(maxSec), "-vn", "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Reading the sound took too long"));
    }, 60_000);
    child.stdout.on("data", (d: Buffer) => chunks.push(d));
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve() : reject(new Error("That sound could not be read"));
    });
  });
  const buf = Buffer.concat(chunks);
  const samples = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
  if (samples.length < SR) throw new Error("That sound is too short");
  return analyzeBeats(samples, SR);
}
