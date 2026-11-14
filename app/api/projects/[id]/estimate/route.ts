import { estimateCredits } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Preflight: what this edit is expected to cost, the maximum the customer would authorise,
// and the balance before and after. Read with RLS (the caller's own project only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const { data: project } = await sb.from("projects").select("id").eq("id", id).maybeSingle();
  if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
  const { data: rows } = await sb.from("media_assets").select("duration_sec").eq("project_id", id);
  if (!rows?.length) return Response.json({ error: "This project has no clips." }, { status: 404 });

  const totalSeconds = rows.reduce((s: number, r: { duration_sec: number | string }) => s + Number(r.duration_sec), 0);
  const est = estimateCredits(totalSeconds, await getSettings());
  const { data: balance } = await sb.rpc("my_credit_balance");
  const available = (balance as number | null) ?? 0;

  return Response.json(
    {
      ...est,
      available,
      afterEstimate: available - est.estimated,
      afterCeiling: available - est.ceiling,
      sufficient: available >= est.ceiling,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
