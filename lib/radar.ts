import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { GEMINI_API_KEY, GEMINI_MODEL_CHAIN, isModelGone } from "./config";
import { num } from "./settings";
import { admin } from "./supabase/admin";
import { safeText, scoreRecipe, slugFor, toStyle, type RawRecipe } from "./radar-core";

// The trend radar and the rule learner. Run by the in-app scheduler (see lib/scheduler.ts).
// Nothing here downloads or stores anyone's video: YouTube gives us public links and numbers,
// Gemini watches the public link, and we keep only a short written recipe.
const NICHES: { id: string; q: string }[] = [
  { id: "anime", q: "anime edit amv shorts" },
  { id: "lifestyle", q: "lifestyle vlog aesthetic shorts" },
  { id: "creator", q: "viral creator tips shorts" },
  { id: "gym", q: "gym motivation workout shorts" },
  { id: "travel", q: "travel cinematic shorts" },
  { id: "talking", q: "talking to camera storytime shorts" },
  { id: "dance", q: "dance trend shorts" },
  { id: "fashion", q: "outfit fashion grwm shorts" },
];

interface Candidate { id: string; title: string; views: number; ageDays: number }

async function yt(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const url = `https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({ ...params, key })}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`YouTube ${res.status}`);
  return res.json();
}

async function topShorts(q: string, take: number): Promise<Candidate[]> {
  const after = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const found = (await yt("search", { part: "snippet", type: "video", videoDuration: "short", order: "viewCount", maxResults: "12", q, publishedAfter: after })) as { items?: { id?: { videoId?: string } }[] };
  const ids = (found.items ?? []).map((i) => i.id?.videoId).filter((x): x is string => Boolean(x));
  if (!ids.length) return [];
  const vids = (await yt("videos", { part: "statistics,snippet", id: ids.join(",") })) as { items?: { id: string; statistics?: { viewCount?: string }; snippet?: { title?: string; publishedAt?: string } }[] };
  return (vids.items ?? [])
    .map((v) => ({ id: v.id, title: v.snippet?.title ?? "", views: Number(v.statistics?.viewCount ?? 0), ageDays: Math.max(1, (Date.now() - Date.parse(v.snippet?.publishedAt ?? "")) / 86_400_000) || 1 }))
    .filter((c) => c.views > 0)
    .sort((a, b) => b.views / b.ageDays - a.views / a.ageDays)
    .slice(0, take);
}

const RECIPE_PROMPT = `You are studying a short video to learn its EDITING style, so an automatic editor can imitate the style on different footage.
Ignore the people and the topic; describe only HOW it is edited. Return ONLY JSON:
{"name":"2-3 word style name","tagline":"under 8 words","pacing":"fast|medium|slow","effects":["punch","shake","flash","glitch","whip"],"maxShare":0.0-0.5,"captions":"pop|clean|off","look":"none|soft|punchy|cinematic","directorNote":"2-4 sentences telling an editor how to cut footage in this style: hook, cut rhythm, how it ends, what makes it work","quality":0-100}
"effects" lists ONLY effects you actually see, chosen from: punch (push-in), shake (jitter), flash (white flash), glitch (colour split), whip (blur transition). Use [] if none.
"maxShare" is the share of cuts that carry an effect. "quality" is how clearly this video shows a repeatable editing style (0 = unclear).
Do not mention names, brands, links, or anything the video says. Describe technique only.`;

async function recipeFromVideo(ai: InstanceType<typeof GoogleGenAI>, videoId: string): Promise<RawRecipe | null> {
  const contents = [{ role: "user", parts: [{ fileData: { fileUri: `https://www.youtube.com/watch?v=${videoId}` } }, { text: RECIPE_PROMPT }] }];
  for (const model of GEMINI_MODEL_CHAIN) {
    try {
      const res = await ai.models.generateContent({ model, contents, config: { responseMimeType: "application/json", temperature: 0.2 } });
      return JSON.parse((res.text ?? "").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()) as RawRecipe;
    } catch (e) {
      if (isModelGone(e instanceof Error ? e.message : "")) continue;
      return null;
    }
  }
  return null;
}

export async function runRadar(settings: Record<string, unknown>): Promise<{ analysed: number; approved: number; drafted: number }> {
  if (!GEMINI_API_KEY || !process.env.YOUTUBE_API_KEY) return { analysed: 0, approved: 0, drafted: 0 };
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const minScore = num(settings.radar_auto_approve_min_score, 60);
  const perNiche = num(settings.radar_per_niche, 2);
  const db = admin();
  let analysed = 0, approved = 0, drafted = 0;

  for (const niche of NICHES) {
    let cands: Candidate[] = [];
    try { cands = await topShorts(niche.q, perNiche + 2); } catch { continue; }
    let done = 0;
    for (const c of cands) {
      if (done >= perNiche) break;
      const slug = slugFor(c.id);
      const { data: have } = await db.from("style_recipes").select("id").eq("slug", slug).maybeSingle();
      if (have) continue;
      const raw = await recipeFromVideo(ai, c.id);
      done++;
      analysed++;
      const style = raw ? toStyle(raw, slug) : null;
      if (!style) continue;
      const score = scoreRecipe(c.views, c.ageDays, style.quality);
      const status = score >= minScore ? "approved" : "draft"; // the AI approves itself; the bar is a setting
      if (status === "approved") approved++;
      else drafted++;
      const rules = { id: style.id, name: style.name, tagline: style.tagline, pacing: style.pacing, effects: style.effects, captions: style.captions, look: style.look, directorNote: style.directorNote };
      await db.from("style_recipes").insert({
        slug, name: `${style.name}`, audience: niche.id, rules, source_url: `https://www.youtube.com/watch?v=${c.id}`, source_views: c.views, score, status,
      });
    }
  }
  return { analysed, approved, drafted };
}

// Turns many people's complaints into short rules the editor reads before every edit.
const RulesOut = z.array(z.object({ rule: z.string(), scope: z.string().catch("all"), support: z.array(z.number()).catch([]) }));

export async function learnRules(settings: Record<string, unknown>): Promise<{ rules: number }> {
  if (!GEMINI_API_KEY) return { rules: 0 };
  const db = admin();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await db.from("feedback_events").select("owner_id, detail").eq("signal", "complaint").gte("created_at", since).limit(300);
  const items = (data ?? []).map((r) => ({ owner: r.owner_id as string, text: String((r.detail as { text?: string })?.text ?? "").slice(0, 200) })).filter((x) => x.text.length > 2);
  if (items.length < 3) return { rules: 0 };
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const list = items.map((x, i) => `${i}: ${x.text}`).join("\n");
  const prompt = `Customers of a video editor complained about their edits. Group the complaints into at most 8 general, actionable editing rules for the editor. Each rule is one short imperative sentence under 160 characters (for example "Do not zoom on close-up selfies."), with a scope: "all" or a style id (clean, lifestyle, creator, anime, gym, travel, talking, cinematic). Ignore complaints that are about the app, the song choice, or are unclear. Return ONLY JSON: [{"rule":"...","scope":"all","support":[indexes of the complaints behind it]}]\n\n${list}`;
  let out: z.infer<typeof RulesOut> = [];
  for (const model of GEMINI_MODEL_CHAIN) {
    try {
      const res = await ai.models.generateContent({ model, contents: prompt, config: { responseMimeType: "application/json", temperature: 0.2 } });
      out = RulesOut.parse(JSON.parse((res.text ?? "[]").replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()));
      break;
    } catch (e) {
      if (!isModelGone(e instanceof Error ? e.message : "")) return { rules: 0 };
    }
  }
  const minUsers = num(settings.rules_min_distinct_users, 5);
  let n = 0;
  for (const r of out.slice(0, 8)) {
    const rule = safeText(r.rule, 160);
    if (!rule) continue;
    const users = new Set(r.support.map((i) => items[i]?.owner).filter(Boolean));
    const status = users.size >= minUsers ? "approved" : "draft"; // needs several different people, not one loud one
    await db.from("learned_rules").upsert({ scope: safeText(r.scope, 20) ?? "all", rule, evidence_count: Math.max(1, users.size), status }, { onConflict: "scope,rule" });
    n++;
  }
  return { rules: n };
}
