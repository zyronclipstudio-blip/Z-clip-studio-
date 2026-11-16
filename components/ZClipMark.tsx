"use client";

export function ZClipMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 180"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <path d="M30 28H210V54H30Z" fill="currentColor" stroke="#755719" strokeWidth="2" strokeLinejoin="bevel" />
      <path d="M178 42L202 62L62 152L38 132Z" fill="currentColor" stroke="#755719" strokeWidth="2" strokeLinejoin="bevel" />
      <path d="M30 126H210V152H30Z" fill="currentColor" stroke="#755719" strokeWidth="2" strokeLinejoin="bevel" />
      <path d="M40 34H198" stroke="#FFF0B5" strokeOpacity=".72" strokeWidth="2" />
      <path d="M181 53L54 137" stroke="#FFF0B5" strokeOpacity=".55" strokeWidth="1.8" />
      <path d="M42 133H199" stroke="#FFF0B5" strokeOpacity=".5" strokeWidth="2" />
    </svg>
  );
}
