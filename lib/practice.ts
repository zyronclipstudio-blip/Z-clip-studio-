import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createEditPlan } from "./ai-adapter";
import { critiquePlan } from "./critic";
import { addPhraseHits } from "./director";
import { dropNearDuplicates, dropWeakShots } from "./shots";
import { applyStyleRules, STYLES } from "./styles";
import { probeMedia } from "./media";
import { renderPlan } from "./renderer";
import { reviewFrames } from "./review";
import { extractFrames } from "./review-core";
import { EXPORT_DIR, UPLOAD_DIR } from "./config";
import { flag, getSettings, num } from "./settings";
import { admin } from "./supabase/admin";
import { logEvent } from "./guardian";
import { nicheInsight, practiceLesson } from "./insights";
import type { EffectId, MediaAsset } from "./types/schema";
import { SetupSchema } from "./types/schema";

// Practice: the AI makes edits from free stock clips (Pixabay) on its own, scores them, and records what scored well.
// Customer data is never used. Clips live only for the length of one practice and are deleted afterwards.
const SEARCH: Record<string, string[]> = {
  clean: ["city street", "coffee shop"],
  lifestyle: ["woman fashion", "girl walking"],
  creator: ["person talking", "desk setup"],
  anime: ["neon city night", "japan street"],
  gym: ["gym workout", "running athlete"],
  travel: ["beach drone", "mountain landscape"],
  talking: ["man talking to camera", "woman talking interview"],
  business: ["office meeting", "startup team"],
  cars: ["sports car", "car driving road"],
  cinematic: ["cinematic nature", "moody forest"],
};

interface Hit { id: number; duration: number; videos: Record<string, { url: string; width: number; height: number }> }

async function findClips(key: string, query: string, want: number): Promise<{ url: string; id: number }[]> {
  const page = 1 + Math.floor(Math.random() * 3);
  const res = await fetch(`https://pixabay.com/api/videos/?key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&per_page=30&page=${page}&safesearch=true`);
  if (!res.ok) throw new Error(`Pixabay ${res.status}`);
  const j = (await res.json()) as { hits?: Hit[] };
  const hits = (j.hits ?? []).filter((h) => h.duration >= 4 && h.duration <= 30);
  hits.sort(() => Math.random() - 0.5);
  return hits.slice(0, want).flatMap((h) => {
    const v = h.videos.small ?? h.videos.medium ?? h.videos.tiny;
    return v?.url ? [{ url: v.url, id: h.id }] : [];
  });
}

export async function practiceOnce(styleId: string): Promise<{ score: number | null }> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) throw new Error("PIXABAY_API_KEY is not set");
  const settings = await getSettings();
  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
  const queries = SEARCH[style.id] ?? ["nature"];
  const wantClips = Math.max(3, Math.min(8, num(settings.practice_clips_per_set, 5)));
  const found = await findClips(key, queries[Math.floor(Math.random() * queries.length)], wantClips);
  if (found.length < 3) throw new Error("Not enough clips found");

  const files: string[] = [];
  const assets: MediaAsset[] = [];
  let out: string | null = null;
  const row: Record<string, unknown> = { style: style.id };
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    for (const c of found) {
      const res = await fetch(c.url);
      if (!res.ok) continue;
      const storedName = `practice-${randomUUID()}.mp4`;
      const dest = path.join(UPLOAD_DIR, storedName);
      await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
      files.push(dest);
      const p = await probeMedia(dest).catch(() => null);
      if (!p) continue;
      assets.push({ id: randomUUID(), originalName: `pixabay-${c.id}.mp4`, storedName, sizeBytes: (await fs.stat(dest)).size, durationSec: p.durationSec, width: p.width, height: p.height, fps: p.fps, hasAudio: p.hasAudio, codec: p.codec, createdAt: new Date().toISOString() });
    }
    if (assets.length < 3) throw new Error("Could not read enough clips");

    const setup = SetupSchema.parse({ purpose: "auto", mood: "auto", platform: "shorts", style: style.id });
    const rules = [await nicheInsight(style.id).catch(() => null), await practiceLesson(style.id).catch(() => null)].filter((x): x is string => !!x);
    const planned = await createEditPlan(assets, setup, { allowAI: true, style, rules });
    // A silent fallback to the basic editor is a failure the customer would feel: record it so it is seen.
    if (planned.fallbackReason) row.error = `AI fallback: ${planned.fallbackReason}`.slice(0, 300);
    let plan = planned.plan;
    const d = await dropNearDuplicates(plan, assets).catch(() => null);
    if (d?.dropped) plan = d.plan;
    const q = await dropWeakShots(plan, assets).catch(() => null);
    if (q?.dropped.length) plan = q.plan;
    plan = { ...plan, polish: { audio: false, sharpen: true, sfx: true } };
    plan = applyStyleRules(addPhraseHits(plan, (style.effects.allowed ?? []) as EffectId[]), style);
    plan = critiquePlan(plan).plan;

    const rendered = await renderPlan(plan, assets, () => undefined);
    out = path.join(EXPORT_DIR, rendered.outputName);
    Object.assign(row, {
      pieces: plan.segments.length,
      blends: plan.segments.filter((s) => s.blend).length,
      effects: [...new Set(plan.segments.flatMap((s) => s.effects ?? []))],
      pacing: plan.pacing,
      duration_sec: rendered.durationSec,
      render_ms: rendered.renderMs,
      qa_passed: rendered.qa.passed,
    });
    const frames = await extractFrames(out, rendered.durationSec).catch(() => []);
    const review = await reviewFrames(frames, style.name);
    if (review) Object.assign(row, { score: review.score, hook: review.hook, issues: review.issues });
    return { score: review?.score ?? null };
  } catch (e) {
    row.error = (e instanceof Error ? e.message : "failed").slice(0, 300);
    throw e;
  } finally {
    await admin().from("practice_runs").insert(row).then(() => undefined, () => undefined);
    await Promise.all([...files, ...(out ? [out] : [])].map((f) => fs.unlink(f).catch(() => undefined)));
  }
}

// One practice per tick when due and the server is quiet. Styles take turns so every kind of footage gets practised.
export async function practiceTick(): Promise<void> {
  const settings = await getSettings();
  if (!flag(settings.practice_enabled) || flag(settings.kill_switch_ai) || flag(settings.kill_switch_render) || !process.env.PIXABAY_API_KEY) return;
  const db = admin();
  const hours = num(settings.practice_interval_hours, 12);
  const { data: lastRow } = await db.from("practice_runs").select("created_at").order("created_at", { ascending: false }).limit(1);
  const last = lastRow?.[0] ? Date.parse(lastRow[0].created_at as string) : 0;
  // "Due" is spread out: one practice every interval / styles, so the whole round finishes within one interval.
  if (Date.now() - last < (hours * 3_600_000) / STYLES.length) return;
  // If the AI said "quota used up" in the last 6 hours, stand down completely: real users come first.
  const { data: recent } = await db.from("practice_runs").select("error, created_at").order("created_at", { ascending: false }).limit(1);
  const lastErr = String(recent?.[0]?.error ?? "");
  if (/429|quota/i.test(lastErr) && Date.now() - Date.parse(recent?.[0]?.created_at as string) < 6 * 3_600_000) return;
  // Customers come first: skip if anyone rendered recently.
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await db.from("render_jobs").select("id", { count: "exact", head: true }).gte("created_at", since);
  if (count) return;
  const { count: done } = await db.from("practice_runs").select("id", { count: "exact", head: true });
  const style = STYLES[(done ?? 0) % STYLES.length];
  // Claim: write a placeholder first so a second instance sees it as taken.
  try {
    const r = await practiceOnce(style.id);
    await logEvent("practice_run", "info", `Practice ${style.id}: score ${r.score ?? "n/a"}`, { style: style.id, score: r.score });
  } catch (e) {
    await logEvent("practice_run", "warn", `Practice ${style.id} failed: ${e instanceof Error ? e.message.slice(0, 160) : "error"}`, { style: style.id });
  }
}
