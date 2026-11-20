import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GEMINI_PRICE_IN_PER_M,
  GEMINI_PRICE_OUT_PER_M,
  FFMPEG,
  MIME_BY_EXT,
  PLATFORM_CAP_SECONDS,
  UPLOAD_DIR,
} from "./config";
import { run } from "./media";
import {
  EFFECT_IDS,
  EditPlanSchema,
  type AspectRatio,
  type CutSegment,
  type EditPlan,
  type MediaAsset,
  type Setup,
} from "./types/schema";

// ZClip AI adapter. The rest of the app only calls createEditPlan(); swapping
// providers means changing this file, not the product.

export interface PlanResult {
  plan: EditPlan;
  provider: "gemini" | "deterministic";
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCostUsd?: number;
  fallbackReason?: string;
}

export function aspectFor(platform: Setup["platform"]): AspectRatio {
  if (platform === "shorts") return "9:16";
  if (platform === "other") return "1:1";
  return "16:9";
}

export async function createEditPlan(
  assets: MediaAsset[],
  setup: Setup,
  opts: { allowAI?: boolean } = {},
): Promise<PlanResult> {
  // allowAI=false is the emergency kill switch for provider calls.
  if (GEMINI_API_KEY && opts.allowAI !== false) {
    try {
      return await planWithGemini(assets, setup);
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Unknown Gemini error";
      const fallback = planDeterministic(assets, setup);
      return { ...fallback, fallbackReason: reason.slice(0, 300) };
    }
  }
  return planDeterministic(assets, setup);
}

// ---------------------------------------------------------------- Gemini

const GeminiPlanSchema = z.object({
  pacing: z.enum(["fast", "medium", "slow"]).catch("medium"),
  summary: z.string().catch(""),
  segments: z.array(
    z.object({
      assetId: z.string(),
      startSec: z.coerce.number(),
      endSec: z.coerce.number(),
      reason: z.string().catch(""),
      confidence: z.coerce.number().min(0).max(1).catch(0.7),
      transition: z.enum(["cut", "fade"]).catch("cut"),
      effects: z.array(z.string()).catch([]),
    }),
  ),
});

// A small copy of a clip for the AI to watch: it needs to see and hear the footage, not receive 4K.
// This makes the upload to the AI many times smaller and faster, and the render still uses the original.
async function makeWatchCopy(src: string, dir: string, i: number): Promise<string> {
  const out = path.join(dir, `watch-${i}.mp4`);
  await run(
    FFMPEG,
    ["-y", "-hide_banner", "-i", src, "-vf", "scale=-2:360,fps=8", "-c:v", "libx264", "-preset", "veryfast", "-crf", "33", "-c:a", "aac", "-b:a", "48k", "-ac", "1", "-threads", "2", "-movflags", "+faststart", out],
    120_000,
  );
  return out;
}

async function planWithGemini(assets: MediaAsset[], setup: Setup): Promise<PlanResult> {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const uploaded: string[] = [];
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "zclip-watch-"));

  try {
    const parts: (string | ReturnType<typeof createPartFromUri>)[] = [];
    for (let ai_i = 0; ai_i < assets.length; ai_i++) {
      const a = assets[ai_i];
      const original = path.join(UPLOAD_DIR, a.storedName);
      let source = original;
      let mimeType = MIME_BY_EXT[path.extname(a.storedName).toLowerCase()] ?? "video/mp4";
      try {
        source = await makeWatchCopy(original, tmp, ai_i);
        mimeType = "video/mp4";
      } catch {
        // If the small copy fails, fall back to the original clip.
      }
      let file = await ai.files.upload({ file: source, config: { mimeType } });
      if (file.name) uploaded.push(file.name);

      const started = Date.now();
      while (String(file.state) === "PROCESSING") {
        if (Date.now() - started > 180_000) throw new Error("Gemini took too long to process a clip");
        await new Promise((r) => setTimeout(r, 2000));
        file = await ai.files.get({ name: file.name as string });
      }
      if (String(file.state) === "FAILED" || !file.uri || !file.mimeType)
        throw new Error("Gemini could not process one of the clips");

      parts.push(`Clip ID: ${a.id} (file "${a.originalName}", ${a.durationSec.toFixed(1)} seconds):`);
      parts.push(createPartFromUri(file.uri, file.mimeType));
    }

    const cap = PLATFORM_CAP_SECONDS[setup.platform];
    const prompt = `You are the editing brain of ZClip, an automatic video editor.
Watch every clip above and decide which moments to keep and in what order.

Customer intent (may be "auto", meaning decide from the footage):
- Purpose: ${setup.purpose}
- Mood: ${setup.mood}
- Destination: ${setup.platform}

Rules:
- Use ONLY the clip IDs given above. Times are seconds from the start of that clip and must lie inside its duration.
- Choose the strongest, clearest moments. Skip blurry, shaky, dark, duplicate or empty footage.
- Never cut in the middle of important action or speech.
- Pick the final length yourself based on how much good footage there is. Do not pad. Hard maximum: ${cap} seconds in total.
- Each segment should usually be between 1 and 12 seconds. Faster pacing means shorter segments.
- "transition" is "cut" or "fade". Prefer "cut" for energetic content and use "fade" sparingly.
- HOOK: the very first segment must be the single most striking, clear moment in all the footage, because viewers decide in the first second. Never open with a slow or empty moment.
- ORDER: arrange clips so they flow. For footage that tells a story (for example AI-generated scenes), keep the story logical and keep a character or look consistent across neighbouring cuts. Put wide shots before close-ups unless a close-up is the hook.
- "effects" is a list (0 to 2 items) chosen only from: "punch" (zoom push-in, for hits and reveals), "shake" (handheld jitter, for impact or action), "flash" (white flash, for a big beat or the hook), "glitch" (colour split, for energetic or edgy moments), "whip" (blur streak, to link two shots). Use them on real moments only, never on every segment, and use none for calm or professional content. The first segment may use one.
- "reason" is one plain sentence a customer can read explaining why this moment was chosen.
- "confidence" is 0 to 1: how sure you are this segment belongs in the edit.

Return ONLY a JSON object, with no markdown and no commentary, in exactly this shape:
{"pacing":"fast|medium|slow","summary":"one or two sentences describing the edit","segments":[{"assetId":"...","startSec":0,"endSec":0,"reason":"...","confidence":0.8,"transition":"cut","effects":[]}]}`;

    const res = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: createUserContent([...parts, prompt]),
      config: { responseMimeType: "application/json", temperature: 0.4 },
    });

    const text = (res.text ?? "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const plan = sanitize(JSON.parse(text), assets, setup, "gemini");

    const tokensIn = res.usageMetadata?.promptTokenCount;
    const tokensOut = res.usageMetadata?.candidatesTokenCount;
    const cost =
      GEMINI_PRICE_IN_PER_M || GEMINI_PRICE_OUT_PER_M
        ? ((tokensIn ?? 0) * GEMINI_PRICE_IN_PER_M + (tokensOut ?? 0) * GEMINI_PRICE_OUT_PER_M) / 1e6
        : undefined;

    return { plan, provider: "gemini", model: GEMINI_MODEL, tokensIn, tokensOut, estimatedCostUsd: cost };
  } finally {
    // Do not leave customer footage on the provider's servers.
    await Promise.all(uploaded.map((name) => ai.files.delete({ name }).catch(() => undefined)));
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

// Validates and repairs a provider plan so the renderer never sees impossible values.
export function sanitize(raw: unknown, assets: MediaAsset[], setup: Setup, source: EditPlan["source"]): EditPlan {
  const parsed = GeminiPlanSchema.parse(raw);
  const byId = new Map(assets.map((a) => [a.id, a]));
  const cap = PLATFORM_CAP_SECONDS[setup.platform];
  const segments: CutSegment[] = [];
  let total = 0;

  for (const s of parsed.segments) {
    const asset = byId.get(s.assetId);
    if (!asset) continue;
    const start = Math.max(0, Math.min(s.startSec, asset.durationSec));
    let end = Math.max(0, Math.min(s.endSec, asset.durationSec));
    if (end - start < 0.5) continue;
    if (total + (end - start) > cap) {
      end = start + (cap - total);
      if (end - start < 1) break;
    }
    total += end - start;
    segments.push({
      assetId: asset.id,
      startSec: round(start),
      endSec: round(end),
      reason: s.reason || "Selected as a strong moment.",
      confidence: s.confidence,
      transition: s.transition,
      effects: (() => {
        const ok = s.effects.filter((e): e is (typeof EFFECT_IDS)[number] => (EFFECT_IDS as readonly string[]).includes(e));
        const uniq = [...new Set(ok)].slice(0, 2);
        return uniq.length ? uniq : undefined;
      })(),
    });
    if (total >= cap) break;
  }
  fitSegmentsToCap(segments, cap);
  if (segments.length === 0) throw new Error("The AI plan contained no usable segments");

  return EditPlanSchema.parse({
    version: 1,
    source,
    aspectRatio: aspectFor(setup.platform),
    pacing: parsed.pacing,
    targetDurationSec: round(segments.reduce((sum, segment) => sum + segment.endSec - segment.startSec, 0)),
    summary: parsed.summary || "Automatic edit.",
    segments,
  });
}

// ------------------------------------------------------- deterministic

export function planDeterministic(assets: MediaAsset[], setup: Setup): PlanResult {
  const mood = setup.mood === "auto" ? moodFromPurpose(setup.purpose) : setup.mood;
  const pacing: EditPlan["pacing"] = mood === "energetic" ? "fast" : mood === "calm" || mood === "cinematic" ? "slow" : "medium";
  // Plain hard cuts by default: clips are usually already polished. Fades are one tap in the editor.
  const transition: CutSegment["transition"] = "cut";
  const cap = PLATFORM_CAP_SECONDS[setup.platform];

  type Cand = { assetId: string; start: number; len: number; clipIdx: number };
  const cands: Cand[] = [];

  // Manual-first default: keep every clip whole, in upload order. The person trims and
  // rearranges from here; the platform limit below is the only thing that shortens it.
  assets.forEach((a, clipIdx) => {
    cands.push({ assetId: a.id, start: 0, len: a.durationSec, clipIdx });
  });

  let total = cands.reduce((s, c) => s + c.len, 0);
  if (total > cap) {
    const scale = cap / total;
    for (const c of cands) c.len = Math.max(1, c.len * scale);
    total = cands.reduce((s, c) => s + c.len, 0);
  }
  while (total > cap && cands.length > 1) {
    // Still too long: drop the last segment of the clip that has the most.
    const counts = new Map<number, number>();
    cands.forEach((c) => counts.set(c.clipIdx, (counts.get(c.clipIdx) ?? 0) + 1));
    const [worst] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const idx = cands.map((c) => c.clipIdx).lastIndexOf(worst);
    total -= cands[idx].len;
    cands.splice(idx, 1);
  }

  const segments: CutSegment[] = cands.map((c) => ({
    assetId: c.assetId,
    startSec: round(c.start),
    endSec: round(Math.min(c.start + c.len, assets.find((a) => a.id === c.assetId)!.durationSec)),
    reason: "Your full clip, kept as shot. Trim or rearrange it below.",
    confidence: 0.4,
    transition,
  }));

  fitSegmentsToCap(segments, cap);

  const plan = EditPlanSchema.parse({
    version: 1,
    source: "deterministic",
    aspectRatio: aspectFor(setup.platform),
    pacing,
    targetDurationSec: round(segments.reduce((sum, segment) => sum + segment.endSec - segment.startSec, 0)),
    summary: `Your first cut: ${assets.length} clip${assets.length === 1 ? "" : "s"} in upload order. Trim, reorder or remove anything below.`,
    segments,
  });
  return { plan, provider: "deterministic" };
}

function moodFromPurpose(purpose: Setup["purpose"]): Setup["mood"] {
  if (purpose === "gym") return "energetic";
  if (purpose === "cinematic") return "cinematic";
  if (purpose === "business") return "professional";
  return "auto";
}

function fitSegmentsToCap(segments: CutSegment[], capSeconds: number): void {
  const capMs = Math.floor(capSeconds * 1000);
  let totalMs = segments.reduce(
    (sum, segment) => sum + Math.round(segment.endSec * 1000) - Math.round(segment.startSec * 1000),
    0,
  );

  // Work in integer milliseconds so rounding individual cuts cannot push the
  // finished timeline a few milliseconds over the platform's hard duration cap.
  for (let i = segments.length - 1; totalMs > capMs && i >= 0; i--) {
    const segment = segments[i];
    const startMs = Math.round(segment.startSec * 1000);
    const endMs = Math.round(segment.endSec * 1000);
    const durationMs = Math.max(0, endMs - startMs);
    const overflowMs = totalMs - capMs;

    if (durationMs <= overflowMs) {
      segments.splice(i, 1);
      totalMs -= durationMs;
    } else {
      segment.endSec = (endMs - overflowMs) / 1000;
      totalMs = capMs;
    }
  }
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
