import { getSettings, num, flag } from "./settings";
import { admin } from "./supabase/admin";
import { logEvent } from "./guardian";
import { learnRules, runRadar } from "./radar";

// The AI's daily homework: find what is trending, learn the styles, learn rules from complaints.
// It approves its own work using the bars in app_settings. One instance runs it at a time (claimed in the database).
export async function radarTick(): Promise<void> {
  const settings = await getSettings();
  if (!flag(settings.radar_enabled) || flag(settings.kill_switch_ai)) return;
  const hours = num(settings.radar_interval_hours, 24);
  const db = admin();
  const { data: row } = await db.from("app_settings").select("value, updated_at").eq("key", "radar_last_run").maybeSingle();
  if (!row) return;
  const last = Date.parse(String(row.value)) || 0;
  if (Date.now() - last < hours * 3_600_000) return;
  // Claim the run: only the instance whose update matches the old timestamp wins.
  const { data: won } = await db.from("app_settings").update({ value: new Date().toISOString() }).eq("key", "radar_last_run").eq("updated_at", row.updated_at as string).select("key");
  if (!won?.length) return;
  try {
    const r = await runRadar(settings);
    const l = await learnRules(settings);
    await logEvent("radar_run", "info", `Radar: ${r.analysed} analysed, ${r.approved} approved, ${r.drafted} drafted; ${l.rules} rules`, { ...r, ...l });
  } catch (e) {
    await logEvent("radar_run", "warn", e instanceof Error ? e.message.slice(0, 200) : "Radar failed", {});
  }
}
