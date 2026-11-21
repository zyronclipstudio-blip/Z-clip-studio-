import test from "node:test";
import assert from "node:assert/strict";
import { critiquePlan } from "../lib/critic";
import { reviseByRules } from "../lib/revise";

const seg = (effects: string[], confidence = 0.8, transition = "cut") =>
  ({ assetId: "a", startSec: 0, endSec: 3, reason: "", confidence, transition, effects }) as never;
const plan = (segments: unknown[]) =>
  ({ source: "gemini", aspectRatio: "9:16", pacing: "medium", targetDurationSec: 9, summary: "", segments }) as never;

test("critic removes repeated and excess effects and cleans the ending", () => {
  const p = plan([seg(["punch"]), seg(["punch"]), seg(["shake"], 0.3), seg([]), seg(["flash"])]);
  const r = critiquePlan(p);
  const fx = (r.plan as { segments: { effects: string[] }[] }).segments.map((s) => s.effects.length);
  assert.equal(fx[1], 0); // repeat gone
  assert.equal(fx[4], 0); // clean ending
  assert.ok(r.fixes.length >= 2);
});

test("critic leaves a good plan alone", () => {
  const p = plan([seg(["flash"]), seg([]), seg([]), seg(["punch"], 0.9), seg([])]);
  const r = critiquePlan(p);
  assert.equal(r.fixes.length, 0);
  assert.equal(r.plan, p);
});

test("zoom complaint removes only zoom", () => {
  const p = plan([seg(["punch", "flash"]), seg(["shake"]), seg(["punch"])]);
  const r = reviseByRules(p, "the zoom was a bit much");
  const segs = (r.plan as { segments: { effects: string[] }[] }).segments;
  assert.deepEqual(segs[0].effects, ["flash"]);
  assert.deepEqual(segs[1].effects, ["shake"]);
  assert.deepEqual(segs[2].effects, []);
  assert.equal(r.handled, true);
});

test("silence request sets clip volume to zero", () => {
  const p = { ...(plan([seg([])]) as object), sound: { key: "k", startSec: 0, volume: 1, clipVolume: 0.2 } } as never;
  const r = reviseByRules(p, "silence the background sound");
  assert.equal((r.plan as { sound: { clipVolume: number } }).sound.clipVolume, 0);
});

test("unknown complaint is passed on to the AI", () => {
  assert.equal(reviseByRules(plan([seg([])]), "make the ending more emotional").handled, false);
});

import { wordsForPiece } from "../lib/renderer";
test("caption words move into the piece's own time and skip other clips", () => {
  const w = [
    { assetId: "a", startSec: 10.2, endSec: 10.8, text: "hi" },
    { assetId: "a", startSec: 20, endSec: 21, text: "outside" },
    { assetId: "b", startSec: 10.5, endSec: 11, text: "other" },
  ];
  const r = wordsForPiece(w, "a", 10, 13);
  assert.equal(r.length, 1);
  assert.ok(Math.abs(r[0].start - 0.2) < 1e-6);
});
