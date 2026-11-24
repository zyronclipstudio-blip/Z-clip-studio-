import type { CutSegment, EditPlan, EffectId } from "./types/schema";

// The director pass for music edits. Pros do not scatter effects: the big moves land on the musical phrase,
// the way a drummer marks the end of a bar. Every 8 beats (two bars) the next shot arrives with a transition,
// and the transitions take turns so no two neighbours look the same.
const HIT_ORDER: EffectId[] = ["zoomblur", "spin", "whip", "flash", "punch"];
const PHRASE_BEATS = 8;

export function addPhraseHits(plan: EditPlan, allowed: EffectId[]): EditPlan {
  const bpm = plan.sound?.bpm;
  if (!bpm || bpm < 40 || plan.segments.length < 4) return plan;
  const phrase = (60 / bpm) * PHRASE_BEATS;
  const menu = HIT_ORDER.filter((e) => allowed.includes(e));
  if (!menu.length) return plan;

  let t = 0;
  let nextPhrase = phrase; // the first piece already opens the video; hits start at the second phrase
  let turn = 0;
  let last: EffectId | undefined;
  const segments: CutSegment[] = plan.segments.map((s, i) => {
    const speed = s.speed && s.speed > 0 ? s.speed : 1;
    const start = t;
    t += (s.endSec - s.startSec) / speed + (s.freeze ?? 0);
    const isLast = i === plan.segments.length - 1;
    if (i === 0 || isLast || start + 0.15 < nextPhrase) return s; // the opener keeps its own hook, the ending stays clean
    nextPhrase += phrase * Math.max(1, Math.floor((start - nextPhrase) / phrase) + 1);
    const pick = menu.filter((e) => e !== last)[turn++ % Math.max(1, menu.filter((e) => e !== last).length)] ?? menu[0];
    last = pick;
    return { ...s, effects: [pick] };
  });
  return { ...plan, segments };
}


// The song map: the edit is scored to how the track actually moves. Quiet stretches get smooth glides, the loud
// stretches get hits on the beat, and the biggest jump in energy (the drop) gets the one big hit. Everything is
// relative to this song, so a soft song and a heavy song each get their own shape.
const HARD: EffectId[] = ["flash", "shake", "glitch", "punch", "whip", "spin", "zoomblur", "drophit"];
const PEAK_HITS: EffectId[] = ["flash", "shake", "punch", "glitch"];
const GLIDES: EffectId[] = ["panleft", "panright", "rise"];

export function directToSong(plan: EditPlan, info: { beats: number[]; energy?: number[] }, allowed: EffectId[]): EditPlan {
  const energy = info.energy;
  if (!plan.sound || !energy?.length || !info.beats.length || plan.segments.length < 4) return plan;
  const offset = plan.sound.startSec ?? 0;
  const levelAt = (t: number): number => {
    const mt = offset + t;
    let k = info.beats.findIndex((b) => b >= mt - 0.02);
    if (k < 0) k = info.beats.length - 1;
    return energy[Math.min(k, energy.length - 1)] ?? 0.5;
  };
  const starts: number[] = [];
  let t = 0;
  for (const s of plan.segments) {
    starts.push(t);
    t += (s.endSec - s.startSec) / (s.speed && s.speed > 0 ? s.speed : 1) + (s.freeze ?? 0);
  }
  const total = t;
  const levels = starts.map(levelAt);
  const last = plan.segments.length - 1;

  // The drop: the piece where the music jumps the most compared with the pieces just before it.
  let dropAt = -1;
  if (allowed.includes("drophit") && !plan.segments.some((s) => s.effects?.includes("drophit"))) {
    let best = 0.2;
    for (let i = 2; i < last; i++) {
      if (starts[i] < total * 0.2 || starts[i] > total * 0.8) continue;
      const before = levels.slice(Math.max(0, i - 4), i);
      const rise = levels[i] - before.reduce((a, b) => a + b, 0) / before.length;
      if (rise > best) {
        best = rise;
        dropAt = i;
      }
    }
  }

  const hits = PEAK_HITS.filter((e) => allowed.includes(e));
  const glides = GLIDES.filter((e) => allowed.includes(e));
  let turn = 0;
  let glide = 0;
  let prevHit: EffectId | undefined;
  const segments = plan.segments.map((s, i) => {
    if (i === 0 || i === last) return s;
    const fx = s.effects ?? [];
    if (i === dropAt) return { ...s, effects: ["drophit" as EffectId] };
    const lvl = levels[i];
    if (lvl >= 0.7 && hits.length && !fx.some((e) => HARD.includes(e))) {
      const menu = hits.filter((e) => e !== prevHit);
      const pick = (menu.length ? menu : hits)[turn++ % (menu.length || hits.length)];
      prevHit = pick;
      return { ...s, effects: [...fx, pick] };
    }
    if (lvl <= 0.35) {
      const calm = fx.filter((e) => !HARD.includes(e));
      if (glides.length && !calm.some((e) => GLIDES.includes(e)) && !s.freeze && !s.ramp) calm.push(glides[glide++ % glides.length]);
      return { ...s, effects: calm.length ? calm : undefined };
    }
    return s;
  });
  return { ...plan, segments };
}
