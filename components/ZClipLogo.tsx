"use client";

import React from "react";
import { ZClipMark } from "@/components/ZClipMark";

export function ZClipLogo({
  size = 48,
  variant = "horizontal",
  className = "",
}: {
  size?: number;
  variant?: "icon" | "horizontal" | "vertical" | "badge";
  className?: string;
}) {
  const icon = (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] border border-[#d9b45b]/50 bg-[linear-gradient(145deg,#242017_0%,#0D0D0E_72%)] shadow-[0_0_22px_rgba(217,180,91,0.2),inset_0_1px_0_rgba(255,240,181,0.12)]"
      style={{ width: size, height: size }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_12%,rgba(255,240,181,0.16),transparent_54%)]" />
      <ZClipMark className="relative h-[76%] w-[76%] text-[#d9b45b] drop-shadow-[0_2px_5px_rgba(217,180,91,0.32)]" />
    </span>
  );

  if (variant === "icon") {
    return <span className={`inline-flex items-center ${className}`}>{icon}</span>;
  }

  if (variant === "vertical") {
    return (
      <span className={`inline-flex flex-col items-center gap-2 text-center ${className}`}>
        {icon}
        <span className="flex flex-col items-center">
          <span className="font-display text-xl font-bold leading-none tracking-tight text-white">
            Z<span className="text-[#d9b45b]">Clip</span>
          </span>
          <span className="mt-1 font-mono text-[8px] tracking-[0.2em] text-[#8d97a8]">
            ZYRON CLIP STUDIO
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2.5 ${className}`}>
      {icon}
      <span className="flex min-w-0 flex-col">
        <span className="font-display text-2xl font-bold leading-none tracking-tight text-white">
          Z<span className="text-[#d9b45b]">Clip</span>
        </span>
        <span className="mt-1 font-mono text-[8px] leading-none tracking-[0.18em] text-[#8d97a8]">
          ZYRON CLIP STUDIO
        </span>
      </span>
    </span>
  );
}
