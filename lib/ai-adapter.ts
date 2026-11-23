import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { GoogleGenAI, createPartFromUri, createUserContent } from "@google/genai";
import {
  GEMINI_API_KEY,
  GEMINI_MODEL_CHAIN, isModelGone,
  GEMINI_MODEL,
  GEMINI_PRICE_IN_PER_M,
  GEMINI_PRICE_OUT_PER_M,
  FFMPEG,
  MIME_BY_EXT,
  PLATFORM_CAP_SECONDS,
  UPLOAD_DIR,
} from "./config";
import { capabilityPrompt } from "./capabilities";
import { stylePrompt, type Style } from "./styles";
import { isImageName } from "./image";
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

export function aspectFor(platform: Setup["platform"], assets: Pick<MediaAsset, "width" | "height">[] = []): AspectRatio {
  if (platform === "shorts") return "9:16";
  if (platform === "other") return "1:1";
  if (platform === "auto" && assets.length) {
    // Follow the footage: phone clips are mostly upright, and a wide frame would crop heads off.
    const portrait = assets.filter((a) => a.height > a.width * 1.1).length;
    const wide = assets.filter((a) => a.width > a.height * 1.1).length;
    if (portrait > wide) return "9:16";
    if (portrait === 0 && wide === 0) return "1:1";
  }
  return "16:9";
}

export async function createEditPlan(
  assets: MediaAsset[],
  setup: Setup,
  opts: { allowAI?: boolean; style?: Style; rules?: string[] } = {},
): Promise<PlanResult> {
  // allowAI=false is the emergency kill switch for provider calls.
  if (GEMINI_API_KEY && opts.allowAI !== false) {
    try {
      return await planWithGemini(assets, setup, opts.style, opts.rules ?? []);
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
      speed: z.coerce.number().min(0.75).max(1.5).optional().catch(undefined),
      freeze: z.coerce.number().min(0.2).max(1.5).optional().catch(undefined),
      shot: z.enum(["wide", "medium", "detail"]).optional().catch(undefined),
      blend: z.enum(["dissolve", "slide", "zoom", "wipe", "circle", "fadeblack"]).optional().catch(undefined),
      reverse: z.boolean().optional().catch(undefined),
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

async function planWithGemini(assets: MediaAsset[], setup: Setup, style: Style | undefined, rules: string[]): Promise<PlanResult> {
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
        if (!isImageName(a.originalName)) {
          source = await makeWatchCopy(original, tmp, ai_i);
          mimeType = "video/mp4";
        }
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

      parts.push(isImageName(a.originalName) ? `Clip ID: ${a.id} (a PHOTO, "${a.originalName}"; it can be shown for at most ${a.durationSec.toFixed(0)} seconds, always from 0):` : `Clip ID: ${a.id} (file "${a.originalName}", ${a.durationSec.toFixed(1)} seconds):`);
      parts.push(createPartFromUri(file.uri, file.mimeType));
    }

    const cap = PLATFORM_CAP_SECONDS[setup.platform];
    const prompt = `You are the editing brain of ZClip, an automatic video editor.
Watch every clip above and decide which moments to keep and in what order.

Customer intent (may be "auto", meaning decide from the footage):
- Purpose: ${setup.purpose}
- Mood: ${setup.mood}
- Destination: ${setup.platform}
${stylePrompt(style)}${rules.length ? `\n- LESSONS from customers (follow them): ${rules.join(" ")}` : ""}

Rules:
- Some items may be PHOTOS. Treat a photo as a still shot: start at 0, show it for 2 to 3 seconds, and place it where it fits the story or the beat. Mix photos and videos naturally.
- Use ONLY the clip IDs given above. Times are seconds from the start of that clip and must lie inside its duration.
- Choose the strongest, clearest moments. Skip blurry, shaky, dark, duplicate or empty footage.
- Never cut in the middle of important action or speech.
- LENGTH: the person added all of this footage on purpose. Use EVERY clip and photo at least once, and keep most of the good footage. The finished video should normally be at least 60% as long as the usable footage, and never shorter than 15 seconds when there is that much footage. Only drop a moment if it is clearly unusable (blurry, black, duplicate). Hard maximum: ${cap} seconds in total.
- Each video segment should usually be 3 to 8 seconds (shorter only for fast, beat-driven styles). Photos get 2 to 3 seconds each.
- "transition" is "cut" or "fade". Prefer "cut" for energetic content and use "fade" sparingly.
- HOOK: the very first segment must be the single most striking, clear moment in all the footage, because viewers decide in the first second. Never open with a slow or empty moment.
- ORDER: arrange clips so they flow. For footage that tells a story (for example AI-generated scenes), keep the story logical and keep a character or look consistent across neighbouring cuts. Put wide shots before close-ups unless a close-up is the hook.
${capabilityPrompt()}
- "speed" (0.75 to 1.5, default 1): 0.75 = slow motion for the single best moment (a reveal, a hit, a dance move); up to 1.5 to tighten a dull stretch. Use on at most 2 segments, never on speech.
- "shot" (optional): label what the segment shows: "wide" (whole scene, location, full body), "medium" (waist-up, a person or object in context), "detail" (close-up: face, hands, wheel, product, texture). Pro edits mix them: open on the strongest shot, then move wide to medium to detail, and never put three of the same kind in a row.
- "blend" (optional): how this segment arrives from the previous one, a smooth 0.3s blend instead of a hard cut: "dissolve" (calm, time passing, emotional), "slide" (energetic, outfit or location change), "zoom" (reveal, beat drop), "wipe", "circle" (playful), "fadeblack" (scene or chapter change). Use on about a third of the boundaries, only where the shots differ in place or subject; keep hard cuts inside one continuous action and on strong beats. Never the same blend twice in a row.
- "freeze" (0.3 to 1.0 seconds, optional): holds the last frame of a segment to land a beat hit or reveal. At most 2 per video, never on speech.
- "reverse" (true, optional): plays a short segment (under 4 seconds) backwards for a surprising moment. At most 1 per video, never on people talking.
- DIRECTOR: build a shape, not a pile. Hook first, then build energy, put the biggest moment about two thirds in, and END on a strong, clean moment (never mid-action or on a fade of nothing). Do not place two near-identical shots next to each other; alternate wide, medium and close, and alternate subjects when you can. Prefer moments with clear faces, clear motion or clear results. If a clip has speech, keep whole sentences together and do not cut off a word.
- VARIETY: spread effects across the video with space between them; the same effect never twice in a row. Use "flash" or "punch" on the hook and on the peak only when the style is energetic.
- CONTINUITY: group shots of the same person, outfit and place together; change outfit or location only with a deliberate cut. End on a clear face or finished moment, never a tight crop of clothing or a blurry frame.
- "reason" is one plain sentence a customer can read explaining why this moment was chosen.
- "confidence" is 0 to 1: how sure you are this segment belongs in the edit.

Return ONLY a JSON object, with no markdown and no commentary, in exactly this shape:
{"pacing":"fast|medium|slow","summary":"one or two sentences describing the edit","segments":[{"assetId":"...","startSec":0,"endSec":0,"reason":"...","confidence":0.8,"transition":"cut","effects":[],"speed":1}]}`;

    // Gemini sometimes answers "high demand" (503/429). Retry, then try a backup model,
    // so a busy moment does not turn a smart edit into a plain join of the clips.
    const contents = createUserContent([...parts, prompt]);
    const attempts: string[] = GEMINI_MODEL_CHAIN.flatMap((m) => [m, m]);
    let res: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
    let usedModel = GEMINI_MODEL;
    let lastErr: unknown;
    for (let n = 0; n < attempts.length && !res; n++) {
      try {
        usedModel = attempts[n];
        res = await ai.models.generateContent({ model: usedModel, contents, config: { responseMimeType: "application/json", temperature: 0.4 } });
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : "";
        if (isModelGone(msg)) { while (n + 1 < attempts.length && attempts[n + 1] === usedModel) n++; continue; } // retired model: go straight to the next one
        if (!/503|429|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|timeout/i.test(msg)) throw e;
        await new Promise((r) => setTimeout(r, 2500 * (n + 1)));
      }
    }
    if (!res) throw lastErr instanceof Error ? lastErr : new Error("Gemini is busy");

    const text = (res.text ?? "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    const plan = sanitize(JSON.parse(text), assets, setup, "gemini");

    const tokensIn = res.usageMetadata?.promptTokenCount;
    const tokensOut = res.usageMetadata?.candidatesTokenCount;
    const cost =
      GEMINI_PRICE_IN_PER_M || GEMINI_PRICE_OUT_PER_M
        ? ((tokensIn ?? 0) * GEMINI_PRICE_IN_PER_M + (tokensOut ?? 0) * GEMINI_PRICE_OUT_PER_M) / 1e6
        : undefined;

    return { plan, provider: "gemini", model: usedModel, tokensIn, tokensOut, estimatedCostUsd: cost };
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
      freeze: s.freeze && s.freeze >= 0.2 ? Math.round(s.freeze * 10) / 10 : undefined,
      blend: s.blend,
      shot: s.shot,
      reverse: s.reverse === true && end - start <= 4 ? true : undefined,
      speed: s.speed && Math.abs(s.speed - 1) > 0.04 ? Math.round(s.speed * 100) / 100 : undefined,
      effects: (() => {
        const ok = s.effects.filter((e): e is (typeof EFFECT_IDS)[number] => (EFFECT_IDS as readonly string[]).includes(e));
        const uniq = [...new Set(ok)].slice(0, 2);
        return uniq.length ? uniq : undefined;
      })(),
    });
    if (total >= cap) break;
  }
  ensureCoverage(segments, assets, cap);
  fitSegmentsToCap(segments, cap);
  if (segments.length === 0) throw new Error("The AI plan contained no usable segments");

  return EditPlanSchema.parse({
    version: 1,
    source,
    aspectRatio: aspectFor(setup.platform, assets),
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
    aspectRatio: aspectFor(setup.platform, assets),
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

// The AI sometimes keeps only a second or two of everything. The person added these clips on purpose,
// so every clip and photo is used at least once, and the edit is lengthened up to a fair share of the footage.
function ensureCoverage(segments: CutSegment[], assets: MediaAsset[], cap: number): void {
  const len = (s: CutSegment) => s.endSec - s.startSec;
  const total = () => segments.reduce((t, s) => t + len(s), 0);
  const used = new Set(segments.map((s) => s.assetId));
  for (const a of assets) {
    if (used.has(a.id) || total() >= cap - 1) continue;
    const take = Math.min(isImageName(a.originalName) ? 2.5 : 6, a.durationSec, cap - total());
    if (take >= 0.5) segments.push({ assetId: a.id, startSec: 0, endSec: round(take), reason: "Included so none of your clips are left out.", confidence: 0.6, transition: "cut" });
  }
  const footage = assets.reduce((t, a) => t + a.durationSec, 0);
  const goal = Math.min(cap, Math.max(Math.min(15, footage), footage * 0.6));
  const byId = new Map(assets.map((a) => [a.id, a]));
  for (let pass = 0; pass < 4 && total() < goal - 0.3; pass++) {
    for (const s of segments) {
      const a = byId.get(s.assetId);
      if (!a || isImageName(a.originalName)) continue; // photos stay short
      const room = a.durationSec - s.endSec;
      if (room <= 0.05) continue;
      s.endSec = round(s.endSec + Math.min(room, 1.5, goal - total()));
      if (total() >= goal - 0.3) break;
    }
  }
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
