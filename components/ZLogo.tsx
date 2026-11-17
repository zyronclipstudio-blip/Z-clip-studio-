"use client";

import { ZClipMark } from "@/components/ZClipMark";

export function ZLogo({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  const baseClass = "relative inline-flex shrink-0 select-none items-center justify-center rounded-[24%] border border-[#d9b45b]/45 bg-[linear-gradient(145deg,#211D14_0%,#101011_72%)] shadow-[0_0_18px_rgba(217,180,91,0.16),inset_0_1px_0_rgba(255,240,181,0.12)]";
  return (
    <span
      className={animated ? baseClass + " animate-pulse" : baseClass}
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_30%_12%,rgba(255,240,181,0.16),transparent_55%)]" />
      <ZClipMark className="relative h-[72%] w-[72%] text-[#d9b45b] drop-shadow-[0_2px_6px_rgba(217,180,91,0.34)]" />
    </span>
  );
}
