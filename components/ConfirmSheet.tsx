"use client";
import { useEffect } from "react";
import { Trash2 } from "lucide-react";

// A calm bottom sheet for decisions that cannot be undone. Gold hairline, soft blur, big thumb-sized buttons.
export function ConfirmSheet({
  open, title, body, confirmLabel, busyLabel, busy, onConfirm, onCancel,
}: {
  open: boolean; title: string; body: string; confirmLabel: string; busyLabel?: string; busy?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, busy, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[28px] border border-b-0 border-[#d9b45b]/30 bg-gradient-to-b from-[#181c25] to-[#0b0d13] px-6 pt-3 shadow-[0_-24px_60px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#242a35]" />
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#ff8a96]/30 bg-[#ff8a96]/10 text-[#ff8a96]"><Trash2 size={22} /></div>
        <h2 className="mt-4 text-center text-lg font-semibold text-[#eceff4]">{title}</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#8d97a8]">{body}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={onCancel} className="min-h-14 rounded-[14px] border border-[#242a35] bg-[#181c25] px-4 text-base font-medium text-[#eceff4] transition active:scale-[0.99] disabled:opacity-60">Keep it</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="min-h-14 rounded-[14px] bg-[#e5484d] px-4 text-base font-semibold text-white shadow-[0_8px_24px_rgba(229,72,77,0.35)] transition active:scale-[0.99] disabled:opacity-60">{busy ? busyLabel ?? "Deleting…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
