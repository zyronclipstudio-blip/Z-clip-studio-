"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

export function NetflixSplash({ onFinish }: { onFinish: () => void }) {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const audioPlayed = useRef(false);

  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setLeaving(true), 3000);
    const finishTimer = window.setTimeout(() => onFinishRef.current(), 3400);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(finishTimer);
    };
  }, []);

  // Original, synthesized mechanical cue. Browsers require a user gesture before audio.
  const playMechanicalCue = useCallback(() => {
    if (!soundEnabled || audioPlayed.current || typeof window === "undefined") return;
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    audioPlayed.current = true;
    const context = new AudioContextClass();
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.22, now + 0.08);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
    master.connect(context.destination);

    // Low servo sweep.
    const servo = context.createOscillator();
    const servoGain = context.createGain();
    servo.type = "sawtooth";
    servo.frequency.setValueAtTime(150, now);
    servo.frequency.exponentialRampToValueAtTime(62, now + 0.72);
    servoGain.gain.setValueAtTime(0.0001, now);
    servoGain.gain.exponentialRampToValueAtTime(0.22, now + 0.12);
    servoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
    servo.connect(servoGain);
    servoGain.connect(master);
    servo.start(now);
    servo.stop(now + 0.85);

    // Two short, tuned metal-lock impacts.
    [0.72, 1.02].forEach((offset, index) => {
      const impact = context.createOscillator();
      const impactGain = context.createGain();
      impact.type = "triangle";
      impact.frequency.setValueAtTime(index === 0 ? 118 : 164, now + offset);
      impact.frequency.exponentialRampToValueAtTime(48, now + offset + 0.24);
      impactGain.gain.setValueAtTime(0.0001, now + offset);
      impactGain.gain.exponentialRampToValueAtTime(index === 0 ? 0.34 : 0.22, now + offset + 0.012);
      impactGain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.28);
      impact.connect(impactGain);
      impactGain.connect(master);
      impact.start(now + offset);
      impact.stop(now + offset + 0.3);
    });

    // Bright metallic confirmation tone.
    const chime = context.createOscillator();
    const chimeGain = context.createGain();
    chime.type = "sine";
    chime.frequency.setValueAtTime(740, now + 1.16);
    chime.frequency.exponentialRampToValueAtTime(520, now + 1.48);
    chimeGain.gain.setValueAtTime(0.0001, now + 1.16);
    chimeGain.gain.exponentialRampToValueAtTime(0.12, now + 1.2);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.55);
    chime.connect(chimeGain);
    chimeGain.connect(master);
    chime.start(now + 1.16);
    chime.stop(now + 1.58);

    window.setTimeout(() => void context.close(), 1900);
  }, [soundEnabled]);

  return (
    <div
      onPointerDown={playMechanicalCue}
      className={`zclip-intro fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden select-none bg-[#050505] text-white ${leaving ? "is-leaving" : ""}`}
      role="img"
      aria-label="ZClip cinematic mechanical logo assembly"
    >
      <div className="intro-atmosphere" />
      <div className="intro-floor" />
      <div className="intro-stage">
        <div className="intro-orbit orbit-one" />
        <div className="intro-orbit orbit-two" />
        <div className="intro-emblem" aria-hidden="true">
          <svg viewBox="0 0 240 180" className="intro-z" fill="none">
            <defs>
              <linearGradient id="zclipGold" x1="25" y1="18" x2="205" y2="160" gradientUnits="userSpaceOnUse">
                <stop stopColor="#FFF0B5" />
                <stop offset="0.28" stopColor="#D4AF37" />
                <stop offset="0.68" stopColor="#9A741F" />
                <stop offset="1" stopColor="#F6D978" />
              </linearGradient>
              <linearGradient id="zclipTitanium" x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#E8E1D1" />
                <stop offset="0.45" stopColor="#77736A" />
                <stop offset="1" stopColor="#211F1A" />
              </linearGradient>
              <filter id="zclipGlow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <g className="z-piece z-piece-top" filter="url(#zclipGlow)">
              <path d="M30 28 H210 V54 H30 Z" fill="url(#zclipTitanium)" stroke="url(#zclipGold)" strokeWidth="2.5" />
              <path d="M40 34 H198" stroke="#FFF0B5" strokeOpacity=".8" strokeWidth="2" />
            </g>
            <g className="z-piece z-piece-diagonal" filter="url(#zclipGlow)">
              <path d="M178 42 L202 62 L62 152 L38 132 Z" fill="url(#zclipTitanium)" stroke="url(#zclipGold)" strokeWidth="2.5" />
              <path d="M181 53 L54 137" stroke="#F7D978" strokeOpacity=".85" strokeWidth="2" />
            </g>
            <g className="z-piece z-piece-bottom" filter="url(#zclipGlow)">
              <path d="M30 126 H210 V152 H30 Z" fill="url(#zclipTitanium)" stroke="url(#zclipGold)" strokeWidth="2.5" />
              <path d="M42 133 H199" stroke="#FFF0B5" strokeOpacity=".8" strokeWidth="2" />
            </g>
            <path className="z-core-line" d="M30 28 H210 L30 152 H210" stroke="#FFF0B5" strokeWidth="1.5" strokeOpacity=".9" />
          </svg>
          <div className="intro-lock-flash" />
        </div>
        <div className="intro-wordmark">
          <h1>Z<span>CLIP</span></h1>
          <p>ZYRON CLIP STUDIO</p>
        </div>
      </div>

      <button
        type="button"
        className="intro-sound"
        onClick={(event) => {
          event.stopPropagation();
          setSoundEnabled((enabled) => !enabled);
        }}
        aria-pressed={soundEnabled}
      >
        {soundEnabled ? "SOUND ON · TAP TO PLAY" : "SOUND OFF"}
      </button>

      <style jsx>{`
        .zclip-intro { isolation: isolate; transition: opacity 650ms ease, transform 850ms cubic-bezier(.22,.8,.22,1); }
        .zclip-intro.is-leaving { opacity: 0; transform: scale(1.025); pointer-events: none; }
        .intro-atmosphere { position:absolute; inset:0; z-index:-2; background: radial-gradient(ellipse at 50% 48%, rgba(212,175,55,.13), transparent 32%), radial-gradient(ellipse at 50% 100%, rgba(212,175,55,.08), transparent 45%), #050505; }
        .intro-floor { position:absolute; left:-20%; right:-20%; bottom:9%; height:1px; background:linear-gradient(90deg,transparent,rgba(212,175,55,.7),transparent); box-shadow:0 0 38px 8px rgba(212,175,55,.14); transform:perspective(260px) rotateX(62deg); animation: floor-in 1.4s ease-out both; }
        .intro-stage { position:relative; display:flex; flex-direction:column; align-items:center; transform:translateY(-2vh); }
        .intro-emblem { position:relative; width:min(64vw,340px); filter:drop-shadow(0 18px 35px rgba(0,0,0,.8)); }
        .intro-z { width:100%; overflow:visible; }
        .z-piece { transform-box:fill-box; transform-origin:center; }
        .z-piece-top { animation: assemble-top 1.48s cubic-bezier(.18,.78,.18,1) .08s both; }
        .z-piece-diagonal { animation: assemble-diagonal 1.68s cubic-bezier(.18,.78,.18,1) .12s both; }
        .z-piece-bottom { animation: assemble-bottom 1.5s cubic-bezier(.18,.78,.18,1) .16s both; }
        .z-core-line { opacity:0; animation: core-reveal .55s ease-out 1.7s both; }
        .intro-orbit { position:absolute; left:50%; top:50%; width:118%; height:36%; border:1px solid rgba(212,175,55,.2); border-radius:50%; transform:translate(-50%,-50%) rotate(-16deg) scale(.72); opacity:0; }
        .orbit-one { animation: orbit-settle 1.65s cubic-bezier(.2,.7,.2,1) .15s both; }
        .orbit-two { width:108%; height:48%; transform:translate(-50%,-50%) rotate(18deg) scale(.8); border-color:rgba(235,207,125,.12); animation: orbit-settle 1.8s cubic-bezier(.2,.7,.2,1) .24s both; }
        .intro-lock-flash { position:absolute; left:8%; right:8%; top:50%; height:2px; background:linear-gradient(90deg,transparent,#FFF0B5,#D4AF37,transparent); box-shadow:0 0 22px 5px rgba(212,175,55,.5); opacity:0; animation: lock-flash .55s ease-out 1.78s both; }
        .intro-wordmark { margin-top:14px; text-align:center; opacity:0; transform:translateY(12px); animation: wordmark-in .75s cubic-bezier(.2,.75,.2,1) 2.05s both; }
        .intro-wordmark h1 { margin:0; font:800 clamp(28px,6vw,42px)/1 var(--font-space),sans-serif; letter-spacing:.24em; padding-left:.24em; }
        .intro-wordmark h1 span { color:#D4AF37; }
        .intro-wordmark p { margin:10px 0 0; color:#B6A16C; font:500 9px/1 var(--font-plex),monospace; letter-spacing:.38em; }
        .intro-sound { position:absolute; bottom:max(28px,env(safe-area-inset-bottom)); border:1px solid rgba(212,175,55,.3); border-radius:999px; padding:9px 14px; background:rgba(12,11,8,.65); color:#BFA15A; font:10px var(--font-plex),monospace; letter-spacing:.12em; cursor:pointer; }
        .intro-sound:focus-visible { outline:2px solid #F3E3B3; outline-offset:4px; }
        @keyframes assemble-top { 0% { opacity:0; transform:translate(-72px,-46px) rotate(-22deg) scale(.82); } 58% { opacity:1; transform:translate(5px,3px) rotate(2deg); } 78% { transform:translate(-1px,0) rotate(-.4deg); } 100% { opacity:1; transform:translate(0,0) rotate(0); } }
        @keyframes assemble-diagonal { 0% { opacity:0; transform:translate(72px,-58px) rotate(26deg) scale(.84); } 52% { opacity:1; transform:translate(-4px,3px) rotate(-2deg); } 80% { transform:translate(1px,-1px) rotate(.4deg); } 100% { opacity:1; transform:translate(0,0) rotate(0); } }
        @keyframes assemble-bottom { 0% { opacity:0; transform:translate(-68px,54px) rotate(18deg) scale(.84); } 60% { opacity:1; transform:translate(4px,-3px) rotate(-1.5deg); } 82% { transform:translate(-1px,1px) rotate(.3deg); } 100% { opacity:1; transform:translate(0,0) rotate(0); } }
        @keyframes core-reveal { from { opacity:0; } to { opacity:.5; } }
        @keyframes orbit-settle { 0% { opacity:0; } 60% { opacity:.8; } 100% { opacity:.35; transform:translate(-50%,-50%) rotate(-16deg) scale(1); } }
        @keyframes lock-flash { 0% { opacity:0; transform:scaleX(.1); } 35% { opacity:.9; transform:scaleX(1); } 100% { opacity:0; transform:scaleX(1.12); } }
        @keyframes wordmark-in { to { opacity:1; transform:translateY(0); } }
        @keyframes floor-in { from { opacity:0; transform:perspective(260px) rotateX(62deg) scaleX(.5); } to { opacity:1; transform:perspective(260px) rotateX(62deg) scaleX(1); } }
        @media (prefers-reduced-motion: reduce) {
          .zclip-intro, .intro-floor, .z-piece-top, .z-piece-diagonal, .z-piece-bottom, .z-core-line, .orbit-one, .orbit-two, .intro-lock-flash, .intro-wordmark { animation:none !important; transition:none !important; }
          .z-piece { opacity:1; transform:none; }
          .intro-wordmark { opacity:1; }
        }
      `}</style>
    </div>
  );
}
