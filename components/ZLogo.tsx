"use client";

import { ZClipTile } from "@/components/ZClipMark";

export function ZLogo({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <span className={`inline-flex select-none ${animated ? "animate-pulse" : ""}`}><ZClipTile size={size} /></span>
  );
}
