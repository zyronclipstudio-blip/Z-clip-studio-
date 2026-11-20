import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeBeats } from "../lib/beats";

// A click every beat at a known tempo, with a louder second half (the "drop").
function clicks(bpm: number, seconds: number, sr = 11025) {
  const s = new Float32Array(seconds * sr);
  const period = 60 / bpm;
  for (let t = 0.2; t < seconds; t += period) {
    const gain = t > seconds / 2 ? 1 : 0.4;
    const start = Math.round(t * sr);
    for (let i = 0; i < 300; i++) s[start + i] = gain * Math.sin(i * 0.9) * (1 - i / 300);
  }
  return s;
}

for (const bpm of [100, 120, 128]) {
  test(`finds ${bpm} BPM and beats that land on the clicks`, () => {
    const info = analyzeBeats(clicks(bpm, 24));
    assert.ok(Math.abs(info.bpm - bpm) < 3, `bpm ${info.bpm}`);
    const period = 60 / bpm;
    const off = (info.beats[2] - 0.2) / period;
    assert.ok(Math.abs(off - Math.round(off)) < 0.12, `grid off by ${off}`);
    assert.ok(info.dropSec >= 8, `drop at ${info.dropSec}`);
  });
}
