import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { planDeterministic, sanitize } from "../lib/ai-adapter";
import { PLATFORM_CAP_SECONDS } from "../lib/config";
import { EditPlanSchema, SetupSchema, type Setup } from "../lib/types/schema";
import { fakeAsset } from "./helpers";

// Small deterministic random generator so failures are reproducible.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function checkPlan(plan: ReturnType<typeof planDeterministic>["plan"], assets: ReturnType<typeof fakeAsset>[], setup: Setup) {
  EditPlanSchema.parse(plan);
  const byId = new Map(assets.map((a) => [a.id, a]));
  let total = 0;
  for (const s of plan.segments) {
    const a = byId.get(s.assetId);
    assert.ok(a, "segment references a real clip");
    assert.ok(s.startSec >= 0, "start >= 0");
    assert.ok(s.endSec > s.startSec, "end > start");
    assert.ok(s.endSec <= a.durationSec + 0.0011, `end ${s.endSec} within clip ${a.durationSec}`);
    total += s.endSec - s.startSec;
  }
  assert.ok(total <= PLATFORM_CAP_SECONDS[setup.platform] + 0.01, `total ${total} within cap`);
  assert.ok(Math.abs(plan.targetDurationSec - total) < 0.05, "target duration matches segments");
}

test("deterministic plans are always valid across 300 random projects", () => {
  const rand = rng(42);
  const purposes = ["auto", "cinematic", "gym", "business", "general"] as const;
  const moods = ["auto", "energetic", "cinematic", "calm", "professional"] as const;
  const platforms = ["auto", "shorts", "youtube", "other"] as const;
  for (let i = 0; i < 300; i++) {
    const n = 1 + Math.floor(rand() * 20);
    const assets = Array.from({ length: n }, (_, k) => fakeAsset(0.3 + rand() * 300, k));
    const setup = SetupSchema.parse({
      purpose: purposes[Math.floor(rand() * purposes.length)],
      mood: moods[Math.floor(rand() * moods.length)],
      platform: platforms[Math.floor(rand() * platforms.length)],
    });
    checkPlan(planDeterministic(assets, setup).plan, assets, setup);
  }
});

test("worst case: 20 long clips for shorts stays within 60 seconds and 60 segments", () => {
  const assets = Array.from({ length: 20 }, (_, k) => fakeAsset(600, k));
  const setup = SetupSchema.parse({ platform: "shorts", mood: "calm" });
  const { plan } = planDeterministic(assets, setup);
  checkPlan(plan, assets, setup);
  assert.ok(plan.segments.length <= 60);
});

test("one tiny clip still produces a usable plan", () => {
  const assets = [fakeAsset(0.3)];
  const setup = SetupSchema.parse({});
  checkPlan(planDeterministic(assets, setup).plan, assets, setup);
});

test("aspect ratio follows the platform", () => {
  const a = [fakeAsset(30)];
  assert.equal(planDeterministic(a, SetupSchema.parse({ platform: "shorts" })).plan.aspectRatio, "9:16");
  assert.equal(planDeterministic(a, SetupSchema.parse({ platform: "youtube" })).plan.aspectRatio, "16:9");
  assert.equal(planDeterministic(a, SetupSchema.parse({ platform: "other" })).plan.aspectRatio, "1:1");
  assert.equal(planDeterministic(a, SetupSchema.parse({})).plan.aspectRatio, "16:9");
});

test("energetic pacing is faster than calm pacing", () => {
  const a = [fakeAsset(120)];
  const fast = planDeterministic(a, SetupSchema.parse({ mood: "energetic", platform: "youtube" })).plan;
  const slow = planDeterministic(a, SetupSchema.parse({ mood: "calm", platform: "youtube" })).plan;
  const avg = (p: typeof fast) => p.segments.reduce((s, x) => s + x.endSec - x.startSec, 0) / p.segments.length;
  assert.ok(avg(fast) < avg(slow));
  assert.equal(fast.pacing, "fast");
  assert.equal(slow.pacing, "slow");
});

test("sanitize repairs a messy AI plan and drops impossible segments", () => {
  const assets = [fakeAsset(10, 0), fakeAsset(20, 1)];
  const setup = SetupSchema.parse({ platform: "youtube" });
  const raw = {
    pacing: "weird",
    summary: "",
    segments: [
      { assetId: "asset-0", startSec: -5, endSec: 3, reason: "ok", confidence: 9, transition: "wipe" }, // clamped, bad enum/confidence
      { assetId: "nope", startSec: 0, endSec: 5 }, // unknown clip
      { assetId: "asset-1", startSec: "4", endSec: "9.5", reason: "strings" }, // numeric strings
      { assetId: "asset-1", startSec: 30, endSec: 40 }, // beyond the clip
      { assetId: "asset-1", startSec: 8, endSec: 8.2 }, // too short
      { assetId: "asset-0", startSec: 9, endSec: 2 }, // reversed
    ],
  };
  const plan = sanitize(raw, assets, setup, "gemini");
  checkPlan(plan, assets, setup);
  assert.equal(plan.segments.length, 2);
  assert.equal(plan.segments[0].startSec, 0);
  assert.equal(plan.segments[0].transition, "cut");
  assert.ok(plan.segments[0].confidence <= 1);
  assert.equal(plan.pacing, "medium");
  assert.equal(plan.segments[1].startSec, 4);
});

test("sanitize enforces the platform cap on long AI plans", () => {
  const assets = [fakeAsset(300, 0)];
  const setup = SetupSchema.parse({ platform: "shorts" });
  const raw = { pacing: "fast", summary: "x", segments: Array.from({ length: 20 }, (_, i) => ({ assetId: "asset-0", startSec: i * 10, endSec: i * 10 + 9, reason: "r" })) };
  const plan = sanitize(raw, assets, setup, "gemini");
  checkPlan(plan, assets, setup);
  assert.ok(plan.targetDurationSec <= 60.01);
});

test("sanitize rejects a plan with nothing usable", () => {
  const assets = [fakeAsset(10, 0)];
  const setup = SetupSchema.parse({});
  assert.throws(() => sanitize({ pacing: "fast", summary: "", segments: [{ assetId: "x", startSec: 0, endSec: 5 }] }, assets, setup, "gemini"));
  assert.throws(() => sanitize({ nonsense: true }, assets, setup, "gemini"));
  assert.throws(() => sanitize(null, assets, setup, "gemini"));
});

test("sanitize accepts a plan wrapped in a list, or a bare list of segments", () => {
  const assets = [{ id: "a", originalName: "a.mp4", storedName: "a.mp4", sizeBytes: 1, durationSec: 10, width: 720, height: 1280, fps: 30, hasAudio: true, codec: "h264", createdAt: "" }];
  const setup = { purpose: "auto", mood: "auto", platform: "shorts", style: "auto" } as never;
  const seg = { assetId: "a", startSec: 0, endSec: 3, reason: "x", confidence: 0.8, transition: "cut" };
  assert.equal(sanitize([{ pacing: "fast", summary: "s", segments: [seg] }], assets, setup, "gemini").segments.length, 1);
  assert.equal(sanitize([seg], assets, setup, "gemini").segments.length, 1);
});
