import { EFFECT_IDS, type AspectRatio, type CutSegment, type EditPlan, type EffectId, type MediaAsset } from "./types/schema";

// Manual editing as pure functions over the same EditPlan the automatic editor writes.
// Every operation returns a NEW plan or throws PlanOpError with a message safe to show the user.
// Nothing here touches the network, the database or credits.

export const MIN_SEGMENT_SEC = 0.5;
export const MAX_SEGMENTS = 60;

export class PlanOpError extends Error {}

const round = (n: number) => Math.round(n * 1000) / 1000;
const len = (s: CutSegment) => s.endSec - s.startSec;

function rebuild(plan: EditPlan, segments: CutSegment[]): EditPlan {
  return {
    ...plan,
    segments,
    targetDurationSec: round(segments.reduce((sum, s) => sum + len(s), 0)),
  };
}

function at(plan: EditPlan, index: number): CutSegment {
  const s = plan.segments[index];
  if (!Number.isInteger(index) || !s) throw new PlanOpError("That clip is no longer in the edit.");
  return s;
}

/** Final safety gate. Run after every manual change and again before rendering. */
export function validatePlan(plan: EditPlan, assets: Pick<MediaAsset, "id" | "durationSec">[], capSec: number): EditPlan {
  if (plan.segments.length === 0) throw new PlanOpError("Keep at least one clip in the edit.");
  if (plan.segments.length > MAX_SEGMENTS) throw new PlanOpError(`An edit can have at most ${MAX_SEGMENTS} pieces.`);
  const byId = new Map(assets.map((a) => [a.id, a]));
  let total = 0;
  for (const s of plan.segments) {
    const a = byId.get(s.assetId);
    if (!a) throw new PlanOpError("A clip in this edit is missing.");
    if (!Number.isFinite(s.startSec) || !Number.isFinite(s.endSec)) throw new PlanOpError("A cut has an invalid time.");
    if (s.startSec < 0) throw new PlanOpError("A cut starts before its clip begins.");
    if (s.endSec > a.durationSec + 0.001) throw new PlanOpError("A cut runs past the end of its clip.");
    if (len(s) < MIN_SEGMENT_SEC - 0.0005) throw new PlanOpError(`Every piece must be at least ${MIN_SEGMENT_SEC} seconds.`);
    total += len(s);
  }
  if (total > capSec + 0.01) throw new PlanOpError(`This edit is ${Math.round(total)}s and the limit is ${capSec}s. Shorten or remove a piece.`);
  return rebuild(plan, plan.segments);
}

export function removeSegment(plan: EditPlan, index: number): EditPlan {
  at(plan, index);
  if (plan.segments.length === 1) throw new PlanOpError("Keep at least one clip in the edit.");
  return rebuild(plan, plan.segments.filter((_, i) => i !== index));
}

export function moveSegment(plan: EditPlan, from: number, to: number): EditPlan {
  at(plan, from);
  if (!Number.isInteger(to) || to < 0 || to >= plan.segments.length) throw new PlanOpError("That position does not exist.");
  const next = plan.segments.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return rebuild(plan, next);
}

/** Set a new start and/or end (seconds inside the source clip). */
export function trimSegment(
  plan: EditPlan,
  index: number,
  edge: { startSec?: number; endSec?: number },
  assets: Pick<MediaAsset, "id" | "durationSec">[],
): EditPlan {
  const s = at(plan, index);
  const asset = assets.find((a) => a.id === s.assetId);
  if (!asset) throw new PlanOpError("A clip in this edit is missing.");
  const start = round(Math.max(0, edge.startSec ?? s.startSec));
  const end = round(Math.min(asset.durationSec, edge.endSec ?? s.endSec));
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new PlanOpError("That is not a valid time.");
  if (end - start < MIN_SEGMENT_SEC - 0.0005) throw new PlanOpError(`Every piece must be at least ${MIN_SEGMENT_SEC} seconds.`);
  const next = plan.segments.slice();
  next[index] = { ...s, startSec: start, endSec: end };
  return rebuild(plan, next);
}

/** Cut one piece in two at `atSec` (seconds inside the source clip). */
export function splitSegment(plan: EditPlan, index: number, atSec: number): EditPlan {
  const s = at(plan, index);
  if (plan.segments.length >= MAX_SEGMENTS) throw new PlanOpError(`An edit can have at most ${MAX_SEGMENTS} pieces.`);
  const cut = round(atSec);
  if (!Number.isFinite(cut) || cut - s.startSec < MIN_SEGMENT_SEC - 0.0005 || s.endSec - cut < MIN_SEGMENT_SEC - 0.0005)
    throw new PlanOpError(`Split inside the piece, at least ${MIN_SEGMENT_SEC}s from either end.`);
  const next = plan.segments.slice();
  next.splice(index, 1, { ...s, endSec: cut }, { ...s, startSec: cut, transition: "cut", effects: undefined });
  return rebuild(plan, next);
}

/** Loudness of one piece: 0 (muted) to 2 (double). 1 is the original. */
export function setVolume(plan: EditPlan, index: number, volume: number): EditPlan {
  const s = at(plan, index);
  if (!Number.isFinite(volume) || volume < 0 || volume > 2) throw new PlanOpError("Volume must be between 0% and 200%.");
  const next = plan.segments.slice();
  next[index] = { ...s, volume: Math.round(volume * 100) / 100 };
  return rebuild(plan, next);
}

/** How a piece joins the one before it: a plain cut or a short fade. */
export function setTransition(plan: EditPlan, index: number, transition: CutSegment["transition"]): EditPlan {
  const s = at(plan, index);
  if (transition !== "cut" && transition !== "fade") throw new PlanOpError("That transition is not available.");
  const next = plan.segments.slice();
  next[index] = { ...s, transition };
  return rebuild(plan, next);
}

/** Turn one motion effect on or off for a piece (at most three at once). */
export function toggleEffect(plan: EditPlan, index: number, effect: EffectId): EditPlan {
  const s = at(plan, index);
  if (!EFFECT_IDS.includes(effect)) throw new PlanOpError("That effect is not available.");
  const have = s.effects ?? [];
  let effects: EffectId[];
  if (have.includes(effect)) effects = have.filter((e) => e !== effect);
  else if (have.length >= 3) throw new PlanOpError("Use up to three effects on one piece.");
  else effects = [...have, effect];
  const next = plan.segments.slice();
  next[index] = { ...s, effects: effects.length ? effects : undefined };
  return rebuild(plan, next);
}

/** Put a copy of one piece right after it. */
export function duplicateSegment(plan: EditPlan, index: number): EditPlan {
  const s = at(plan, index);
  if (plan.segments.length >= MAX_SEGMENTS) throw new PlanOpError(`An edit can have at most ${MAX_SEGMENTS} pieces.`);
  const next = plan.segments.slice();
  next.splice(index + 1, 0, { ...s, transition: "cut" });
  return rebuild(plan, next);
}

export function setAspect(plan: EditPlan, aspectRatio: AspectRatio): EditPlan {
  if (!["9:16", "1:1", "16:9"].includes(aspectRatio)) throw new PlanOpError("That shape is not available.");
  return { ...plan, aspectRatio };
}

// ---------------------------------------------------------------- undo / redo

export interface PlanHistory {
  past: EditPlan[];
  present: EditPlan;
  future: EditPlan[];
}

const MAX_HISTORY = 100;

export const startHistory = (plan: EditPlan): PlanHistory => ({ past: [], present: plan, future: [] });

export function commit(history: PlanHistory, next: EditPlan): PlanHistory {
  return { past: [...history.past, history.present].slice(-MAX_HISTORY), present: next, future: [] };
}

export function undo(history: PlanHistory): PlanHistory {
  const prev = history.past[history.past.length - 1];
  if (!prev) return history;
  return { past: history.past.slice(0, -1), present: prev, future: [history.present, ...history.future] };
}

export function redo(history: PlanHistory): PlanHistory {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: rest };
}
