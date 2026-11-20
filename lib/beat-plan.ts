import type { BeatInfo } from "./beats";
import type { CutSegment, EditPlan, EffectId, MediaAsset } from "./types/schema";

const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Makes the edit move with the music: every piece starts on a beat and lasts a whole number of beats,
 * the edit starts where the music kicks in, and the big beats (every fourth piece) get a hit effect
 * when the AI has not already chosen one.
 */
export function snapPlanToBeats(plan: EditPlan, assets: Pick<MediaAsset, "id" | "durationSec">[], info: BeatInfo, soundKey: string, maxTotalSec: number): EditPlan {
  if (info.beats.length < 4 || info.bpm < 50) return plan;
  const period = 60 / info.bpm;
  const byId = new Map(assets.map((a) => [a.id, a]));
  const perPiece = plan.pacing === "fast" ? 1 : plan.pacing === "slow" ? 4 : 2; // beats per piece

  // Where the edit starts inside the sound: the drop, if the sound is long enough to hold the whole edit.
  const wanted = Math.min(maxTotalSec, plan.segments.reduce((t, s) => t + s.endSec - s.startSec, 0));
  const room = info.durationSec - wanted;
  const start = room <= 0 ? info.beats[0] : info.dropSec <= room ? info.dropSec : info.beats.filter((b) => b <= room).pop() ?? info.beats[0];

  const out: CutSegment[] = [];
  let used = 0;
  for (const s of plan.segments) {
    const a = byId.get(s.assetId);
    if (!a) continue;
    const have = Math.min(s.endSec, a.durationSec) - s.startSec;
    let beats = Math.max(1, Math.floor(have / period + 0.05));
    beats = Math.min(beats, Math.max(perPiece, Math.round(beats / perPiece) * perPiece)); // tidy lengths, never longer than the footage
    if (beats > perPiece * 2) beats = perPiece * 2; // a long piece reads as slow; cap it
    let len = beats * period;
    if (len < 0.5) len = Math.min(have, Math.ceil(0.5 / period) * period);
    if (used + len > maxTotalSec + 0.01 || start + used + len > info.durationSec + 0.01) break;
    if (len > have + 0.01) continue;
    out.push({ ...s, endSec: round(s.startSec + len) });
    used += len;
  }
  if (out.length === 0) return plan;

  const hits: EffectId[] = ["punch", "flash", "shake"];
  const withFx = out.map((s, i) => (!s.effects?.length && (i === 0 || i % 4 === 0) ? { ...s, effects: [hits[(i / 4) % hits.length | 0]] as EffectId[] } : s));
  return {
    ...plan,
    segments: withFx,
    targetDurationSec: round(used),
    sound: { key: soundKey, startSec: round(start), volume: 1, bpm: info.bpm },
    summary: `${plan.summary} Cut to the beat of your sound (${Math.round(info.bpm)} BPM).`.slice(0, 600),
  };
}
