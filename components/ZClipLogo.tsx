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
    <span className="inline-flex shrink-0" style={{ width: size, height: size }}>
      <ZClipMark className="h-full w-full" />
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
          <span className="text-xl font-extrabold leading-none tracking-[0.18em] text-[#f3eee2]">
            Z<span className="text-[#d9b45b]">CLIP</span>
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
        <span className="text-xl font-extrabold leading-none tracking-[0.18em] text-[#f3eee2]">
          Z<span className="text-[#d9b45b]">CLIP</span>
        </span>
        <span className="mt-1 font-mono text-[8px] leading-none tracking-[0.18em] text-[#8d97a8]">
          ZYRON CLIP STUDIO
        </span>
      </span>
    </span>
  );
}
