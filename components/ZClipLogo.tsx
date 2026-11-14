"use client";

import React from "react";

export function ZClipLogo({
  size = 48,
  variant = "horizontal", // "icon" | "horizontal" | "vertical" | "badge"
  className = "",
}: {
  size?: number;
  variant?: "icon" | "horizontal" | "vertical" | "badge";
  className?: string;
}) {
  const icon = (
    <div
      className="relative flex items-center justify-center shrink-0 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,212,255,0.45)]"
      style={{ width: size, height: size }}
    >
      <img
        src="/icons/zclip-hero-logo.jpg"
        alt="ZClip 3D Structural Logo"
        className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
      />
    </div>
  );

  if (variant === "icon") {
    return <div className={`inline-flex items-center ${className}`}>{icon}</div>;
  }

  if (variant === "vertical") {
    return (
      <div className={`flex flex-col items-center gap-1.5 text-center ${className}`}>
        {icon}
        <div className="font-display font-extrabold tracking-tight text-white flex items-center text-xl">
          Z<span className="text-[#00D4FF]">Clip</span>
        </div>
        <p className="text-[10px] tracking-widest text-[#9AA8BA] uppercase font-sans">
          Edit. Create. Share.
        </p>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {icon}
      <div className="flex flex-col">
        <div className="font-display font-extrabold tracking-tight text-white flex items-center text-2xl leading-none">
          Z<span className="text-[#00D4FF]">Clip</span>
        </div>
        <span className="text-[10px] font-sans tracking-widest text-[#9AA8BA] uppercase mt-1 leading-none">
          Edit. Create. Share.
        </span>
      </div>
    </div>
  );
}
