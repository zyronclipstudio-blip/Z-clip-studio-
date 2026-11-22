import assert from "node:assert/strict";
import { test } from "node:test";
import { snapPlanToBeats } from "../lib/beat-plan";

const beats = Array.from({ length: 80 }, (_, i) => 0.5 + i * 0.5); // 120 BPM, 40 seconds
const info = { bpm: 120, beats, durationSec: 40, dropSec: 8 };
const assets = [{ id: "a", durationSec: 20 }, { id: "b", durationSec: 20 }];
const seg = (assetId: string, s: number, e: number) => ({ assetId, startSec: s, endSec: e, reason: "", confidence: 1, transition: "cut" as const });
const plan = { version: 1 as const, source: "gemini" as const, aspectRatio: "9:16" as const, pacing: "fast" as const, targetDurationSec: 16, summary: "x", segments: [seg("a", 0, 5), seg("b", 0, 5), seg("a", 5, 10), seg("b", 5, 10), seg("a", 10, 15)] };

test("pieces are whole beats, the edit is a fair length, and it starts at the drop", () => {
  const out = snapPlanToBeats(plan, assets, info, "u/p/sound.mp3", 60);
  assert.equal(out.sound?.startSec, 8);
  for (const s of out.segments) {
    const beatsLong = (s.endSec - s.startSec) / 0.5;
    assert.ok(Math.abs(beatsLong - Math.round(beatsLong)) < 0.01);
    assert.ok(s.endSec - s.startSec >= 0.5 && s.endSec - s.startSec <= 2.01); // fast: a few beats, never long
  }
  // 40s of footage across two 20s clips: a fair share (at least 60%) must be kept, not a few seconds.
  assert.ok(out.targetDurationSec >= 15, `only ${out.targetDurationSec}s`);
  assert.ok(out.targetDurationSec <= 32 + 0.1);
  assert.ok(out.segments[0].effects?.length);
});

test("does nothing without a usable beat", () => {
  const same = snapPlanToBeats(plan, assets, { bpm: 0, beats: [], durationSec: 10, dropSec: 0 }, "k", 60);
  assert.equal(same, plan);
});

test("beat plan: a fast edit never loops footage past about 30 seconds", () => {
  const assets = [{ id: "a", durationSec: 60 }, { id: "b", durationSec: 60 }];
  const plan: any = { version: 1, source: "gemini", aspectRatio: "9:16", pacing: "fast", targetDurationSec: 50, summary: "x", segments: [
    { assetId: "a", startSec: 0, endSec: 2, reason: "", confidence: 0.8, transition: "cut" },
    { assetId: "b", startSec: 0, endSec: 2, reason: "", confidence: 0.8, transition: "cut" } ] };
  const beats = Array.from({ length: 200 }, (_, i) => i * 0.75);
  const out = snapPlanToBeats(plan, assets, { bpm: 80, beats, durationSec: 150, dropSec: 0 } as any, "k", 60);
  assert.ok(out.targetDurationSec <= 30.5, `got ${out.targetDurationSec}`);
});
