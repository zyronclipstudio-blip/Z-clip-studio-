import { z } from "zod";
import { rowToAsset } from "@/lib/assets";
import { PLATFORM_CAP_SECONDS, LIMITS } from "@/lib/config";
import { logEvent, rateLimitDb } from "@/lib/guardian";
import { PlanOpError, validatePlan } from "@/lib/plan-ops";
import { reviseByRules } from "@/lib/revise";
import { reviseWithGemini } from "@/lib/revise-ai";
import { flag, getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { EditPlanSchema } from "@/lib/types/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

// "Change this": the customer says what is wrong in their own words and gets a corrected PLAN back.
// Reporting a problem never costs credits. The corrected plan is rendered through /api/rerender.
const BodySchema = z.object({
  projectId: z.string().uuid(),
  plan: EditPlanSchema,
  feedback: z.string().trim().min(2).max(500),
});

const fail = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return fail("Please sign in.", 401);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return fail("Please describe what you want changed in a few words.", 400);
  }

  if (!(await rateLimitDb(`revise:${user.id}`, LIMITS.maxProcessPerHour * 3, 3_600_000))) return fail("You have sent a lot of changes this hour. Please try again a little later.", 429);

  const settings = await getSettings();
  if (flag(settings.kill_switch_render)) return fail("Editing is temporarily paused. Please try again later.", 503);

  const { data: project } = await sb.from("projects").select("id, platform").eq("id", body.projectId).maybeSingle();
  if (!project) return fail("Project not found or expired.", 404);
  const { data: rows } = await sb.from("media_assets").select("*").eq("project_id", project.id).order("created_at");
  if (!rows?.length) return fail("This project has no clips.", 404);
  const assets = rows.map(rowToAsset);
  const platform = (project.platform as keyof typeof PLATFORM_CAP_SECONDS | null) ?? "auto";
  const cap = PLATFORM_CAP_SECONDS[platform] ?? PLATFORM_CAP_SECONDS.auto;

  try {
    validatePlan(body.plan, assets, cap);
  } catch (e) {
    return fail(e instanceof PlanOpError ? e.message : "That edit is not valid.", 422);
  }

  // Certain, simple requests are done on the spot with no AI. Everything else goes to the AI.
  const rules = reviseByRules(body.plan, body.feedback);
  let plan = rules.plan;
  let explanation = rules.changes.join(" ");
  let usedAI = false;

  if (!rules.handled) {
    if (flag(settings.kill_switch_ai)) return fail("The AI is paused right now. You can still change the edit by hand.", 503);
    try {
      const r = await reviseWithGemini(body.plan, assets, body.feedback, cap);
      plan = validatePlan(r.plan, assets, cap);
      explanation = r.explanation || "I adjusted the edit.";
      usedAI = true;
    } catch {
      return fail("I couldn't work that one out. Try saying it another way, or use the editor below.", 502);
    }
  }

  // Learning signal: what was complained about (text only, no media). Used to learn rules from many users.
  await admin().from("feedback_events").insert({ owner_id: user.id, project_id: project.id, signal: "complaint", detail: { text: body.feedback.slice(0, 300), usedAI, changed: rules.handled || usedAI } });
  await logEvent("revise", "info", usedAI ? "Plan revised by AI" : "Plan revised by rules", { projectId: project.id, usedAI }, user.id);
  return Response.json({ plan, explanation, usedAI, changed: JSON.stringify(plan.segments) !== JSON.stringify(body.plan.segments) || plan.sound?.clipVolume !== body.plan.sound?.clipVolume || plan.captions?.enabled !== body.plan.captions?.enabled }, { headers: { "Cache-Control": "no-store" } });
}
