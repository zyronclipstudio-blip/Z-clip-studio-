import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Per-request client that acts AS the signed-in user, so row-level security applies.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient(): Promise<SupabaseClient<any, "public", any>> {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list: { name: string; value: string; options: Record<string, unknown> }[]) => {
          try {
            list.forEach(({ name, value, options }) => (store as any).set(name, value, options));
          } catch {
            /* called from a Server Component; middleware refreshes the session */
          }
        },
      },
    },
  );
}
