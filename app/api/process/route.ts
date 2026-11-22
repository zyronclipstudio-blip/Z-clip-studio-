import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createEditPlan } from "@/lib/ai-adapter";
import { analyzeSoundFile } from "@/lib/beats";
import { snapPlanToBeats } from "@/lib/beat-plan";
import { critiquePlan } from "@/lib/critic";
import { trimDeadAir } from "@/lib/silence";
import { dropNearDuplicates, dropWeakShots } from "@/lib/shots";
import { nicheInsight } from "@/lib/insights";
import { reviewInBackground } from "@/lib/review";
import { applyStyleRules } from "@/lib/styles";
import { approvedRules, resolveStyle } from "@/lib/styles-db";
import { transcribeUsedAssets, wordsForPlan } from "@/lib/transcribe";
import { isOwnSoundKey } from "@/lib/sound";
import { PLATFORM_CAP_SECONDS } from "@/lib/config";
import { downloadToWorkDir, removeLocal, rowToAsset } from "@/lib/assets";
import { estimateCredits } from "@/lib/credits";
import { EXPORT_DIR, LIMITS } from "@/lib/config";
import { logEvent, rateLimitDb } from "@/lib/guardian";
import { renderPlan } from "@/lib/renderer";
import { flag, getSettings, num } from "@/lib/settings";
import { uploadBuffer, getDownloadPresignedUrl, B2_BUCKET_EXPORTS } from "@/lib/storage";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { SetupSchema } from "@/lib/types/schema";

export const runtime = "nodejs";
export const maxDuration = 300;

const BodySchema = z.object({
  projectId: z.string().uuid(),
  idempotencyKey: z.string().uuid(),
  approvedCeiling: z.number().int().positive(),
  setup: SetupSchema.default({}),
  soundKey: z.string().max(300).optional(),
  clipVolume: z.number().min(0).max(1).optional(),
  captions: z.boolean().optional(),
});

const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

// Streams newline-delimited JSON so the UI shows real pipeline progress.
// Prototype note: rendering still runs inside this request. The render_jobs table and
// start_render_job() are ready for a separate worker; move the render step there before
// deploying to a host with short request timeouts.
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
    return fail("Invalid request.", 400);
  }

  if (!(await rateLimitDb(`process:${user.id}`, LIMITS.maxProcessPerHour, 3_600_000))) {
    await logEvent("rate_limited", "block", "Process rate limit hit", {}, user.id);
    return fail("You have started too many edits this hour. Please try again later.", 429);
  }
  if (!(await rateLimitDb(`process-day:${user.id}`, LIMITS.maxProcessPerDay, 86_400_000))) {
    await logEvent("daily_cap", "block", "Daily edit cap hit", {}, user.id);
    return fail("You have reached today's edit limit. Please come back tomorrow.", 429);
  }

  const settings = await getSettings();
  if (flag(settings.kill_switch_render)) {
    await logEvent("kill_switch", "block", "Render blocked by kill switch", {}, user.id);
    return fail("Editing is temporarily paused. Please try again later.", 503);
  }

  // RLS: these only return the caller's own rows.
  const { data: project } = await sb.from("projects").select("id").eq("id", body.projectId).maybeSingle();
  if (!project) return fail("Project not found or expired. Please upload your clips again.", 404);
  const { data: rows } = await sb.from("media_assets").select("*").eq("project_id", project.id).order("created_at");
  if (!rows?.length) return fail("This project has no clips. Please upload again.", 404);

  const db = admin();
  const key = `render:${body.idempotencyKey}`;

  // The customer approves a maximum. If the server's figure is now higher (settings changed,
  // different footage), ask them to review again rather than spending beyond what they accepted.
  const est = estimateCredits(rows.reduce((sum: number, r: { duration_sec: number | string }) => sum + Number(r.duration_sec), 0), settings);
  if (body.approvedCeiling < est.ceiling) return fail("The estimate changed. Please review the cost and approve again.", 409);

  // Atomic: claims a render slot and rejects duplicate requests.
  const { data: jobId, error: jobErr } = await db.rpc("start_render_job", {
    p_owner: user.id,
    p_project: project.id,
    p_key: key,
    p_max_global: num(settings.max_concurrent_renders_global, 1),
    p_max_user: num(settings.max_concurrent_renders_per_user, 1),
  });
  if (jobErr || !jobId) {
    const m = jobErr?.message ?? "";
    if (m.includes("duplicate_job")) return fail("This edit has already been started.", 409);
    if (m.includes("render_busy_user")) return fail("You already have an edit running. Wait for it to finish.", 429);
    if (m.includes("render_busy_global")) return fail("ZClip is busy rendering other videos. Please try again in a minute.", 429);
    return fail("Could not start the edit.", 500);
  }

  // Reserve the approved ceiling up front (idempotent per key). Unused credits are released on completion.
  const { data: reservation, error: resErr } = await db.rpc("reserve_credit", {
    p_owner: user.id,
    p_project: project.id,
    p_key: key,
    p_amount: est.ceiling,
    p_meta: { estimated: est.estimated, ceiling: est.ceiling, scheduleVersion: est.scheduleVersion, totalSeconds: est.totalSeconds },
  });
  if (resErr || !reservation) {
    await db.from("render_jobs").update({ status: "failed", failure_code: "no_credit", finished_at: new Date().toISOString() }).eq("id", jobId);
    if (resErr?.message.includes("insufficient_credits")) {
      await logEvent("quota_blocked", "block", "Out of credits", {}, user.id);
      return fail(`You need ${est.ceiling} credits available for this edit. Please add credits or use fewer clips.`, 402);
    }
    return fail("Could not reserve a credit.", 500);
  }

  const assets = rows.map(rowToAsset);
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(obj) + "\n"));
        } catch {
          /* client disconnected */
        }
      };
      let settled = false;
      let charged = 0;
      // Charge `actual` credits (0 = full refund); the rest of the reserved ceiling is released.
      const settle = async (actual: number) => {
        if (settled) return;
        settled = true;
        charged = Math.min(actual, est.ceiling);
        await db.rpc("settle_credit", {
          p_reservation: reservation,
          p_actual: actual,
          p_meta: { scheduleVersion: est.scheduleVersion, estimated: est.estimated, jobId },
        });
      };
      let outputLocal: string | null = null;
      let soundLocal: string | null = null;

      try {
        await db.from("projects").update({ status: "analysing" }).eq("id", project.id);
        send({ type: "stage", stage: "analysing" });
        for (let i = 0; i < assets.length; i++) await downloadToWorkDir(rows[i].object_key as string, assets[i].storedName);

        await db.from("projects").update({ status: "planning" }).eq("id", project.id);
        send({ type: "stage", stage: "planning" });
        const style = await resolveStyle(body.setup.style);
        const lessons = await approvedRules(style?.id).catch(() => [] as string[]);
        const insight = await nicheInsight(style?.id).catch(() => null);
        if (insight) lessons.push(insight);
        const planned = await createEditPlan(assets, body.setup, { allowAI: !flag(settings.kill_switch_ai), style, rules: lessons });

        // Their own sound: find the beats, then cut the edit to them. If anything fails, the edit still works without it.
        if (body.soundKey && isOwnSoundKey(body.soundKey, user.id, project.id)) {
          try {
            soundLocal = await downloadToWorkDir(body.soundKey, `sound-${jobId}${path.extname(body.soundKey)}`);
            const info = await analyzeSoundFile(soundLocal);
            const cap = PLATFORM_CAP_SECONDS[body.setup.platform] ?? PLATFORM_CAP_SECONDS.auto;
            const snapped = snapPlanToBeats(planned.plan, assets, info, body.soundKey, cap);
            if (snapped.sound) {
              snapped.sound.clipVolume = body.clipVolume ?? 0;
              planned.plan = snapped;
            }
            else soundLocal = null;
          } catch {
            soundLocal = null;
          }
        }

        // Word-by-word captions from the clips' own speech. Only when that speech will actually be heard.
        const clipsAudible = !planned.plan.sound || (planned.plan.sound.clipVolume ?? 0) > 0;
        if (body.captions !== false && clipsAudible && !flag(settings.kill_switch_ai)) {
          try {
            const t = await transcribeUsedAssets(planned.plan, assets);
            const used = wordsForPlan(planned.plan, t.words);
            if (used.length >= 3) planned.plan = { ...planned.plan, captions: { enabled: true, style: "pop", words: used } };
            if (t.tokensIn || t.tokensOut)
              await db.from("cost_ledger").insert({ owner_id: user.id, project_id: project.id, render_job_id: jobId, category: "ai", provider: "gemini", detail: { task: "captions", tokensIn: t.tokensIn, tokensOut: t.tokensOut } });
          } catch {
            // No captions is fine.
          }
        }

        // Near-identical shots (a parked car filmed for ten seconds) look like a mistake: keep the first one.
        // Pieces are whole beats long, so removing one keeps the rest on the beat.
        {
          const d = await dropNearDuplicates(planned.plan, assets).catch(() => null);
          if (d && d.dropped > 0) {
            planned.plan = d.plan;
            await logEvent("near_duplicates", "info", `Dropped ${d.dropped} near-identical shot(s)`, { projectId: project.id }, user.id);
          }
        }

        // Shot quality: skip accidental dark or blurry shots (only on edits without a beat-locked sound, so the rhythm is never broken).
        if (!planned.plan.sound) {
          const q = await dropWeakShots(planned.plan, assets).catch(() => null);
          if (q && q.dropped.length) {
            planned.plan = q.plan;
            await logEvent("shot_quality", "info", `Skipped ${q.dropped.length} weak shot(s): ${q.dropped.join(", ")}`, { projectId: project.id }, user.id);
          }
        }

        // Clean-up tools, automatic: cut dead air at the edges of spoken pieces, reduce noise on speech, sharpen lightly.
        {
          const speech = (planned.plan.captions?.words.length ?? 0) >= 3;
          if (speech && clipsAudible && !planned.plan.sound && !flag(settings.kill_switch_ai)) {
            const t = await trimDeadAir(planned.plan, assets).catch(() => null);
            if (t && t.trimmedSec > 0) {
              planned.plan = t.plan;
              await logEvent("dead_air_trim", "info", `Trimmed ${t.trimmedSec}s of dead air`, { projectId: project.id }, user.id);
            }
          }
          planned.plan = { ...planned.plan, polish: { audio: speech && clipsAudible, sharpen: true } };
        }

        // The chosen style's own rules decide effects, captions look and colour, whatever the AI returned.
        planned.plan = applyStyleRules(planned.plan, style);

        // Self-check: repair clear mistakes in the plan (repeated or excess effects, messy ending) before rendering.
        {
          const checked = critiquePlan(planned.plan);
          if (checked.fixes.length) {
            planned.plan = { ...checked.plan, summary: `${checked.plan.summary} Self-check: ${checked.fixes.join(" ")}`.slice(0, 600) };
            await logEvent("self_check", "info", checked.fixes.join(" "), { projectId: project.id }, user.id);
          }
        }

        const { data: last } = await db.from("edit_plans").select("version").eq("project_id", project.id).order("version", { ascending: false }).limit(1);
        await db.from("edit_plans").insert({
          project_id: project.id,
          owner_id: user.id,
          version: ((last?.[0]?.version as number | undefined) ?? 0) + 1,
          source: planned.plan.source,
          plan: planned.plan,
        });
        await db.from("usage_events").insert({
          owner_id: user.id,
          project_id: project.id,
          kind: "edit_plan",
          provider: planned.provider,
          model: planned.model ?? null,
          tokens_in: planned.tokensIn ?? null,
          tokens_out: planned.tokensOut ?? null,
          estimated_cost_usd: planned.estimatedCostUsd ?? null,
        });
        if (planned.provider === "gemini")
          await db.from("cost_ledger").insert({
            owner_id: user.id,
            project_id: project.id,
            render_job_id: jobId,
            category: "ai",
            provider: "gemini",
            estimated_usd: planned.estimatedCostUsd ?? null,
            detail: { model: planned.model, tokensIn: planned.tokensIn, tokensOut: planned.tokensOut },
          });
        if (planned.fallbackReason) await logEvent("ai_fallback", "warn", planned.fallbackReason, { projectId: project.id }, user.id);

        await db.from("projects").update({ status: "rendering", aspect_ratio: planned.plan.aspectRatio, ...setupColumns(body.setup) }).eq("id", project.id);
        const rendered = await renderPlan(planned.plan, assets, (stage) => send({ type: "stage", stage }), soundLocal ?? undefined);
        outputLocal = path.join(EXPORT_DIR, rendered.outputName);
        const ready = rendered.qa.passed;

        let outputKey: string | null = null;
        let outputUrl: string | undefined;
        let downloadUrl: string | undefined;
        if (ready) {
          outputKey = `${user.id}/${project.id}/${rendered.outputName}`;
          await uploadBuffer(B2_BUCKET_EXPORTS, outputKey, await fs.readFile(outputLocal), "video/mp4");
          outputUrl = await getDownloadPresignedUrl(B2_BUCKET_EXPORTS, outputKey, { expiresIn: 3600 });
          downloadUrl = await getDownloadPresignedUrl(B2_BUCKET_EXPORTS, outputKey, { downloadName: "zclip-video.mp4", expiresIn: 3600 });
        }

        // The AI watches its own result and scores it (in the background; it never delays the customer).
        if (ready && flag(settings.ai_review_enabled) && !flag(settings.kill_switch_ai)) {
          await reviewInBackground({ videoPath: outputLocal, durationSec: rendered.durationSec, ownerId: user.id, projectId: project.id, styleId: style?.id ?? "auto", styleName: style?.name ?? "automatic" }).catch(() => undefined);
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
          detail: { renderMs: rendered.renderMs, outputDurationSec: rendered.durationSec, clipCount: assets.length },
        });
        await db.from("projects").update({ status: ready ? "ready" : "qa_failed" }).eq("id", project.id);

        // Charge only for a delivered video; a withheld result is refunded.
        await settle(ready ? est.estimated : 0);
        await logEvent(ready ? "render_done" : "render_withheld", ready ? "info" : "warn", ready ? "Render passed QA" : "Render withheld by QA", { projectId: project.id, renderMs: rendered.renderMs }, user.id);

        const { data: balance } = await db.rpc("credit_balance", { p_owner: user.id });
        send({
          type: "done",
          status: ready ? "ready" : "withheld",
          plan: planned.plan,
          qa: rendered.qa,
          outputUrl,
          downloadUrl,
          credits: balance ?? 0,
          receipt: {
            jobId,
            reserved: est.ceiling,
            consumed: charged,
            released: est.ceiling - charged,
            available: balance ?? 0,
          },
          metrics: {
            provider: planned.provider,
            model: planned.model,
            fallbackReason: planned.fallbackReason,
            renderMs: rendered.renderMs,
            outputDurationSec: rendered.durationSec,
            clipCount: assets.length,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong.";
        await settle(0).catch(() => undefined);
        await db.from("render_jobs").update({ status: "failed", failure_code: "error", finished_at: new Date().toISOString() }).eq("id", jobId);
        await db.from("projects").update({ status: "failed" }).eq("id", project.id);
        await logEvent("process_failed", "warn", message, { projectId: project.id }, user.id);
        send({ type: "error", message: message.includes("FFmpeg") ? message : "We couldn't finish this edit, and no credit was used. Please try again." });
      } finally {
        await removeLocal(assets.map((a: { storedName: string }) => a.storedName));
        if (soundLocal) await fs.unlink(soundLocal).catch(() => undefined);
        if (outputLocal) await fs.unlink(outputLocal).catch(() => undefined);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function setupColumns(s: z.infer<typeof SetupSchema>) {
  return { purpose: s.purpose, mood: s.mood, platform: s.platform };
}
