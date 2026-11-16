import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "ZClip (Zyron Clip Studio)",
    short_name: "ZClip",
    description: "Upload your footage. Let ZClip do the editing.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#050505",
    theme_color: "#050505",
    categories: ["video", "productivity"],
    icons: [
      { src: "/icons/zclip-gold.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/zclip-gold.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}