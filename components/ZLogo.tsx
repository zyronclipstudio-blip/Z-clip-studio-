"use client";

import React, { useEffect, useState } from "react";

export function ZLogo({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${animated ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
    >
      {/* Outer Gold Glow Ring */}
      <div
        className="absolute inset-0 rounded-xl bg-gradient-to-tr from-gold/30 via-gold-muted/20 to-gold/10 blur-md pointer-events-none"
      />
      
      {/* Emblem Container */}
      <div className="relative flex items-center justify-center w-full h-full rounded-xl border border-gold/40 bg-surface-raised/90 shadow-[0_0_15px_rgba(212,175,55,0.25)] backdrop-blur-md">
        <svg
          viewBox="0 0 100 100"
          className="w-3/5 h-3/5 drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Futuristic Cyber-Angular "Z" */}
          <path
            d="M20 25 H80 L35 75 H80"
            stroke="#D4AF37"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="miter"
            className={animated ? "animate-[dash_2s_ease-in-out_infinite]" : ""}
          />
          {/* Subtle Accent cut dot */}
          <circle cx="22" cy="75" r="4.5" fill="#BFA15A" />
          <circle cx="78" cy="25" r="4.5" fill="#F3E3B3" />
        </svg>
      </div>
    </div>
  );
}

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFade(true);
      setTimeout(onFinish, 600);
    }, 1800);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#08080A] transition-opacity duration-700 ${
        fade ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Ambient background glows */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-cyan/10 blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute w-[400px] h-[400px] rounded-full bg-gold-muted/10 blur-[100px] pointer-events-none" />

      {/* Hero Z Emblem */}
      <div className="relative transform transition-transform duration-1000 scale-125 mb-6">
        <ZLogo size={88} animated />
      </div>

      <div className="flex items-center gap-2">
        <h1 className="font-display text-3xl font-bold tracking-wider text-ink">
          Z<span className="text-cyan">CLIP</span>
        </h1>
        <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border border-cyan/30 text-cyan bg-cyan/10">
          STUDIO
        </span>
      </div>

      <p className="mt-2 text-xs font-mono text-muted tracking-wide animate-pulse">
        INITIALIZING VIDEO INTELLIGENCE...
      </p>
    </div>
  );
}
