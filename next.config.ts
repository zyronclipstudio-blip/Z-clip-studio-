import type { NextConfig } from "next";

// Uploads go straight to private storage (signed URLs), so no body-size limit is needed here.
const nextConfig: NextConfig = {
  env: {
    // Public Supabase keys (safe to commit — already exposed in the browser bundle by design).
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://rxipwrkdygmtkqskgsdw.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_Xiay_mku9NaZh5xLDRXNHg_1LHJnvI9",
  },
  async headers() {
    return [
      {
        // Always revalidate the service worker so updates and kill-fixes ship immediately.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
