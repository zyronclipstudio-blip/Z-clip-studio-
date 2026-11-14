import { cleanupExpired } from "@/lib/cleanup";
import { num, getSettings } from "@/lib/settings";
import { admin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  cleanupExpired().catch(() => undefined);
  const settings = await getSettings();
  const expires = new Date(Date.now() + num(settings.retention_hours, 24) * 3600_000).toISOString();

  const { data, error } = await admin()
    .from("projects")
    .insert({ owner_id: user.id, status: "uploading", expires_at: expires })
    .select("id")
    .single();
  if (error || !data) return Response.json({ error: "Could not create the project." }, { status: 500 });
  return Response.json({ projectId: data.id });
}
