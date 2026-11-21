import type { CutSegment, EditPlan, EffectId } from "./types/schema";

// Fixes the customer asks for in plain words. Simple, certain requests are handled here with no AI and no cost.
// Anything else goes to the AI (lib/revise-ai.ts). Feedback itself never costs credits.
export interface Revision {
  plan: EditPlan;
  changes: string[];
  handled: boolean; // false when the request needs the AI
}

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

function stripEffects(plan: EditPlan, which: EffectId[] | "all"): { plan: EditPlan; count: number } {
  let count = 0;
  const segments: CutSegment[] = plan.segments.map((s) => {
    const next = which === "all" ? [] : (s.effects ?? []).filter((e) => !which.includes(e));
    count += (s.effects ?? []).length - next.length;
    return { ...s, effects: next };
  });
  return { plan: { ...plan, segments }, count };
}

export function reviseByRules(plan: EditPlan, feedback: string): Revision {
  const t = feedback.toLowerCase();
  let cur = plan;
  const changes: string[] = [];

  if (has(t, "no effect", "without effect", "remove effect", "too many effect", "too much effect", "too busy", "plain")) {
    const r = stripEffects(cur, "all");
    cur = r.plan;
    if (r.count) changes.push(`Removed all ${r.count} effects.`);
  } else {
    const kinds: [string[], EffectId[], string][] = [
      [["zoom", "punch", "push in", "push-in"], ["punch"], "zoom"],
      [["shake", "shaky", "jitter"], ["shake"], "shake"],
      [["flash", "flashing", "white flash"], ["flash"], "flash"],
      [["glitch"], ["glitch"], "glitch"],
      [["blur", "whip"], ["whip"], "blur"],
    ];
    for (const [words, ids, label] of kinds) {
      if (has(t, ...words) && has(t, "much", "less", "remove", "no ", "too", "stop", "hate", "don't", "dont", "without", "annoying")) {
        const r = stripEffects(cur, ids);
        cur = r.plan;
        if (r.count) changes.push(`Removed ${r.count} ${label} effect${r.count > 1 ? "s" : ""}.`);
      }
    }
  }

  if (has(t, "fade") && has(t, "no ", "remove", "hate", "without", "too")) {
    const segments = cur.segments.map((s) => (s.transition === "fade" ? { ...s, transition: "cut" as const } : s));
    cur = { ...cur, segments };
    changes.push("Changed fades to straight cuts.");
  }

  if (cur.sound && has(t, "original sound", "background sound", "background audio", "silence", "mute the clip", "clips sound")) {
    const quiet = has(t, "silence", "mute", "remove", "off", "no ");
    cur = { ...cur, sound: { ...cur.sound, clipVolume: quiet ? 0 : 0.2 } };
    changes.push(quiet ? "Silenced the clips' own sound." : "Lowered the clips' own sound.");
  }

  if (cur.captions && has(t, "caption", "subtitle", "text on screen") && has(t, "remove", "no ", "off", "hate", "without")) {
    cur = { ...cur, captions: { ...cur.captions, enabled: false } };
    changes.push("Turned captions off.");
  }

  return { plan: cur, changes, handled: changes.length > 0 };
}
