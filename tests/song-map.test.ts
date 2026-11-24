import assert from "node:assert/strict";
import { test } from "node:test";
import { beatEnergy } from "../lib/beats";
import { directToSong } from "../lib/director";
import type { EffectId } from "../lib/types/schema";

const ALLOWED: EffectId[] = ["flash", "shake", "punch", "drophit", "panleft", "panright", "rise"];
const beats = Array.from({ length: 60 }, (_, i) => i * 0.5);
// quiet for 10 s, a sudden jump at 10 s, loud after
const energy = beats.map((b) => (b < 10 ? 0.1 : 0.95));
const seg = (i: number) => ({ assetId: "a", startSec: i * 2, endSec: i * 2 + 1, reason: "", confidence: 1, transition: "cut" as const });
const plan = (n: number) => ({ version: 1 as const, source: "gemini" as const, aspectRatio: "9:16" as const, pacing: "fast" as const, targetDurationSec: n, summary: "", sound: { key: "k", startSec: 0, volume: 1, clipVolume: 0, bpm: 120 }, segments: Array.from({ length: n }, (_, i) => seg(i)) });

test("beat energy is a 0-1 rank, one per beat", () => {
  const e = new Float32Array(2000).map((_, i) => (i < 1000 ? 0.1 : 1));
  const r = beatEnergy(e, [0.1, 0.3, 0.5], 0.01, 0.2);
  assert.equal(r.length, 3);
  for (const v of r) assert.ok(v >= 0 && v <= 1);
});

test("the biggest jump gets the one drop hit, loud parts get hits, quiet parts get glides and no hits", () => {
  const p = plan(24);
  p.segments.forEach((s, i) => { if (i < 10) s.startSec = s.endSec - 1; });
  const out = directToSong({ ...p, segments: p.segments.map((s) => ({ ...s, effects: ["flash" as EffectId] })) }, { beats, energy }, ALLOWED);
  const drops = out.segments.map((s, i) => (s.effects?.includes("drophit") ? i : -1)).filter((i) => i >= 0);
  assert.equal(drops.length, 1);
  assert.ok(drops[0] >= 4 && drops[0] <= 12, `drop at piece ${drops[0]}`);
  // pieces start 1 s apart on the song timeline (1 s long each): quiet = first 10 pieces
  for (let i = 1; i < 9; i++) assert.ok(!out.segments[i].effects?.some((e) => ["flash", "shake", "punch"].includes(e)), `piece ${i} should be calm`);
  assert.ok(out.segments.slice(1, 9).some((s) => s.effects?.some((e) => ["panleft", "panright", "rise"].includes(e))));
  assert.ok(out.segments.slice(14, 22).every((s) => s.effects?.length));
});

test("without energy or sound it changes nothing", () => {
  const p = plan(8);
  assert.equal(directToSong(p, { beats, energy: undefined }, ALLOWED), p);
});
