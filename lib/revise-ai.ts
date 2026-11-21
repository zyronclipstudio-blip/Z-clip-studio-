import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import { capabilityPrompt } from "./capabilities";
import { GEMINI_API_KEY, GEMINI_MODEL_CHAIN, isModelGone } from "./config";
import { EFFECT_IDS, type CutSegment, type EditPlan, type MediaAsset } from "./types/schema";

// Revises an existing plan from a plain-language complaint. Text only: no footage is re-uploaded,
// so this costs a fraction of a full edit. Only the parts the complaint is about should change.
const Out = z.object({
  explanation: z.string().catch(""),
  sound: z.object({ volume: z.coerce.number().min(0).max(1.5).optional(), clipVolume: z.coerce.number().min(0).max(1).optional() }).optional().catch(undefined),
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

export async function reviseWithGemini(plan: EditPlan, assets: MediaAsset[], feedback: string, capSec: number): Promise<{ plan: EditPlan; explanation: string }> {
  if (!GEMINI_API_KEY) throw new Error("AI is not available right now.");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const byId = new Map(assets.map((a) => [a.id, a]));
  const clips = assets.map((a) => `${a.id}: "${a.originalName}", ${a.durationSec.toFixed(1)}s`).join("\n");
  const current = plan.segments.map((s, i) => ({ n: i + 1, assetId: s.assetId, startSec: s.startSec, endSec: s.endSec, transition: s.transition, effects: s.effects, reason: s.reason }));

  const prompt = `You are the editing brain of ZClip. A customer is unhappy with part of their edit and told you in their own words.

Customer says: """${feedback.slice(0, 500)}"""

Clips available (you cannot see them again, only their lengths):
${clips}

Current edit, in order:
${JSON.stringify(current)}

Rules:
- Change ONLY what the complaint is about. Keep every other piece exactly as it is (same assetId, startSec, endSec, effects).
- You may reorder, trim, remove, or change effects/transitions. You cannot add a moment you have not seen; to add footage, reuse a range that is already in the edit or another part of a clip inside its duration.
- Times must be inside the clip. Every piece at least 0.5 seconds. Total at most ${capSec} seconds.
${capabilityPrompt()}
- SOUND: ${plan.sound ? `the edit has the customer's own song at volume ${plan.sound.volume} and the clips' own audio at ${plan.sound.clipVolume ?? 0.2} (0 = silent, 1 = full). If they say the song is too loud/quiet or the clips' sound is too loud/quiet/should be silent, return "sound":{"volume":n,"clipVolume":n} with the new levels. The song is cut to the length of the video automatically.` : "the edit has no customer song."} You cannot pick a different song or change which part of the song plays; if asked, say they can change the song by starting a new edit with another sound.
- If the complaint is about something else you cannot change here, change nothing and say so honestly in "explanation".
- "explanation": one or two plain sentences saying what you changed and why, speaking to the customer. Do not promise anything you did not do.

Return ONLY JSON: {"explanation":"...","sound":{"volume":1,"clipVolume":0},"segments":[{"assetId":"...","startSec":0,"endSec":0,"reason":"...","confidence":0.8,"transition":"cut","effects":[]}]}`;

  let res: Awaited<ReturnType<typeof ai.models.generateContent>> | undefined;
  let lastErr: unknown;
  for (const model of GEMINI_MODEL_CHAIN.flatMap((m) => [m, m])) {
    try {
      res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json", temperature: 0.3 } });
      break;
    } catch (e) {
      lastErr = e;
      if (isModelGone(e instanceof Error ? e.message : "")) continue;
      if (!/503|429|UNAVAILABLE|overloaded|high demand|RESOURCE_EXHAUSTED|timeout/i.test(e instanceof Error ? e.message : "")) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!res) throw lastErr instanceof Error ? lastErr : new Error("AI is busy");

  const parsed = Out.parse(JSON.parse((res.text ?? "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()));
  const segments: CutSegment[] = [];
  for (const s of parsed.segments) {
    const a = byId.get(s.assetId);
    if (!a) continue;
    const start = Math.max(0, Math.min(s.startSec, a.durationSec - 0.5));
    const end = Math.min(a.durationSec, Math.max(s.endSec, start + 0.5));
    if (end - start < 0.5) continue;
    segments.push({
      assetId: s.assetId,
      startSec: Math.round(start * 1000) / 1000,
      endSec: Math.round(end * 1000) / 1000,
      reason: s.reason.slice(0, 200),
      confidence: s.confidence,
      transition: s.transition,
      effects: s.effects.filter((e): e is (typeof EFFECT_IDS)[number] => (EFFECT_IDS as readonly string[]).includes(e)).slice(0, 2),
    });
  }
  if (!segments.length) throw new Error("The AI did not return a usable edit.");
  const total = segments.reduce((n, s) => n + (s.endSec - s.startSec), 0);
  const sound = plan.sound && parsed.sound ? { ...plan.sound, volume: parsed.sound.volume ?? plan.sound.volume, clipVolume: parsed.sound.clipVolume ?? plan.sound.clipVolume } : plan.sound;
  return { plan: { ...plan, sound, segments, targetDurationSec: Math.round(total * 100) / 100 }, explanation: parsed.explanation.slice(0, 400) };
}
