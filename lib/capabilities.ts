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
