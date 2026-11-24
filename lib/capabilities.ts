import type { EffectId } from "./types/schema";

// The Director may only use tools listed here. Every entry is a real, tested capability of the render engine.
// To add a tool: implement it in lib/renderer.ts, add its id to the schema, then register it here.
export interface Capability {
  id: EffectId;
  purpose: string;
  useWhen: string;
  avoidWhen: string;
}

export const CAPABILITIES: Capability[] = [
  { id: "punch", purpose: "gentle push-in that settles", useWhen: "a reveal, a beat hit, the hook", avoidWhen: "close-up faces, calm or professional content, two cuts in a row" },
  { id: "shake", purpose: "handheld jitter for impact", useWhen: "real action or a drop in the music", avoidWhen: "talking to camera, selfies, calm scenes" },
  { id: "flash", purpose: "short white flash", useWhen: "the hook or the biggest beat", avoidWhen: "more than twice in one video" },
  { id: "glitch", purpose: "colour-split bursts", useWhen: "edgy, energetic or AI-visual moments", avoidWhen: "wedding, education, product or emotional content" },
  { id: "whip", purpose: "blur streak that links two shots", useWhen: "changing location or outfit between shots", avoidWhen: "inside one continuous moment" },
  { id: "spin", purpose: "the shot swings in from a tilt and settles, a strong hook or transition", useWhen: "the very first piece, or a hard change between very different shots (cars, anime, gym, dance)", avoidWhen: "calm, professional or emotional content, talking to camera, twice in a row" },
  { id: "zoomblur", purpose: "fast lens-pull zoom with a short blur", useWhen: "a reveal or a beat drop, moving from wide to detail", avoidWhen: "faces up close, calm scenes, more than twice in one video" },
  { id: "pulse", purpose: "the picture breathes with the music, a small push on every beat (needs the person's own music)", useWhen: "a high-energy section with a clear beat, the drop or chorus", avoidWhen: "calm scenes, talking, edits without music, the whole video (use on 1 or 2 pieces)" },
  { id: "grain", purpose: "film grain across the whole piece", useWhen: "moody, cinematic, retro or night footage", avoidWhen: "clean product or business content, bright social content" },
  { id: "glow", purpose: "soft bloom on highlights, a dreamy shine", useWhen: "golden hour, lights, cars at night, fashion, romantic or beauty shots", avoidWhen: "gritty action, text-heavy or professional content" },
  { id: "leak", purpose: "a warm light flare that fades over the start of the piece", useWhen: "a transition into a new scene, a memory, a reveal", avoidWhen: "more than twice in one video, talking to camera" },
  { id: "steady", purpose: "calms handheld camera shake", useWhen: "a shaky phone clip that should look smooth (walking, travel, selfie vlogs)", avoidWhen: "fast action where shake is the point, tripod footage" },
];

export function capabilityPrompt(): string {
  const lines = CAPABILITIES.map((c) => `  - "${c.id}": ${c.purpose}. Use when: ${c.useWhen}. Avoid when: ${c.avoidWhen}.`);
  return [
    `- "effects" is a list (0 to 2 items per segment) chosen ONLY from these registered tools. Never invent a tool name:`,
    ...lines,
    `  Choosing NO effect is a valid, often best decision. Most segments should have none. Never use one on every segment, and never put the same effect on two neighbouring segments.`,
    `  Read the content first (talking to camera, dance, action, product, scenery, event) and pick the treatment that serves it; do not apply the same recipe to different kinds of footage.`,
  ].join("\n");
}
