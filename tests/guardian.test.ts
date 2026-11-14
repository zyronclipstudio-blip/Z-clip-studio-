import "./setup";
import assert from "node:assert/strict";
import { test } from "node:test";
import { LIMITS } from "../lib/config";
import { checkBatch, checkDurations, rateLimit } from "../lib/guardian";

test("batch limits", () => {
  assert.equal(checkBatch({ count: 0, totalBytes: 0 }).allowed, false);
  assert.equal(checkBatch({ count: LIMITS.maxClips + 1, totalBytes: 10 }).allowed, false);
  assert.equal(checkBatch({ count: 3, totalBytes: LIMITS.maxBatchBytes + 1 }).allowed, false);
  assert.equal(checkBatch({ count: LIMITS.maxClips, totalBytes: LIMITS.maxBatchBytes }).allowed, true);
});

test("duration limits", () => {
  assert.deepEqual(checkDurations([60, 120]), []);
  assert.equal(checkDurations([LIMITS.maxClipSeconds + 1]).length, 1);
  assert.ok(checkDurations(Array(4).fill(LIMITS.maxClipSeconds)).length >= 1); // total too long
});

test("rate limit blocks after the maximum and recovers after the window", () => {
  const realNow = Date.now;
  let t = 1_000_000;
  Date.now = () => t;
  try {
    for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", 3, 1000), true);
    assert.equal(rateLimit("k", 3, 1000), false);
    assert.equal(rateLimit("other", 3, 1000), true, "keys are independent");
    t += 1001;
    assert.equal(rateLimit("k", 3, 1000), true);
  } finally {
    Date.now = realNow;
  }
});
