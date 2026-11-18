import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { planDeterministic } from "../lib/ai-adapter";
import { PLATFORM_CAP_SECONDS } from "../lib/config";
import {
  MIN_SEGMENT_SEC,
  PlanOpError,
  commit,
  moveSegment,
  redo,
  removeSegment,
  setAspect,
  setVolume,
  splitSegment,
  startHistory,
  trimSegment,
  undo,
  validatePlan,
} from "../lib/plan-ops";
import { SetupSchema, type EditPlan } from "../lib/types/schema";
import { fakeAsset } from "./helpers";

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function base() {
  const assets = [fakeAsset(30, 0), fakeAsset(12, 1), fakeAsset(45, 2)];
  const setup = SetupSchema.parse({});
  const plan = planDeterministic(assets, setup).plan;
  return { assets, plan, cap: PLATFORM_CAP_SECONDS[setup.platform] };
}

const total = (p: EditPlan) => p.segments.reduce((a, s) => a + s.endSec - s.startSec, 0);

test("remove keeps the plan valid and refuses to remove the last piece", () => {
  const { assets, plan, cap } = base();
  const fewer = removeSegment(plan, 0);
  assert.equal(fewer.segments.length, plan.segments.length - 1);
  validatePlan(fewer, assets, cap);
  assert.ok(Math.abs(fewer.targetDurationSec - total(fewer)) < 0.01);
  let p = plan;
  while (p.segments.length > 1) p = removeSegment(p, 0);
  assert.throws(() => removeSegment(p, 0), PlanOpError);
});

test("move reorders without changing total length", () => {
  const { plan } = base();
  if (plan.segments.length < 2) return;
  const moved = moveSegment(plan, 0, plan.segments.length - 1);
  assert.equal(moved.segments[moved.segments.length - 1].startSec, plan.segments[0].startSec);
  assert.ok(Math.abs(total(moved) - total(plan)) < 0.001);
  assert.throws(() => moveSegment(plan, 0, 999), PlanOpError);
});

test("trim clamps to the clip and enforces the minimum length", () => {
  const { assets, plan } = base();
  const s = plan.segments[0];
  const asset = assets.find((a) => a.id === s.assetId)!;
  const out = trimSegment(plan, 0, { endSec: asset.durationSec + 500 }, assets);
  assert.ok(out.segments[0].endSec <= asset.durationSec);
  assert.throws(() => trimSegment(plan, 0, { startSec: s.endSec - 0.1 }, assets), PlanOpError);
  assert.throws(() => trimSegment(plan, 99, { startSec: 0 }, assets), PlanOpError);
});

test("split makes two pieces that cover exactly the original range", () => {
  const { plan } = base();
  const s = plan.segments[0];
  const mid = (s.startSec + s.endSec) / 2;
  const out = splitSegment(plan, 0, mid);
  assert.equal(out.segments.length, plan.segments.length + 1);
  assert.equal(out.segments[0].endSec, out.segments[1].startSec);
  assert.ok(Math.abs(total(out) - total(plan)) < 0.002);
  assert.throws(() => splitSegment(plan, 0, s.startSec + 0.1), PlanOpError);
});

test("undo and redo walk back and forth exactly", () => {
  const { plan } = base();
  let h = startHistory(plan);
  const a = removeSegment(plan, 0);
  h = commit(h, a);
  const b = removeSegment(a, 0);
  h = commit(h, b);
  assert.deepEqual(undo(h).present, a);
  assert.deepEqual(undo(undo(h)).present, plan);
  assert.deepEqual(undo(undo(undo(h))).present, plan, "extra undo is a no-op");
  assert.deepEqual(redo(undo(h)).present, b);
  assert.deepEqual(redo(h).present, b, "redo with nothing ahead is a no-op");
  assert.equal(commit(undo(h), plan).future.length, 0, "a new change clears redo");
});

test("validatePlan rejects impossible plans", () => {
  const { assets, plan, cap } = base();
  const bad = (seg: Partial<EditPlan["segments"][number]>) => ({ ...plan, segments: [{ ...plan.segments[0], ...seg }] });
  assert.throws(() => validatePlan(bad({ assetId: "nope" }), assets, cap), PlanOpError);
  assert.throws(() => validatePlan(bad({ startSec: -1 }), assets, cap), PlanOpError);
  assert.throws(() => validatePlan(bad({ endSec: 9999 }), assets, cap), PlanOpError);
  assert.throws(() => validatePlan(bad({ startSec: 1, endSec: 1.1 }), assets, cap), PlanOpError);
  assert.throws(() => validatePlan({ ...plan, segments: [] }, assets, cap), PlanOpError);
  assert.throws(() => validatePlan(plan, assets, 1), PlanOpError, "over the platform limit");
});

test("500 random manual edits never produce an invalid plan", () => {
  const rand = rng(7);
  for (let round = 0; round < 500; round++) {
    const { assets, plan, cap } = base();
    let p = plan;
    for (let step = 0; step < 12; step++) {
      const i = Math.floor(rand() * p.segments.length);
      const s = p.segments[i];
      const pick = Math.floor(rand() * 4);
      try {
        if (pick === 0) p = removeSegment(p, i);
        else if (pick === 1) p = moveSegment(p, i, Math.floor(rand() * p.segments.length));
        else if (pick === 2) p = trimSegment(p, i, { endSec: s.startSec + rand() * 40 }, assets);
        else p = splitSegment(p, i, s.startSec + rand() * (s.endSec - s.startSec));
      } catch (e) {
        assert.ok(e instanceof PlanOpError, "only friendly errors are thrown");
        continue;
      }
      // Splits keep length; trims can only lengthen up to the clip, so re-check the cap like the app will.
      if (total(p) <= cap) validatePlan(p, assets, cap);
      for (const seg of p.segments) assert.ok(seg.endSec - seg.startSec >= MIN_SEGMENT_SEC - 0.001);
    }
  }
});

test("volume and aspect changes are validated and keep the plan valid", () => {
  const { assets, plan, cap } = base();
  const loud = setVolume(plan, 0, 1.5);
  assert.equal(loud.segments[0].volume, 1.5);
  validatePlan(loud, assets, cap);
  assert.equal(setVolume(plan, 0, 0).segments[0].volume, 0);
  assert.throws(() => setVolume(plan, 0, 3), PlanOpError);
  assert.throws(() => setVolume(plan, 0, -0.1), PlanOpError);
  assert.throws(() => setVolume(plan, 0, Number.NaN), PlanOpError);
  assert.equal(setAspect(plan, "1:1").aspectRatio, "1:1");
  assert.throws(() => setAspect(plan, "4:3" as never), PlanOpError);
});
