import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { isOwnSoundKey } from "@/lib/sound";
import { downloadToWorkDir, removeLocal, rowToAsset } from "@/lib/assets";
import { EXPORT_DIR, LIMITS, PLATFORM_CAP_SECONDS } from "@/lib/config";
import { logEvent, rateLimitDb } from "@/lib/guardian";
import { PlanOpError, validatePlan } from "@/lib/plan-ops";
import { renderPlan } from "@/lib/renderer";
import { flag, getSettings, num } from "@/lib/settings";
import { B2_BUCKET_EXPORTS, getDownloadPresignedUrl, uploadBuffer } from "@/lib/storage";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { EditPlanSchema } from "@/lib/types/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

// Re-renders a plan the customer adjusted by hand. No AI call and no new credit charge:
// manual fixes are fair-use, protected by the same render slots, a kill switch and a rate limit.
const BodySchema = z.object({
  projectId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  plan: EditPlanSchema,
});

const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return fail("Please sign in.", 401);

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return fail("That edit could not be read. Please try again.", 400);
  }

  if (!(await rateLimitDb(`rerender:${user.id}`, LIMITS.maxProcessPerHour * 3, 3_600_000))) {
    await logEvent("rate_limited", "block", "Re-render rate limit hit", {}, user.id);
    return fail("You have made a lot of changes this hour. Please try again a little later.", 429);
  }

  const settings = await getSettings();
  if (flag(settings.kill_switch_render)) return fail("Editing is temporarily paused. Please try again later.", 503);

  const { data: project } = await sb.from("projects").select("id, platform").eq("id", body.projectId).maybeSingle();
  if (!project) return fail("Project not found or expired. Please upload your clips again.", 404);
  const { data: rows } = await sb.from("media_assets").select("*").eq("project_id", project.id).order("created_at");
  if (!rows?.length) return fail("This project has no clips. Please upload again.", 404);

  const assets = rows.map(rowToAsset);
  const platform = (project.platform as keyof typeof PLATFORM_CAP_SECONDS | null) ?? "auto";
  const cap = PLATFORM_CAP_SECONDS[platform] ?? PLATFORM_CAP_SECONDS.auto;

  // Never trust the browser: re-validate every cut against the real clips on the server.
  let plan = body.plan;
  try {
    plan = validatePlan(body.plan, assets, cap);
  } catch (e) {
    return fail(e instanceof PlanOpError ? e.message : "That edit is not valid.", 422);
  }

  const db = admin();
  const { data: jobId, error: jobErr } = await db.rpc("start_render_job", {
    p_owner: user.id,
    p_project: project.id,
    p_key: `rerender:${body.idempotencyKey}`,
    p_max_global: num(settings.max_concurrent_renders_global, 1),
    p_max_user: num(settings.max_concurrent_renders_per_user, 1),
  });
  if (jobErr || !jobId) {
    const m = jobErr?.message ?? "";
    if (m.includes("duplicate_job")) return fail("This change has already been sent.", 409);
    if (m.includes("render_busy_user")) return fail("You already have an edit running. Wait for it to finish.", 429);
    if (m.includes("render_busy_global")) return fail("ZClip is busy rendering other videos. Please try again in a minute.", 429);
    return fail("Could not start the render.", 500);
  }

  let outputLocal: string | null = null;
  try {
    for (let i = 0; i < assets.length; i++) await downloadToWorkDir(rows[i].object_key as string, assets[i].storedName);
    let soundLocal: string | undefined;
    if (plan.sound) {
      if (!isOwnSoundKey(plan.sound.key, user.id, project.id)) throw new Error("That sound does not belong to this project.");
      soundLocal = await downloadToWorkDir(plan.sound.key, `sound-${jobId}${path.extname(plan.sound.key)}`).catch(() => undefined);
    }
    const rendered = await renderPlan(plan, assets, undefined, soundLocal).finally(() => (soundLocal ? fs.unlink(soundLocal).catch(() => undefined) : undefined));
    outputLocal = path.join(EXPORT_DIR, rendered.outputName);
    const ready = rendered.qa.passed;

    let outputUrl: string | undefined;
    let downloadUrl: string | undefined;
    let outputKey: string | null = null;
    if (ready) {
      outputKey = `${user.id}/${project.id}/${rendered.outputName}`;
      await uploadBuffer(B2_BUCKET_EXPORTS, outputKey, await fs.readFile(outputLocal), "video/mp4");
      outputUrl = await getDownloadPresignedUrl(B2_BUCKET_EXPORTS, outputKey, { expiresIn: 3600 });
      downloadUrl = await getDownloadPresignedUrl(B2_BUCKET_EXPORTS, outputKey, { downloadName: "zclip-video.mp4", expiresIn: 3600 });

      const { data: last } = await db.from("edit_plans").select("version").eq("project_id", project.id).order("version", { ascending: false }).limit(1);
      await db.from("edit_plans").insert({
        project_id: project.id,
        owner_id: user.id,
        version: ((last?.[0]?.version as number | undefined) ?? 0) + 1,
        source: plan.source,
        plan,
      });
      await db.from("projects").update({ status: "ready" }).eq("id", project.id);
    }
    await db.from("quality_reports").insert({
      render_job_id: jobId,
      project_id: project.id,
      owner_id: user.id,
      technical: { checks: rendered.qa.hardChecks },
      defects: rendered.qa.hardChecks.filter((c) => !c.ok),
      corrections: [],
      passed: ready,
    });
    await db.from("render_jobs").update({
      status: ready ? "succeeded" : "failed",
      failure_code: ready ? null : "qa_failed",
      runtime_ms: rendered.renderMs,
      output_object_key: outputKey,
      finished_at: new Date().toISOString(),
    }).eq("id", jobId);
    await db.from("cost_ledger").insert({
      owner_id: user.id,
      project_id: project.id,
      render_job_id: jobId,
      category: "compute",
      detail: { renderMs: rendered.renderMs, outputDurationSec: rendered.durationSec, clipCount: assets.length, manual: true },
    });
    await logEvent(ready ? "rerender_done" : "rerender_withheld", ready ? "info" : "warn", ready ? "Manual re-render passed QA" : "Manual re-render withheld by QA", { projectId: project.id }, user.id);

    return Response.json(
      {
        status: ready ? "ready" : "withheld",
        plan,
        qa: rendered.qa,
        outputUrl,
        downloadUrl,
        metrics: { renderMs: rendered.renderMs, outputDurationSec: rendered.durationSec, clipCount: assets.length },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    await db.from("render_jobs").update({ status: "failed", failure_code: "error", finished_at: new Date().toISOString() }).eq("id", jobId);
    await logEvent("rerender_failed", "warn", message, { projectId: project.id }, user.id);
    return fail("We couldn't render that change. Your earlier video is still saved.", 500);
  } finally {
    await removeLocal(assets.map((a) => a.storedName));
    if (outputLocal) await fs.unlink(outputLocal).catch(() => undefined);
  }
}
