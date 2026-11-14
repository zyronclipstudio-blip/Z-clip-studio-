import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS. Server-side ONLY: never import this from a
// client component and never expose SUPABASE_SECRET_KEY to the browser.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any, "public", any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function admin(): SupabaseClient<any, "public", any> {
  if (!client) {
    const key = process.env.SUPABASE_SECRET_KEY;
    if (!key) throw new Error("SUPABASE_SECRET_KEY is not set. Add it to .env (server-side only).");
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
