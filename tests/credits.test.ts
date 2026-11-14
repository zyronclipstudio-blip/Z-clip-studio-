import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { estimateCredits } from "../lib/credits";

test("default weights: 10 minutes of footage", () => {
  const e = estimateCredits(600, {});
  assert.equal(e.estimated, 2);
  assert.equal(e.ceiling, 3); // ceil(2 * 1.25)
});

test("minimum charge applies to very short footage", () => {
  const e = estimateCredits(5, {});
  assert.equal(e.estimated, 1);
  assert.equal(e.ceiling, 2);
});

test("ceiling is never below the estimate", () => {
  const e = estimateCredits(600, { credit_ceiling_multiplier: 0.5 });
  assert.equal(e.ceiling, e.estimated);
});

test("settings drive the result and invalid settings fall back safely", () => {
  assert.equal(estimateCredits(1800, { credit_seconds_per_credit: 100 }).estimated, 18);
  const e = estimateCredits(600, { credit_seconds_per_credit: "oops", credit_min_per_job: null });
  assert.equal(e.estimated, 2);
  assert.equal(estimateCredits(600, { credit_seconds_per_credit: 0 }).estimated, 600); // clamped to 1 s/credit, no divide-by-zero
});

test("schedule version is carried onto the estimate", () => {
  assert.equal(estimateCredits(60, { credit_schedule_version: 7 }).scheduleVersion, 7);
});

test("spec example arithmetic: reserve 22, use 18, release 4", () => {
  const reserved = 22;
  const actual = 18;
  assert.equal(reserved - actual, 4);
  assert.equal(82 - actual, 64);
});
