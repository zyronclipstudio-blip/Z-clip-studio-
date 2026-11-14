import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// The signed-in user's own allowance and plan (read with RLS, no service role).
export async function GET() {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return Response.json({ error: "Please sign in." }, { status: 401 });

  const [{ data: credits }, { data: sub }] = await Promise.all([
    sb.rpc("my_credit_balance"),
    sb.from("subscriptions").select("plan,status").maybeSingle(),
  ]);
  return Response.json(
    { email: user.email, credits: credits ?? 0, plan: sub?.plan ?? "free", status: sub?.status ?? "active" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
