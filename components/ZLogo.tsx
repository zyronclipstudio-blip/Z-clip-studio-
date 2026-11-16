"use client";

export function ZLogo({ size = 48, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <div
      className={`relative flex items-center justify-center select-none ${animated ? "animate-pulse" : ""}`}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-gold/30 via-gold-muted/20 to-gold/10 blur-md pointer-events-none" />
      <div className="relative flex items-center justify-center w-full h-full rounded-xl border border-gold/40 bg-surface-raised/90 shadow-[0_0_15px_rgba(212,175,55,0.25)] backdrop-blur-md">
        <svg viewBox="0 0 100 100" className="w-3/5 h-3/5 drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 25 H80 L35 75 H80" stroke="#D4AF37" strokeWidth="12" strokeLinecap="square" strokeLinejoin="miter" />
          <circle cx="22" cy="75" r="4.5" fill="#BFA15A" />
          <circle cx="78" cy="25" r="4.5" fill="#F3E3B3" />
        </svg>
      </div>
    </div>
  );
}