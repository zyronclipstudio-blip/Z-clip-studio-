import test from "node:test";
import assert from "node:assert/strict";
import { sfxEvents } from "../lib/sfx";

test("whoosh before blends, impact on hits, riser before the first flash, never too busy", () => {
  const segs = [{ effects: ["punch"] }, { blend: "slide" }, { effects: ["whip"] }, { effects: ["flash"] }, {}];
  const ev = sfxEvents(segs, [1, 1, 1, 1, 1]);
  assert.ok(ev.some((e) => e.kind === "whoosh" && Math.abs(e.at - 0.7) < 0.01));
  assert.ok(ev.some((e) => e.kind === "impact" && e.at === 0));
  assert.ok(ev.some((e) => e.kind === "riser"));
  const t = ev.filter((e) => e.kind !== "riser").map((e) => e.at);
  for (let i = 1; i < t.length; i++) assert.ok(t[i] - t[i - 1] >= 0.4);
});

test("no events without triggers", () => {
  assert.deepEqual(sfxEvents([{}, {}, {}], [1, 1, 1]), []);
});

test("the drop hit gets an impact and a riser", () => {
  const ev = sfxEvents([{}, {}, { effects: ["drophit"] }], [1, 1, 1]);
  assert.ok(ev.some((e) => e.kind === "impact" && e.at === 2));
  assert.ok(ev.some((e) => e.kind === "riser"));
});
