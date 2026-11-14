import type { NextConfig } from "next";

// Uploads go straight to private storage (signed URLs), so no body-size limit is needed here.
const nextConfig: NextConfig = {
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
