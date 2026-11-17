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
      <svg className="mk" width="120" height="120" viewBox="0 0 64 64" aria-hidden="true">
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
    </div>
  );
}
