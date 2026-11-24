import type { CutSegment, EditPlan, EffectId } from "./types/schema";

// A style is DATA: its own rules for pacing, effects, captions, colour and how the AI should think.
// The AI still picks the moments from the real footage; the style decides how they are cut and dressed.
// New styles (including ones learned from the trend radar) are just more entries of this shape.
export type Look = "none" | "soft" | "punchy" | "cinematic" | "tealorange" | "warm" | "cold" | "noir" | "vibrant" | "faded";

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
  { id: "lifestyle", name: "Lifestyle", tagline: "Soft, warm, girl-on-camera", pacing: "medium", effects: { allowed: ["punch", "glow", "leak"], maxShare: 0.15 }, captions: "clean", look: "soft",
    directorNote: "Lifestyle and personal content: flattering, soft and warm. Lead with the best face shot. Keep outfits and places together, change them with intent. Gentle movement only, never shake or glitch. End on a smile or a confident pose." },
  { id: "creator", name: "Creator", tagline: "Hook fast, keep them watching", pacing: "fast", effects: { allowed: ["punch", "flash", "pulse", "drophit"], maxShare: 0.25 }, captions: "pop", look: "punchy",
    directorNote: "Short-form creator content. The first second must hook: the most interesting moment or line first. Tight cuts, remove pauses and filler. Keep every spoken sentence whole. End on a payoff or a call to action." },
  { id: "anime", name: "Anime edit", tagline: "Beat hits, shake, flash", pacing: "fast", effects: { allowed: ["punch", "shake", "flash", "glitch", "whip", "spin", "zoomblur", "pulse", "glow", "drophit"], maxShare: 0.5 }, captions: "off", look: "punchy",
    directorNote: "High-energy AMV / edit style. Cut hard on the beat. Use punch, shake and flash on strong beats and glitch or whip between very different shots. Fast, rhythmic, dramatic. Never repeat the same effect twice in a row." },
  { id: "gym", name: "Gym", tagline: "Power, motion, intensity", pacing: "fast", effects: { allowed: ["punch", "shake", "flash", "pulse", "grain", "steady", "drophit"], maxShare: 0.35 }, captions: "pop", look: "punchy",
    directorNote: "Workout content. Show effort and the peak of each rep. Fast cuts on movement, hit effects on the hardest moments. Finish on the strongest lift or result." },
  { id: "travel", name: "Travel", tagline: "Scenery that breathes", pacing: "slow", effects: { allowed: ["whip", "glow", "leak", "grain", "steady"], maxShare: 0.2 }, captions: "off", look: "cinematic",
    directorNote: "Travel and scenery. Let wide, beautiful shots breathe. Whip transitions between locations. Alternate wide, medium and detail. End on the most beautiful view." },
  { id: "talking", name: "Talking head", tagline: "Clear words, clean edit", pacing: "medium", effects: { allowed: ["steady"], maxShare: 0 }, captions: "pop", look: "none",
    directorNote: "Someone talking to camera. Never cut mid-word or mid-sentence. Remove long pauses, false starts and repeats. No effects. Captions carry the message. Start on the strongest line." },
  { id: "business", name: "Business", tagline: "Credible, clear, professional", pacing: "medium", effects: { allowed: ["punch"], maxShare: 0.1 }, captions: "clean", look: "none",
    directorNote: "Business and brand content: credible, clear and confident. Open with the strongest claim, result or product moment. Keep speech whole, remove pauses, steady pacing, minimal movement. Show proof (results, product, people at work). End on a clear takeaway or call to action." },
  { id: "cars", name: "Cars", tagline: "Speed, shine, impact", pacing: "fast", effects: { allowed: ["punch", "whip", "flash", "shake", "spin", "zoomblur", "pulse", "glow", "grain", "drophit"], maxShare: 0.4 }, captions: "off", look: "tealorange",
    directorNote: "Car content: open on the most striking angle (front, wheels, headlights or a launch). Cut on engine revs and motion, whip between exterior, interior and detail shots, punch or flash on the loudest moment or the burnout. Finish on a hero shot of the car." },
  { id: "cinematic", name: "Cinematic", tagline: "Film mood, slow and deliberate", pacing: "slow", effects: { allowed: ["punch", "grain", "glow", "leak"], maxShare: 0.1 }, captions: "off", look: "cinematic",
    directorNote: "Cinematic mood: slow, deliberate, composed shots. Longer holds, fewer cuts, strong opening image and a quiet, memorable ending." },
];

export const OVERLAY_FX: EffectId[] = ["grain", "glow", "leak", "steady"];

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
  const rampOk = ["anime", "cars", "gym", "creator", "travel"].includes(style.id);
  let hit = false; // the big hit happens once per video
  const segments: CutSegment[] = plan.segments.map((s) => {
    const kept = (s.effects ?? []).filter((e) => style.effects.allowed.includes(e));
    // Overlays (grain, glow, light leak, steady) are a finish, not a hit: they do not use up the style's effect share.
    const overlay = kept.filter((e) => OVERLAY_FX.includes(e)).slice(0, 1);
    const motion = kept.filter((e) => !OVERLAY_FX.includes(e) && !(e === "drophit" && hit));
    if (motion.includes("drophit")) hit = true;
    const ramp = rampOk ? s.ramp : undefined;
    if (!motion.length || used >= limit) return { ...s, effects: overlay, ramp };
    used++;
    return { ...s, effects: [...motion.slice(0, 1), ...overlay], ramp };
  });
  const captions = plan.captions ? { ...plan.captions, enabled: style.captions !== "off", style: style.captions === "off" ? plan.captions.style : style.captions } : plan.captions;
  const hookOk = !["clean", "talking", "cinematic"].includes(style.id);
  const title = hookOk && plan.title?.hook ? plan.title : plan.title?.endCard ? { endCard: plan.title.endCard } : undefined;
  return { ...plan, pacing: style.pacing, look: style.look, segments, captions, title };
}
