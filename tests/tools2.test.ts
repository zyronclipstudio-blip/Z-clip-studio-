import test from "node:test";
import assert from "node:assert/strict";
import { effectFilter, exposureFilter } from "../lib/renderer";
import { applyStyleRules, styleById } from "../lib/styles";

test("dark shots get a real lift, normal ones almost none, bright ones a pull-down", () => {
  assert.match(exposureFilter(30), /gamma=1\.[3-5]/);
  assert.equal(exposureFilter(118), "");
  assert.match(exposureFilter(200), /brightness=-0\.0/);
  assert.equal(exposureFilter(NaN), "");
});

test("new camera moves and the drop hit produce filters", () => {
  for (const e of ["panleft", "panright", "rise", "drophit"] as const) assert.ok(effectFilter(e, 720, 1280).includes("crop=720:1280"));
});

test("only one drop hit per video, and not in styles that forbid it", () => {
  const seg = (e: string[]) => ({ assetId: "a", startSec: 0, endSec: 1, reason: "r", confidence: 1, transition: "cut" as const, effects: e as never });
  const plan = { version: 1, source: "gemini", aspectRatio: "9:16", pacing: "fast", targetDurationSec: 6, summary: "s", segments: [seg(["drophit"]), seg([]), seg(["drophit"]), seg([]), seg(["drophit"]), seg([])] } as never;
  const out = applyStyleRules(plan, styleById("cars"));
  assert.equal(out.segments.filter((s) => s.effects?.includes("drophit")).length, 1);
  const calm = applyStyleRules(plan, styleById("business"));
  assert.equal(calm.segments.filter((s) => s.effects?.includes("drophit")).length, 0);
});
