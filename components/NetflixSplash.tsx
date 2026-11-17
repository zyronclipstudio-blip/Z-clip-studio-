"use client";

import React, { useEffect, useRef, useState } from "react";
import { Z_PATH } from "@/components/ZClipMark";

export function NetflixSplash({ onFinish }: { onFinish: () => void }) {
  const [leaving, setLeaving] = useState(false);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLeaving(true), 3600);
    const finishTimer = window.setTimeout(() => onFinishRef.current(), 4200);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  const skip = () => {
    setLeaving(true);
    window.setTimeout(() => onFinishRef.current(), 500);
  };
  return (
    <div className={`zsplash ${leaving ? "out" : ""}`} role="presentation" onClick={skip}>
      <div className="bloom" />
      <svg className="mk" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="sl" x1="0.2" y1="0" x2="0.6" y2="1"><stop offset="0" stopColor="#f9e3a4" /><stop offset="1" stopColor="#c99a3b" /></linearGradient>
          <linearGradient id="sd" x1="0.2" y1="0" x2="0.6" y2="1"><stop offset="0" stopColor="#c39434" /><stop offset="1" stopColor="#6a4811" /></linearGradient>
          <clipPath id="su"><path d="M-2 36.3 66 20.3V-10H-2Z" /></clipPath>
          <clipPath id="sn"><path d="M-2 39.7 66 23.7V80H-2Z" /></clipPath>
          <clipPath id="sz"><path d={Z_PATH} /></clipPath>
        </defs>
        <g clipPath="url(#su)"><path className="pc" style={{ "--dx": "22px", "--dy": "-10px" } as React.CSSProperties} fill="url(#sl)" d={Z_PATH} /></g>
        <g clipPath="url(#sn)"><path className="pc r" style={{ "--dx": "-22px", "--dy": "10px" } as React.CSSProperties} fill="url(#sd)" d={Z_PATH} /></g>
        <g clipPath="url(#sz)"><line className="gleam" pathLength={1} x1="-2" y1="38" x2="66" y2="22" /></g>
      </svg>
      <div className="word">ZYRON CLIP STUDIO</div>
      <div className="tag">EDIT AUTOMATICALLY. OR TAKE THE WHEEL.</div>
      <div className="skip">TAP TO SKIP</div>
      <style jsx>{`
        .zsplash{position:fixed;inset:0;z-index:200;display:grid;place-content:center;justify-items:center;gap:22px;background:linear-gradient(180deg,#0b0d12,#040508);cursor:pointer;--s:3;transition:opacity .5s ease;color:#f3eee2}
        .zsplash.out{opacity:0;pointer-events:none}
        .bloom{position:absolute;inset:0;background:radial-gradient(closest-side at 50% 44%,rgba(217,180,91,.30),transparent 72%);pointer-events:none;opacity:.5;animation:bloom calc(1.4s*var(--s)) ease-in-out both}
        @keyframes bloom{from{opacity:0;transform:scale(.55)}55%{opacity:1}to{opacity:.5;transform:scale(1)}}
        .mk{position:relative;width:120px;height:120px;display:block;filter:drop-shadow(0 0 12px rgba(217,180,91,.35));animation:settle calc(1.2s*var(--s)) ease-in-out}
        @keyframes settle{from{filter:drop-shadow(0 0 0 rgba(217,180,91,0))}62%{filter:drop-shadow(0 0 26px rgba(247,222,150,.95))}}
        .mk :global(.pc){animation:lock calc(.62s*var(--s)) cubic-bezier(.16,1,.3,1) backwards}
        .mk :global(.pc.r){animation-delay:calc(.14s*var(--s))}
        @keyframes lock{from{transform:translate(var(--dx,0px),var(--dy,0px));opacity:0}}
        .mk :global(.gleam){fill:none;stroke:#fff3cf;stroke-width:1.5;stroke-linecap:round;stroke-dasharray:1;opacity:0;animation:gleam calc(.45s*var(--s)) ease-in-out calc(.62s*var(--s)) both}
        @keyframes gleam{from{stroke-dashoffset:1;opacity:1}70%{stroke-dashoffset:0;opacity:1}to{stroke-dashoffset:0;opacity:0}}
        .word{position:relative;font:800 18px var(--font-geist),sans-serif;letter-spacing:.32em;padding-left:.32em;animation:word calc(.5s*var(--s)) ease calc(.75s*var(--s)) backwards}
        @keyframes word{from{opacity:0;letter-spacing:.8em;filter:blur(3px)}}
        .tag{position:relative;font:500 11px var(--font-geist-mono),monospace;letter-spacing:.08em;color:#b88f38;animation:word calc(.5s*var(--s)) ease calc(.95s*var(--s)) backwards}
        .skip{position:absolute;bottom:calc(24px + env(safe-area-inset-bottom,0px));left:0;right:0;text-align:center;font:11px var(--font-geist-mono),monospace;letter-spacing:.1em;color:#5d6676}
        @media (prefers-reduced-motion:reduce){.bloom,.mk,.mk :global(.pc),.mk :global(.gleam),.word,.tag{animation:none!important}.mk :global(.gleam){opacity:0}}
      `}</style>
    </div>
  );
}
