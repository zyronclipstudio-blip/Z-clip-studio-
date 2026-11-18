import { execFile } from "node:child_process";
import { admin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const has = (name: string) => Boolean(process.env[name] && process.env[name]!.trim().length > 0);

function ffmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(process.env.FFMPEG_PATH || "ffmpeg", ["-version"], { timeout: 4000 }, (err) => resolve(!err));
  });
}

// Real database test with the secret key: reports only a short code, never a value.
async function databaseAccess(): Promise<{ ok: boolean; code?: string }> {
  try {
    const { error } = await admin().from("projects").select("id").limit(1);
    return error ? { ok: false, code: error.code || error.message.slice(0, 60) } : { ok: true };
  } catch (e) {
    return { ok: false, code: e instanceof Error ? e.message.slice(0, 60) : "error" };
  }
}

// Reports which settings and tools are present. It never returns a value, only yes or no.
export async function GET() {
  const checks = {
    supabaseUrl: has("NEXT_PUBLIC_SUPABASE_URL"),
    supabasePublishableKey: has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    supabaseSecretKey: has("SUPABASE_SECRET_KEY"),
    storageKeyId: has("B2_KEY_ID"),
    storageApplicationKey: has("B2_APPLICATION_KEY"),
    geminiKey: has("GEMINI_API_KEY"),
    ffmpeg: await ffmpegAvailable(),
  };
  const database = await databaseAccess();
  const required = ["supabaseUrl", "supabasePublishableKey", "supabaseSecretKey", "storageKeyId", "storageApplicationKey", "ffmpeg"] as const;
  const missing = required.filter((k) => !checks[k]);
  return Response.json(
    { ok: missing.length === 0 && database.ok, missing, checks, database, time: new Date().toISOString() },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
