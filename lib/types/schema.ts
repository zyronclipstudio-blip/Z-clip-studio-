import { z } from "zod";

export const AspectRatioSchema = z.enum(["9:16", "16:9", "1:1"]);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const SetupSchema = z.object({
  purpose: z.enum(["auto", "cinematic", "gym", "business", "general"]).default("auto"),
  mood: z.enum(["auto", "energetic", "cinematic", "calm", "professional"]).default("auto"),
  platform: z.enum(["auto", "shorts", "youtube", "other"]).default("auto"),
  style: z.string().max(40).default("auto"),
});
export type Setup = z.infer<typeof SetupSchema>;

export interface MediaAsset {
  id: string;
  originalName: string;
  storedName: string;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  codec: string;
  createdAt: string;
}
export type PublicAsset = Omit<MediaAsset, "storedName">;

/** Motion effects the render engine can apply to the start of a piece. */
export const EFFECT_IDS = ["punch", "shake", "flash", "glitch", "whip"] as const;
export const EffectSchema = z.enum(EFFECT_IDS);
export type EffectId = z.infer<typeof EffectSchema>;

export const CutSegmentSchema = z.object({
  assetId: z.string().min(1),
  startSec: z.number().min(0),
  endSec: z.number().positive(),
  reason: z.string().max(400),
  confidence: z.number().min(0).max(1).default(0.7),
  transition: z.enum(["cut", "fade"]).default("cut"),
  volume: z.number().min(0).max(2).optional(), // 1 = original loudness, 0 = muted
  effects: z.array(EffectSchema).max(3).optional(),
  /** Playback speed of this piece: 0.75 slow-motion up to 1.5 faster. 1 or missing = normal. */
  speed: z.number().min(0.75).max(1.5).optional(),
  /** Hold the last frame for this many seconds (a beat hit or a reveal). */
  freeze: z.number().min(0.2).max(1.5).optional(),
  /** Play this short piece backwards (only pieces up to 4 seconds). */
  reverse: z.boolean().optional(),
});
export type CutSegment = z.infer<typeof CutSegmentSchema>;

export const EditPlanSchema = z.object({
  version: z.literal(1),
  source: z.enum(["gemini", "deterministic"]),
  aspectRatio: AspectRatioSchema,
  pacing: z.enum(["fast", "medium", "slow"]),
  targetDurationSec: z.number().positive(),
  summary: z.string().max(600),
  segments: z.array(CutSegmentSchema).min(1).max(60),
  /** The person's own sound, kept in their private storage. */
  sound: z
    .object({
      key: z.string().min(1).max(300),
      startSec: z.number().min(0).max(3600),
      volume: z.number().min(0).max(2).default(1),
      /** Level of the clips' own audio under the sound: 0 silences it. */
      clipVolume: z.number().min(0).max(1).default(0.2),
      bpm: z.number().min(0).max(400).optional(),
    })
    .optional(),
  /** Automatic clean-up: audio noise reduction for speech, mild sharpening. */
  polish: z.object({ audio: z.boolean().default(false), sharpen: z.boolean().default(false) }).optional(),
  /** Colour look applied to every piece. */
  look: z.enum(["none", "soft", "punchy", "cinematic"]).optional(),
  /** Spoken words from the clips, in each clip's own time, burned in as captions. */
  captions: z
    .object({
      enabled: z.boolean().default(true),
      style: z.enum(["pop", "clean"]).default("pop"),
      words: z.array(z.object({ assetId: z.string(), startSec: z.number().min(0), endSec: z.number().min(0), text: z.string().min(1).max(40) })).max(1500),
    })
    .optional(),
});
export type EditPlan = z.infer<typeof EditPlanSchema>;

export interface QACheck {
  name: string;
  ok: boolean;
  detail: string;
}
export interface QAReport {
  passed: boolean; // technical hard gate only; says nothing about creative taste
  hardChecks: QACheck[];
  warnings: string[];
}

export type GuardianSeverity = "info" | "warn" | "block";
export interface GuardianEvent {
  id: string;
  at: string;
  type: string;
  severity: GuardianSeverity;
  message: string;
  data?: Record<string, unknown>;
}
