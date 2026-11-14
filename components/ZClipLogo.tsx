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
  // SVG metallic gradient 3D futuristic Z with embedded play triangle and orbital light ring
  const icon = (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Outer Cyan / Neon Glow */}
      <div className="absolute inset-0 rounded-2xl bg-[#001AFF]/30 blur-xl pointer-events-none" />
      <div className="absolute inset-0 rounded-2xl bg-[#00D4FF]/25 blur-md pointer-events-none" />

      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(0,212,255,0.7)]"
      >
        <defs>
          {/* Metallic Cyan / Deep Blue Gradient */}
          <linearGradient id="zGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E6F8FF" />
            <stop offset="25%" stopColor="#00D4FF" />
            <stop offset="60%" stopColor="#0075FF" />
            <stop offset="100%" stopColor="#001AFF" />
          </linearGradient>

          {/* Chrome Edge Highlights */}
          <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#00D4FF" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#001AFF" stopOpacity="0.8" />
          </linearGradient>

          {/* Ring Glow */}
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="50%" stopColor="#0075FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00D4FF" />
          </linearGradient>
        </defs>

        {/* Orbit Ring */}
        <ellipse
          cx="60"
          cy="60"
          rx="52"
          ry="38"
          stroke="url(#ringGrad)"
          strokeWidth="3.5"
          transform="rotate(-25 60 60)"
          strokeDasharray="180 30"
          className="opacity-90"
        />

        {/* Crown Accent at Top */}
        <path
          d="M50 16 L54 22 L60 14 L66 22 L70 16 L67 25 H53 Z"
          fill="#00D4FF"
          opacity="0.9"
        />

        {/* Futuristic 3D Embossed Z */}
        <path
          d="M26 34 H94 L42 86 H94 V96 H26 L78 44 H26 V34 Z"
          fill="url(#zGrad)"
          stroke="url(#chromeGrad)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />

        {/* Play Triangle Embossed inside center right */}
        <path
          d="M78 60 L94 70 L78 80 Z"
          fill="#FFFFFF"
          className="drop-shadow-[0_0_6px_#00D4FF]"
        />
      </svg>
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
