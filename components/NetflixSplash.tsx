"use client";

import React, { useEffect, useState } from "react";

export function NetflixSplash({ onFinish }: { onFinish: () => void }) {
  const [stage, setStage] = useState<"initial" | "impact" | "rays" | "exit">("initial");

  useEffect(() => {
    // Stage 1: Initial dark suspense
    const t1 = setTimeout(() => setStage("impact"), 200);
    // Stage 2: Netflix-style sonic blast / light rays surge
    const t2 = setTimeout(() => setStage("rays"), 1200);
    // Stage 3: Smooth lens flare exit
    const t3 = setTimeout(() => setStage("exit"), 2300);
    // Stage 4: Fade into app
    const t4 = setTimeout(onFinish, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onFinish]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05070B] overflow-hidden select-none transition-all duration-700 ${
        stage === "exit" ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
    >
      {/* Dynamic Background Deep Cosmic Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,117,255,0.18)_0,rgba(8,11,17,0.95)_70%)]" />

      {/* Netflix style vertical laser anamorphic beams */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-1000 ${
          stage === "rays" ? "opacity-100 scale-125" : "opacity-0 scale-90"
        }`}
      >
        <div className="w-[120vw] h-[2px] bg-gradient-to-r from-transparent via-[#00D4FF] to-transparent blur-sm shadow-[0_0_40px_#00D4FF]" />
        <div className="absolute w-[2px] h-[120vh] bg-gradient-to-b from-transparent via-[#0075FF] to-transparent blur-sm shadow-[0_0_40px_#0075FF]" />
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[#00D4FF]/20 blur-[130px] animate-pulse" />
      </div>

      {/* Hero Z Emblem with 3D Cinematic Anamorphic Zoom */}
      <div className="relative flex flex-col items-center justify-center">
        <div
          className={`relative transition-all duration-1000 transform ${
            stage === "initial"
              ? "scale-50 opacity-0 blur-md"
              : stage === "impact"
              ? "scale-110 opacity-100 blur-0"
              : "scale-100 opacity-100"
          }`}
        >
          {/* Intense Glow Pod */}
          <div className="absolute -inset-10 rounded-full bg-gradient-to-r from-[#001AFF] via-[#00D4FF] to-[#0075FF] opacity-50 blur-3xl animate-pulse" />

          {/* SVG 3D Emblem (Exact match to Reference Picture with Crown & Play Triangle) */}
          <svg
            width="140"
            height="140"
            viewBox="0 0 140 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="relative drop-shadow-[0_0_30px_rgba(0,212,255,0.9)]"
          >
            <defs>
              <linearGradient id="netflixZGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="20%" stopColor="#00D4FF" />
                <stop offset="60%" stopColor="#0075FF" />
                <stop offset="100%" stopColor="#001AFF" />
              </linearGradient>

              <linearGradient id="crownGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00D4FF" />
                <stop offset="50%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#0075FF" />
              </linearGradient>

              <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Orbit Ring */}
            <ellipse
              cx="70"
              cy="70"
              rx="62"
              ry="42"
              stroke="#00D4FF"
              strokeWidth="4"
              transform="rotate(-28 70 70)"
              strokeDasharray="210 40"
              className="opacity-90 drop-shadow-[0_0_15px_#00D4FF]"
            />

            {/* Glowing Crown Accent */}
            <path
              d="M58 20 L63 27 L70 18 L77 27 L82 20 L78 30 H62 Z"
              fill="url(#crownGrad)"
              filter="url(#glowEffect)"
            />

            {/* Metallic 3D Dimensional "Z" */}
            <path
              d="M32 38 H108 L48 98 H108 V110 H32 L92 50 H32 V38 Z"
              fill="url(#netflixZGrad)"
              stroke="#E0F7FE"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* Video Play Triangle Embossed */}
            <path
              d="M90 68 L110 80 L90 92 Z"
              fill="#FFFFFF"
              className="drop-shadow-[0_0_10px_#00D4FF]"
            />
          </svg>
        </div>

        {/* Title reveal with letter-spacing tracking animation */}
        <div
          className={`mt-6 text-center transition-all duration-1000 ${
            stage === "initial"
              ? "opacity-0 translate-y-4"
              : "opacity-100 translate-y-0"
          }`}
        >
          <div className="flex items-center justify-center gap-1">
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-wider text-white drop-shadow-[0_0_20px_rgba(0,117,255,0.7)]">
              Z<span className="text-[#00D4FF]">Clip</span>
            </h1>
          </div>
          <p className="text-xs sm:text-sm font-sans tracking-[0.35em] uppercase text-[#8A99AD] mt-1.5 font-medium">
            Edit. Create. Share.
          </p>
        </div>
      </div>

      {/* Cinematic bottom credit */}
      <div className="absolute bottom-8 font-mono text-[10px] tracking-widest text-[#8A99AD]/50 uppercase">
        A Zyron Studio Product • AI Video Engine
      </div>
    </div>
  );
}
