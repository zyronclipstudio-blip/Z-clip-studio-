import type { CutSegment, EditPlan } from "./types/schema";

// The self-check. Deterministic, no AI call, no cost. It reads the finished PLAN the way an editor
// would and repairs only what is clearly wrong, then reports what it changed in plain words.
export interface CritiqueResult {
  plan: EditPlan;
  fixes: string[];
}

type Seg = CutSegment & { effects: NonNullable<CutSegment["effects"]> };
const MOTION = (e: string) => !["grain", "glow", "leak", "steady"].includes(e); // overlays are a finish and follow their own rules
const MAX_EFFECT_SHARE = 0.4; // at most this share of the pieces may carry an effect

export function critiquePlan(input: EditPlan): CritiqueResult {
  const fixes: string[] = [];
  const segs: Seg[] = input.segments.map((s) => ({ ...s, effects: [...(s.effects ?? [])] }));

  // 0. Showing the same footage twice looks like a glitch. Drop later pieces that overlap an earlier one by over half.
  if (segs.length > 3) {
    const kept: Seg[] = [];
    for (const s of segs) {
      const len = s.endSec - s.startSec;
      const dup = kept.some((k) => k.assetId === s.assetId && Math.min(k.endSec, s.endSec) - Math.max(k.startSec, s.startSec) > len * 0.5);
      if (!dup) kept.push(s);
    }
    const dropped = segs.length - kept.length;
    if (dropped > 0 && kept.length >= 3) {
      segs.splice(0, segs.length, ...kept);
      fixes.push(`Removed ${dropped} repeated shot${dropped > 1 ? "s" : ""} so nothing plays twice.`);
    }
  }

  // 0b. Rare tools stay rare: at most 2 freezes, 1 reverse, 2 speed changes; none on the opening piece.
  {
    let fz = 0, rv = 0, sp = 0, removed = 0;
    segs.forEach((s, i) => {
      if (s.freeze && (i === 0 || ++fz > 2)) { delete s.freeze; removed++; }
      if (s.reverse && (i === 0 || ++rv > 1)) { delete s.reverse; removed++; }
      if (s.speed && ++sp > 2) { delete s.speed; removed++; }
    });
    if (removed) fixes.push("Kept freeze, reverse and speed changes rare.");
  }

  // 0b2. Open strong: a clearly stronger moment moves to the front (not for speech, whose captions follow the order).
  if (!input.captions?.enabled && segs.length >= 4) {
    let best = 0;
    segs.forEach((s, i) => { if (s.confidence > segs[best].confidence) best = i; });
    if (best > 0 && segs[best].confidence - segs[0].confidence >= 0.15) {
      const [hero] = segs.splice(best, 1);
      segs.unshift(hero);
      fixes.push("Opened on the strongest shot.");
    }
  }

  // 0b3. Flow: never three of the same kind of shot in a row (swap the third with the next different one).
  if (!input.captions?.enabled) {
    let swapped = 0;
    for (let i = 2; i < segs.length; i++) {
      const k = segs[i].shot;
      if (!k || segs[i - 1].shot !== k || segs[i - 2].shot !== k) continue;
      const j = segs.findIndex((x, n) => n > i && x.shot && x.shot !== k);
      if (j < 0) continue;
      [segs[i], segs[j]] = [segs[j], segs[i]];
      swapped++;
    }
    if (swapped) fixes.push("Mixed up the shot types so the edit flows.");
  }

  // 0b4. Speed ramps stay rare (2 at most), never on the opening piece or together with a speed change; pulse needs the person's music.
  {
    let ramps = 0, dropped = 0;
    segs.forEach((s, i) => {
      if (s.ramp && (i === 0 || s.speed || s.freeze || s.reverse || ++ramps > 2)) { delete s.ramp; dropped++; }
      if (!input.sound?.bpm && s.effects.includes("pulse")) { s.effects = s.effects.filter((e) => e !== "pulse"); dropped++; }
    });
    if (dropped) fixes.push("Kept speed ramps rare and beat pulses only where there is music.");
  }

  // 0c. Smooth blends: never the same one twice in a row, none on the opening piece, at most about half of the boundaries.
  {
    let changed = 0, used = 0;
    segs.forEach((s, i) => {
      if (!s.blend) return;
      const bad = i === 0 || segs[i - 1].blend === s.blend || ++used > Math.max(1, Math.ceil(segs.length / 2));
      if (bad) { delete s.blend; changed++; }
    });
    if (changed) fixes.push("Kept the smooth blends varied and not too frequent.");
  }

  // 1. The same effect on two neighbouring pieces looks like a mistake.
  let repeats = 0;
  for (let i = 1; i < segs.length; i++) {
    const before = new Set(segs[i - 1].effects.filter(MOTION));
    const kept = segs[i].effects.filter((e) => !before.has(e) || !MOTION(e));
    if (kept.length !== segs[i].effects.length) {
      repeats++;
      segs[i].effects = kept;
    }
  }
  if (repeats) fixes.push(`Removed ${repeats} repeated effect${repeats > 1 ? "s" : ""} on neighbouring cuts.`);

  // 2. Too many effects makes an edit look busy. Keep the ones on the most confident pieces.
  const limit = Math.max(1, Math.floor(segs.length * MAX_EFFECT_SHARE));
  const withFx = segs.map((s, i) => ({ s, i })).filter((x) => x.s.effects.some(MOTION));
  if (withFx.length > limit) {
    const drop = withFx
      .filter((x) => x.i !== 0) // the hook keeps its effect
      .sort((a, b) => a.s.confidence - b.s.confidence)
      .slice(0, withFx.length - limit);
    for (const d of drop) segs[d.i].effects = segs[d.i].effects.filter((e) => !MOTION(e));
    if (drop.length) fixes.push(`Too many effects, so I kept the ${limit} that matter most.`);
  }

  // 3. End cleanly: no effect and no fade-out gimmick on the last piece.
  const last = segs[segs.length - 1];
  if (last && last.effects.some(MOTION)) {
    last.effects = last.effects.filter((e) => !MOTION(e));
    fixes.push("Ended on a clean shot without an effect.");
  }

  if (!fixes.length) return { plan: input, fixes };
  return { plan: { ...input, segments: segs }, fixes };
}
