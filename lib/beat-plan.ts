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

  // A piece lasts a whole, even number of beats, about 1.5s (fast), 3s (medium) or 5s (slow).
  const aim = plan.pacing === "fast" ? 1.5 : plan.pacing === "slow" ? 5 : 3;
  const pieceBeats = Math.max(2, Math.round(aim / period / 2) * 2);
  const pieceLen = pieceBeats * period;

  // How long the edit should be: a fair share of the footage (at least 15s), within the platform cap and the sound.
  const footage = assets.reduce((t, a) => t + a.durationSec, 0);
  const goal = Math.min(maxTotalSec, info.durationSec - info.beats[0], Math.max(Math.min(15, footage), footage * 0.6, plan.targetDurationSec));

  // Start where the music kicks in, as long as the sound still has room for the whole edit.
  const room = info.durationSec - goal;
  const start = room <= 0 ? info.beats[0] : info.dropSec <= room ? info.dropSec : info.beats.filter((b) => b <= room).pop() ?? info.beats[0];

  const out: CutSegment[] = [];
  const cursor = plan.segments.map((s) => s.startSec); // where the next piece of each moment begins
  let used = 0;
  for (let round_ = 0; round_ < 6 && used < goal - 0.3; round_++) {
    let added = false;
    plan.segments.forEach((s, k) => {
      const a = byId.get(s.assetId);
      if (!a || used >= goal - 0.3) return;
      const from = round_ === 0 ? s.startSec : cursor[k];
      const have = a.durationSec - from;
      let beats = Math.min(pieceBeats, Math.floor(have / period + 0.05));
      if (beats < 1) return;
      if (beats > 1 && beats % 2 === 1) beats -= 1;
      let len = beats * period;
      if (len < 0.5) return;
      if (used + len > goal + 0.01) {
        beats = Math.floor((goal - used) / period + 0.05);
        len = beats * period;
        if (beats < 1 || len < 0.5) return;
      }
      out.push({ ...s, startSec: round(from), endSec: round(from + len), effects: round_ === 0 ? s.effects : undefined, transition: "cut" });
      cursor[k] = from + len;
      used += len;
      added = true;
    });
    if (!added) break;
  }
  if (out.length === 0) return plan;

  // Big beats (every fourth piece) get a hit effect when the AI has not already chosen one.
  const hits: EffectId[] = ["punch", "flash", "shake"];
  const withFx = out.map((s, i) => (!s.effects?.length && i % 4 === 0 ? { ...s, effects: [hits[(i / 4) % hits.length | 0]] as EffectId[] } : s));
  return {
    ...plan,
    segments: withFx,
    targetDurationSec: round(used),
    sound: { key: soundKey, startSec: round(start), volume: 1, bpm: info.bpm },
    summary: `${plan.summary.replace(/\s*Cut to the beat[^.]*\./, "")} Cut to the beat of your sound (${Math.round(info.bpm)} BPM).`.trim().slice(0, 600),
  };
}
