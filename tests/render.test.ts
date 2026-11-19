import "./setup";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { planDeterministic } from "../lib/ai-adapter";
import { EXPORT_DIR } from "../lib/config";
import { probeMedia } from "../lib/media";
import { renderPlan } from "../lib/renderer";
import { SetupSchema, type EditPlan } from "../lib/types/schema";
import { assetFrom, makeClip } from "./helpers";
import { TEST_DIR } from "./setup";

const DIMS = { "9:16": [720, 1280], "16:9": [1280, 720], "1:1": [720, 720] } as const;
const exportsNow = () => (fs.existsSync(EXPORT_DIR) ? fs.readdirSync(EXPORT_DIR) : []);

test("mixed clips render correctly for every aspect ratio and pass QA", { timeout: 300_000 }, async () => {
  const assets = [
    await assetFrom(makeClip("land.mp4", { seconds: 8, w: 1280, h: 720, fps: 30, audio: true })),
    await assetFrom(makeClip("port.mp4", { seconds: 6, w: 720, h: 1280, fps: 25, audio: false })), // no audio track
    await assetFrom(makeClip("sq.mp4", { seconds: 4, w: 640, h: 640, fps: 24, audio: true })),
  ];
  for (const platform of ["shorts", "youtube", "other"] as const) {
    const { plan } = planDeterministic(assets, SetupSchema.parse({ platform, mood: "cinematic" }));
    const r = await renderPlan(plan, assets);
    assert.ok(r.qa.passed, `QA failed for ${platform}: ${JSON.stringify(r.qa.hardChecks.filter((c) => !c.ok))}`);
    const out = path.join(EXPORT_DIR, r.outputName);
    assert.ok(fs.existsSync(out));
    const meta = await probeMedia(out);
    const [w, h] = DIMS[plan.aspectRatio];
    assert.equal(meta.width, w);
    assert.equal(meta.height, h);
    assert.ok(meta.hasAudio, "output always has an audio track, even from silent clips");
    assert.ok(Math.abs(meta.durationSec - r.durationSec) <= 1.5, `duration ${meta.durationSec} vs ${r.durationSec}`);
  }
});

test("fade transitions and cuts both render", { timeout: 120_000 }, async () => {
  const a = await assetFrom(makeClip("f.mp4", { seconds: 6, w: 640, h: 360, audio: true }));
  const plan: EditPlan = {
    version: 1,
    source: "deterministic",
    aspectRatio: "16:9",
    pacing: "medium",
    targetDurationSec: 5,
    summary: "t",
    segments: [
      { assetId: a.id, startSec: 0, endSec: 2.5, reason: "r", confidence: 1, transition: "fade" },
      { assetId: a.id, startSec: 3, endSec: 5.5, reason: "r", confidence: 1, transition: "cut" },
    ],
  };
  const r = await renderPlan(plan, [a]);
  assert.ok(r.qa.passed, JSON.stringify(r.qa));
});

test("an all-black video is caught by the quality gate", { timeout: 120_000 }, async () => {
  const a = await assetFrom(makeClip("black.mp4", { seconds: 8, w: 640, h: 360, pattern: "black", audio: true }));
  const { plan } = planDeterministic([a], SetupSchema.parse({ platform: "youtube" }));
  const r = await renderPlan(plan, [a]);
  assert.equal(r.qa.passed, false);
  assert.ok(r.qa.hardChecks.some((c) => c.name === "No black frames" && !c.ok));
});

test("a frozen video raises a warning without blocking delivery", { timeout: 120_000 }, async () => {
  const a = await assetFrom(makeClip("still.mp4", { seconds: 8, w: 640, h: 360, pattern: "still", audio: true }));
  const { plan } = planDeterministic([a], SetupSchema.parse({ platform: "youtube", mood: "calm" }));
  const r = await renderPlan(plan, [a]);
  assert.ok(r.qa.warnings.some((w) => /frozen/i.test(w)), `warnings: ${r.qa.warnings}`);
});

test("invalid plans are rejected and leave no output file behind", async () => {
  const a = await assetFrom(makeClip("short.mp4", { seconds: 3, w: 320, h: 240, audio: true }));
  const base: Omit<EditPlan, "segments"> = { version: 1, source: "deterministic", aspectRatio: "16:9", pacing: "fast", targetDurationSec: 2, summary: "t" };
  const before = exportsNow().length;

  await assert.rejects(
    renderPlan({ ...base, segments: [{ assetId: a.id, startSec: 1, endSec: 9, reason: "r", confidence: 1, transition: "cut" }] }, [a]),
    /invalid time range/,
  );
  await assert.rejects(
    renderPlan({ ...base, segments: [{ assetId: "missing", startSec: 0, endSec: 1, reason: "r", confidence: 1, transition: "cut" }] }, [a]),
    /unknown clip/,
  );
  assert.equal(exportsNow().length, before, "no partial exports left on disk");
});

test("probe rejects corrupt and non-video files", async () => {
  const bad = path.join(TEST_DIR, "corrupt.mp4");
  fs.writeFileSync(bad, Buffer.from("this is not a video, just bytes".repeat(100)));
  await assert.rejects(probeMedia(bad));

  const audioOnly = path.join(TEST_DIR, "audio.m4a");
  const { execFileSync } = await import("node:child_process");
  execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=d=2", "-c:a", "aac", audioOnly]);
  await assert.rejects(probeMedia(audioOnly), /No video stream/);
});

test("probe reads rotation so portrait phone clips report the right size", async () => {
  const { execFileSync } = await import("node:child_process");
  const base = makeClip("rot-src.mp4", { seconds: 2, w: 640, h: 360 });
  const rotated = path.join(TEST_DIR, "rotated.mp4");
  try {
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-display_rotation", "90", "-i", base, "-c", "copy", rotated]);
  } catch {
    return; // this FFmpeg build cannot write rotation metadata; nothing to verify
  }
  const meta = await probeMedia(rotated);
  assert.equal(meta.width, 360);
  assert.equal(meta.height, 640);
});
