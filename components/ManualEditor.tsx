"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Redo2, RefreshCw, Scissors, Trash2, Undo2 } from "lucide-react";
import {
  PlanOpError,
  commit,
  moveSegment,
  redo,
  removeSegment,
  splitSegment,
  startHistory,
  trimSegment,
  undo,
  validatePlan,
  type PlanHistory,
} from "@/lib/plan-ops";
import type { EditPlan, PublicAsset } from "@/lib/types/schema";

interface Props {
  plan: EditPlan;
  assets: PublicAsset[];
  capSec: number;
  busy: boolean;
  error?: string;
  onRender: (plan: EditPlan) => void;
}

const fmt = (n: number) => `${n.toFixed(1)}s`;

export function ManualEditor({ plan, assets, capSec, busy, error, onRender }: Props) {
  const [history, setHistory] = useState<PlanHistory>(() => startHistory(plan));
  const [open, setOpen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const current = history.present;
  const original = history.past.length ? history.past[0] : history.present;
  const dirty = history.past.length > 0;
  const nameOf = (id: string) => assets.find((a) => a.id === id)?.originalName ?? "Clip";
  const total = useMemo(() => current.segments.reduce((s, x) => s + x.endSec - x.startSec, 0), [current]);
  const overCap = total > capSec + 0.01;

  // History must be read inside the updater to stay correct; ops take the plan from `current`.
  const run = (op: (p: EditPlan) => EditPlan) => {
    try {
      const next = op(current);
      setHistory((h) => commit(h, next));
      setNote("");
    } catch (e) {
      setNote(e instanceof PlanOpError ? e.message : "That change is not possible.");
    }
  };

  function submit() {
    try {
      onRender(validatePlan(current, assets, capSec));
    } catch (e) {
      setNote(e instanceof PlanOpError ? e.message : "That edit is not valid.");
    }
  }

  const btn = "inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#242a35] bg-[#11141b] text-[#c3cad6] transition hover:border-[#d9b45b]/50 disabled:opacity-35";

  return (
    <div className="zy-card">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-[16px] font-semibold">Fix it yourself</h2>
          <p className="mt-0.5 text-[13px] text-[#8d97a8]">
            <span className={overCap ? "text-[#ff6171]" : "text-[#ecd083]"}>{fmt(total)}</span> of {capSec}s allowed
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Undo" className={btn} disabled={!history.past.length || busy} onClick={() => setHistory(undo)}><Undo2 size={18} /></button>
          <button type="button" aria-label="Redo" className={btn} disabled={!history.future.length || busy} onClick={() => setHistory(redo)}><Redo2 size={18} /></button>
        </div>
      </div>

      <ol className="mt-4 space-y-2">
        {current.segments.map((s, i) => {
          const asset = assets.find((a) => a.id === s.assetId);
          const dur = asset?.durationSec ?? s.endSec;
          const isOpen = open === i;
          return (
            <li key={`${s.assetId}-${i}-${s.startSec}`} className="rounded-[14px] border border-[#242a35] bg-[#181c25]">
              <div className="flex items-center gap-2 p-2.5">
                <button type="button" onClick={() => setOpen(isOpen ? null : i)} className="min-h-11 min-w-0 flex-1 text-left" aria-expanded={isOpen}>
                  <span className="block truncate text-[14px] font-medium">{i + 1}. {nameOf(s.assetId)}</span>
                  <span className="font-mono text-[12px] text-[#8d97a8]">{fmt(s.startSec)} to {fmt(s.endSec)} · {fmt(s.endSec - s.startSec)}</span>
                </button>
                <button type="button" aria-label="Move up" className={btn} disabled={i === 0 || busy} onClick={() => run((p) => moveSegment(p, i, i - 1))}><ArrowUp size={17} /></button>
                <button type="button" aria-label="Move down" className={btn} disabled={i === current.segments.length - 1 || busy} onClick={() => run((p) => moveSegment(p, i, i + 1))}><ArrowDown size={17} /></button>
                <button type="button" aria-label="Remove this piece" className={`${btn} !text-[#ff6171]`} disabled={current.segments.length === 1 || busy} onClick={() => { setOpen(null); run((p) => removeSegment(p, i)); }}><Trash2 size={17} /></button>
              </div>
              {isOpen && (
                <div className="space-y-4 border-t border-[#242a35] p-3">
                  <label className="block text-[13px] text-[#8d97a8]">
                    Starts at <b className="text-[#eceff4]">{fmt(s.startSec)}</b>
                    <input type="range" min={0} max={Math.max(0, dur - 0.5)} step={0.1} value={s.startSec} disabled={busy}
                      onChange={(e) => run((p) => trimSegment(p, i, { startSec: Math.min(Number(e.target.value), p.segments[i].endSec - 0.5) }, assets))}
                      className="mt-1 h-11 w-full accent-[#d9b45b]" />
                  </label>
                  <label className="block text-[13px] text-[#8d97a8]">
                    Ends at <b className="text-[#eceff4]">{fmt(s.endSec)}</b>
                    <input type="range" min={0.5} max={dur} step={0.1} value={s.endSec} disabled={busy}
                      onChange={(e) => run((p) => trimSegment(p, i, { endSec: Math.max(Number(e.target.value), p.segments[i].startSec + 0.5) }, assets))}
                      className="mt-1 h-11 w-full accent-[#d9b45b]" />
                  </label>
                  <button type="button" disabled={busy} onClick={() => run((p) => splitSegment(p, i, (p.segments[i].startSec + p.segments[i].endSec) / 2))}
                    className="inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-[#242a35] bg-[#11141b] px-3.5 text-[14px] font-medium transition hover:border-[#d9b45b]/50 disabled:opacity-40">
                    <Scissors size={16} className="text-[#d9b45b]" /> Split in the middle
                  </button>
                  {s.reason && <p className="text-[13px] leading-5 text-[#8d97a8]">Why ZClip chose this: {s.reason}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {(note || error) && <p role="alert" className="mt-3 text-[13px] text-[#ff8a96]">{note || error}</p>}

      <button type="button" onClick={submit} disabled={!dirty || busy || overCap}
        className="zy-btn-gold mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-[14px] text-base transition active:scale-[0.99] disabled:opacity-45">
        <RefreshCw size={17} className={busy ? "animate-spin" : ""} /> {busy ? "Rendering your changes…" : dirty ? "Render my changes" : "Make a change to render"}
      </button>
      <p className="mt-2 text-center text-[12px] text-[#7b8596]">
        Manual fixes don&apos;t use extra credits. Your earlier video stays saved{original === current ? "" : " until the new one passes the checks"}.
      </p>
    </div>
  );
}
