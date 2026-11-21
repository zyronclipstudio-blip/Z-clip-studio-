import type { CutSegment, EditPlan, EffectId } from "./types/schema";

// A style is DATA: its own rules for pacing, effects, captions, colour and how the AI should think.
// The AI still picks the moments from the real footage; the style decides how they are cut and dressed.
// New styles (including ones learned from the trend radar) are just more entries of this shape.
export type Look = "none" | "soft" | "punchy" | "cinematic";

export interface Style {
  id: string;
  name: string;
  tagline: string;
  pacing: "fast" | "medium" | "slow";
  effects: { allowed: EffectId[]; maxShare: number };
  captions: "pop" | "clean" | "off";
  look: Look;
  directorNote: string;
}

export const STYLES: Style[] = [
  { id: "clean", name: "Clean", tagline: "Simple, tidy cuts", pacing: "medium", effects: { allowed: [], maxShare: 0 }, captions: "clean", look: "none",
    directorNote: "Clean, tidy cuts. No effects. Let the footage speak. Smooth, natural pacing, clear start and ending." },
  { id: "lifestyle", name: "Lifestyle", tagline: "Soft, warm, girl-on-camera", pacing: "medium", effects: { allowed: ["punch"], maxShare: 0.15 }, captions: "clean", look: "soft",
    directorNote: "Lifestyle and personal content: flattering, soft and warm. Lead with the best face shot. Keep outfits and places together, change them with intent. Gentle movement only, never shake or glitch. End on a smile or a confident pose." },
  { id: "creator", name: "Creator", tagline: "Hook fast, keep them watching", pacing: "fast", effects: { allowed: ["punch", "flash"], maxShare: 0.25 }, captions: "pop", look: "punchy",
    directorNote: "Short-form creator content. The first second must hook: the most interesting moment or line first. Tight cuts, remove pauses and filler. Keep every spoken sentence whole. End on a payoff or a call to action." },
  { id: "anime", name: "Anime edit", tagline: "Beat hits, shake, flash", pacing: "fast", effects: { allowed: ["punch", "shake", "flash", "glitch", "whip"], maxShare: 0.5 }, captions: "off", look: "punchy",
    directorNote: "High-energy AMV / edit style. Cut hard on the beat. Use punch, shake and flash on strong beats and glitch or whip between very different shots. Fast, rhythmic, dramatic. Never repeat the same effect twice in a row." },
  { id: "gym", name: "Gym", tagline: "Power, motion, intensity", pacing: "fast", effects: { allowed: ["punch", "shake", "flash"], maxShare: 0.35 }, captions: "pop", look: "punchy",
    directorNote: "Workout content. Show effort and the peak of each rep. Fast cuts on movement, hit effects on the hardest moments. Finish on the strongest lift or result." },
  { id: "travel", name: "Travel", tagline: "Scenery that breathes", pacing: "slow", effects: { allowed: ["whip"], maxShare: 0.2 }, captions: "off", look: "cinematic",
    directorNote: "Travel and scenery. Let wide, beautiful shots breathe. Whip transitions between locations. Alternate wide, medium and detail. End on the most beautiful view." },
  { id: "talking", name: "Talking head", tagline: "Clear words, clean edit", pacing: "medium", effects: { allowed: [], maxShare: 0 }, captions: "pop", look: "none",
    directorNote: "Someone talking to camera. Never cut mid-word or mid-sentence. Remove long pauses, false starts and repeats. No effects. Captions carry the message. Start on the strongest line." },
  { id: "cinematic", name: "Cinematic", tagline: "Film mood, slow and deliberate", pacing: "slow", effects: { allowed: ["punch"], maxShare: 0.1 }, captions: "off", look: "cinematic",
    directorNote: "Cinematic mood: slow, deliberate, composed shots. Longer holds, fewer cuts, strong opening image and a quiet, memorable ending." },
];

export const styleById = (id?: string): Style | undefined => STYLES.find((s) => s.id === id);

export function stylePrompt(style: Style | undefined): string {
  if (!style) return "";
  const fx = style.effects.allowed.length ? `Allowed effects: ${style.effects.allowed.join(", ")} (use sparingly, at most ${Math.round(style.effects.maxShare * 100)}% of the pieces).` : "Use NO effects.";
  return `- STYLE "${style.name}": ${style.directorNote} Pacing: ${style.pacing}. ${fx}`;
}

// Enforces the style's rules on the finished plan, whatever the AI returned. Deterministic and free.
export function applyStyleRules(plan: EditPlan, style: Style | undefined): EditPlan {
  if (!style) return plan;
  const limit = Math.floor(plan.segments.length * style.effects.maxShare);
  let used = 0;
  const segments: CutSegment[] = plan.segments.map((s) => {
    const kept = (s.effects ?? []).filter((e) => style.effects.allowed.includes(e));
    if (!kept.length) return { ...s, effects: [] };
    if (used >= limit) return { ...s, effects: [] };
    used++;
    return { ...s, effects: kept.slice(0, 1) };
  });
  const captions = plan.captions ? { ...plan.captions, enabled: style.captions !== "off", style: style.captions === "off" ? plan.captions.style : style.captions } : plan.captions;
  return { ...plan, pacing: style.pacing, look: style.look, segments, captions };
}
