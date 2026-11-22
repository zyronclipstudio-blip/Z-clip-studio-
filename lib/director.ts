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
