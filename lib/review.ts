import { GoogleGenAI } from "@google/genai";
import { GEMINI_API_KEY, GEMINI_MODEL_CHAIN, isModelGone } from "./config";
import { admin } from "./supabase/admin";
import { getSettings } from "./settings";
import { extractFrames, parseReview, type Review } from "./review-core";

const PROMPT = (style: string) => `These are evenly spaced frames, in order, from a short vertical video made by an automatic editor in the "${style}" style.
Judge it like a strict professional editor. Look for: weak first frame (hook), repeated or near-identical shots, awkward crops (heads cut off, only torso), dark or blurry frames, unclear subject, a weak last frame.
Return ONLY JSON: {"score": 0-10 overall, "hook": 0-10 first frame strength, "issues": [up to 4 short plain phrases, e.g. "ends on a dashboard close-up"]}`;

export async function reviewFrames(frames: string[], styleName: string): Promise<Review | null> {
  if (!GEMINI_API_KEY || frames.length < 3) return null;
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const parts = [...frames.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })), { text: PROMPT(styleName) }];
  // The judge is its own slot: the model comes from the app_settings key "judge_model" (so it can change without a deploy)
  // and defaults to a different model from the one that plans the edit, so the AI does not simply grade its own work.
  const picked = (await getSettings().catch(() => ({} as Record<string, unknown>))).judge_model;
  const chain = [...new Set([typeof picked === "string" && picked ? picked : "gemini-3.8-flash", ...GEMINI_MODEL_CHAIN])];
  for (const model of chain) {
    try {
      const res = await ai.models.generateContent({ model, contents: [{ role: "user", parts }], config: { responseMimeType: "application/json", temperature: 0.1 } });
      return parseReview(res.text ?? "");
    } catch (e) {
      if (isModelGone(e instanceof Error ? e.message : "")) continue;
      return null;
    }
  }
  return null;
}

// Frames are taken before the file is cleaned up; the AI call then runs in the background and never delays the customer.
export async function reviewInBackground(opts: { videoPath: string; durationSec: number; ownerId: string; projectId: string; styleId: string; styleName: string }): Promise<void> {
  const frames = await extractFrames(opts.videoPath, opts.durationSec).catch(() => []);
  if (frames.length < 3) return;
  void reviewFrames(frames, opts.styleName)
    .then(async (r) => {
      if (!r) return;
      await admin().from("feedback_events").insert({ owner_id: opts.ownerId, project_id: opts.projectId, signal: "ai_review", detail: { score: r.score, hook: r.hook, issues: r.issues, style: opts.styleId } });
    })
    .catch(() => undefined);
}
