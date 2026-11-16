import { admin } from "./supabase/admin";
import { deleteObjects, B2_BUCKET_CLIPS, B2_BUCKET_EXPORTS } from "./storage";

// Deletes the real stored files (not just database rows) once retention passes.
// Called opportunistically from the API; also schedule it (cron / Supabase scheduled function)
// so cleanup does not depend on traffic.
export async function cleanupExpired(): Promise<{ clips: number; exports: number; projects: number }> {
  const db = admin();
  const now = new Date().toISOString();
  const out = { clips: 0, exports: 0, projects: 0 };

  const { data: assets } = await db.from("media_assets").select("id, object_key").lt("retention_expires_at", now).limit(200);
  if (assets?.length) {
    const keys = assets.map((a) => a.object_key as string);
    await deleteObjects(B2_BUCKET_CLIPS, keys).catch(() => undefined);
    await db.storage.from("clips").remove(keys).catch(() => undefined);
    await db.from("media_assets").delete().in("id", assets.map((a) => a.id as string));
    out.clips = assets.length;
  }

  const { data: expiredProjects } = await db.from("projects").select("id").lt("expires_at", now).neq("status", "expired").neq("status", "ready").limit(200);
  if (expiredProjects?.length) {
    const ids = expiredProjects.map((p) => p.id as string);
    const { data: jobs } = await db.from("render_jobs").select("id, output_object_key").in("project_id", ids).not("output_object_key", "is", null);
    if (jobs?.length) {
      const exportKeys = jobs.map((j) => j.output_object_key as string);
      await deleteObjects(B2_BUCKET_EXPORTS, exportKeys).catch(() => undefined);
      await db.storage.from("exports").remove(exportKeys).catch(() => undefined);
      await db.from("render_jobs").update({ output_object_key: null }).in("id", jobs.map((j) => j.id as string));
      out.exports = jobs.length;
    }
    await db.from("projects").update({ status: "expired" }).in("id", ids);
    out.projects = ids.length;
  }

  // Projects abandoned before any clip was finalised.
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const { data: stale } = await db.from("projects").select("id").in("status", ["draft", "uploading"]).lt("created_at", hourAgo).limit(200);
  for (const p of stale ?? []) {
    const { count } = await db.from("media_assets").select("id", { count: "exact", head: true }).eq("project_id", p.id as string);
    if (!count) await db.from("projects").delete().eq("id", p.id as string);
  }
  return out;
}
