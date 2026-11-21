import { listStyles } from "@/lib/styles-db";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });
  return Response.json({ styles: await listStyles() }, { headers: { "Cache-Control": "no-store" } });
}
