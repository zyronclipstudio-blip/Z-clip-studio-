import { admin } from "./supabase/admin";
import { STYLES, styleById, type Style } from "./styles";

// Built-in styles plus the ones the radar learned and approved.
export async function resolveStyle(id?: string): Promise<Style | undefined> {
  const built = styleById(id);
  if (built || !id || id === "auto" || !id.startsWith("radar-")) return built;
  const { data } = await admin().from("style_recipes").select("slug,name,rules").eq("slug", id).eq("status", "approved").maybeSingle();
  if (!data) return undefined;
  return { ...(data.rules as Style), id: data.slug as string, name: data.name as string };
}

export async function listStyles(): Promise<{ id: string; name: string; tagline: string }[]> {
  const { data } = await admin().from("style_recipes").select("slug,name,rules,score").eq("status", "approved").order("score", { ascending: false }).limit(12);
  const learned = (data ?? []).map((r) => ({ id: r.slug as string, name: r.name as string, tagline: String((r.rules as Style)?.tagline ?? "Learned from what's trending") }));
  return [...STYLES.map((s) => ({ id: s.id, name: s.name, tagline: s.tagline })), ...learned];
}

export async function approvedRules(styleId?: string): Promise<string[]> {
  const { data } = await admin().from("learned_rules").select("rule,scope,evidence_count").eq("status", "approved").order("evidence_count", { ascending: false }).limit(12);
  return (data ?? []).filter((r) => r.scope === "all" || r.scope === styleId).map((r) => r.rule as string).slice(0, 8);
}
