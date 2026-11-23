import test from "node:test";
import assert from "node:assert/strict";
import { tasteSummary, type TasteSample } from "../lib/taste-core";

const s = (score: number, over: Partial<TasteSample> = {}): TasteSample => ({ score, reasons: [], pacing: "fast", effects: [], avgPieceSec: 1.5, blends: 0, ...over });

test("no taste until 3 rated edits", () => {
  assert.equal(tasteSummary([s(1), s(1)]), null);
});

test("learns likes, dislikes and asks", () => {
  const out = tasteSummary([s(1, { effects: ["punch"] }), s(1, { effects: ["punch"] }), s(-1, { effects: ["shake"], reasons: ["too_fast"], pacing: "slow", avgPieceSec: 4 }), s(-1, { effects: ["shake"], pacing: "slow", avgPieceSec: 4 })]) ?? "";
  assert.match(out, /liked edits with.*fast pacing/);
  assert.match(out, /the punch effect/);
  assert.match(out, /disliked edits with.*the shake effect/);
  assert.match(out, /slower, less rushed cuts/);
});

test("mixed signals say nothing", () => {
  assert.equal(tasteSummary([s(1), s(-1), s(1), s(-1)]), null);
});
