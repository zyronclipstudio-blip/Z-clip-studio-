"use client";

import { ZClipMark } from "@/components/ZClipMark";

export function ZLogo({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 select-none ${animated ? "animate-pulse" : ""}`} style={{ width: size, height: size }}>
      <ZClipMark className="h-full w-full" />
    </span>
  );
}
