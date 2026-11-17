"use client";

import { useId } from "react";

export const Z_PATH = "M9 8H58V18L25 45H58V56H6V46L39 19H9Z";

/** The Zyron Z mark, shared with Zyron Studio: lit upper half, dim lower half, one gleam on the seam. */
export function ZClipMark({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}l`} x1="0.2" y1="0" x2="0.6" y2="1"><stop offset="0" stopColor="#f9e3a4" /><stop offset="1" stopColor="#c99a3b" /></linearGradient>
        <linearGradient id={`${id}d`} x1="0.2" y1="0" x2="0.6" y2="1"><stop offset="0" stopColor="#c39434" /><stop offset="1" stopColor="#6a4811" /></linearGradient>
        <clipPath id={`${id}u`}><path d="M-2 36.3 66 20.3V-10H-2Z" /></clipPath>
        <clipPath id={`${id}n`}><path d="M-2 39.7 66 23.7V80H-2Z" /></clipPath>
        <clipPath id={`${id}z`}><path d={Z_PATH} /></clipPath>
      </defs>
      <g clipPath={`url(#${id}u)`}><path fill={`url(#${id}l)`} d={Z_PATH} /></g>
      <g clipPath={`url(#${id}n)`}><path fill={`url(#${id}d)`} d={Z_PATH} /></g>
      <line x1="-2" y1="38" x2="66" y2="22" stroke="#fff3cf" strokeWidth="1.2" strokeLinecap="round" opacity=".9" clipPath={`url(#${id}z)`} />
    </svg>
  );
}
