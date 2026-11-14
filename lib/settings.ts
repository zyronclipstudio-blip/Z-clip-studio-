import { admin } from "./supabase/admin";

// Operational values (caps, kill switches, limits) live in the app_settings table,
// never in code. Cached briefly so a kill switch takes effect within seconds.
type Settings = Record<string, unknown>;
let cache: { at: number; data: Settings } | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache && Date.now() - cache.at < 10_000) return cache.data;
  const { data, error } = await admin().from("app_settings").select("key,value");
  if (error) throw new Error("Could not load settings");
  const s: Settings = {};
  for (const row of data ?? []) s[row.key as string] = row.value;
  cache = { at: Date.now(), data: s };
  return s;
}

export const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
export const flag = (v: unknown): boolean => v === true;
