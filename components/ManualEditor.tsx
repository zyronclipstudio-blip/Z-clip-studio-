"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, History, Redo2, RefreshCw, Scissors, Trash2, Undo2 } from "lucide-react";
import {
  PlanOpError,
  commit,
  moveSegment,
  redo,
  removeSegment,
  setAspect,
  setVolume,
  splitSegment,
  startHistory,
  trimSegment,
  undo,
  validatePlan,
  type PlanHistory,
} from "@/lib/plan-ops";
import type { AspectRatio, EditPlan, PublicAsset } from "@/lib/types/schema";

interface Props {
  plan: EditPlan;
  assets: PublicAsset[];
  capSec: number;
  busy: boolean;
  error?: string;
  onRender: (plan: EditPlan) => void;
  versions?: { version: number; createdAt: string; plan: EditPlan }[];
}

const fmt = (n: number) => `${n.toFixed(1)}s`;
const SHAPES: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "9:16", label: "Vertical", hint: "TikTok, Reels, Shorts" },
  { value: "1:1", label: "Square", hint: "Feed posts" },
  { value: "16:9", label: "Wide", hint: "YouTube" },
];

export function ManualEditor({ plan, assets, capSec, busy, error, onRender, versions = [] }: Props) {
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

      <div className="mt-4">
        <p className="text-[13px] text-[#8d97a8]">Video shape</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {SHAPES.map((sh) => (
            <button key={sh.value} type="button" disabled={busy} aria-pressed={current.aspectRatio === sh.value}
              onClick={() => run((p) => setAspect(p, sh.value))}
              className={`min-h-14 rounded-[12px] border px-2 py-2 text-center transition disabled:opacity-40 ${current.aspectRatio === sh.value ? "border-[#d9b45b] bg-[#1f1b10] text-[#ecd083]" : "border-[#242a35] bg-[#11141b] text-[#c3cad6]"}`}>
              <b className="block text-[13px] font-semibold">{sh.label}</b>
              <span className="block text-[11px] text-[#8d97a8]">{sh.hint}</span>
            </button>
          ))}
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
                  <label className="block text-[13px] text-[#8d97a8]">
                    Sound <b className="text-[#eceff4]">{Math.round((s.volume ?? 1) * 100)}%</b>{(s.volume ?? 1) === 0 ? " (muted)" : ""}
                    <input type="range" min={0} max={2} step={0.05} value={s.volume ?? 1} disabled={busy}
                      onChange={(e) => run((p) => setVolume(p, i, Number(e.target.value)))}
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

      {versions.length > 1 && (
        <details className="mt-4 rounded-[14px] border border-[#242a35] bg-[#181c25]">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[14px] font-medium"><History size={16} className="text-[#d9b45b]" /> Earlier versions</summary>
          <ul className="space-y-2 border-t border-[#242a35] p-3">
            {versions.slice(1).map((v) => (
              <li key={v.version} className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-[#c3cad6]">Version {v.version} · {v.plan.segments.length} pieces · {fmt(v.plan.targetDurationSec)}</span>
                <button type="button" disabled={busy} onClick={() => { setHistory((h) => commit(h, v.plan)); setNote(""); }}
                  className="min-h-11 rounded-[12px] border border-[#242a35] bg-[#11141b] px-3 text-[13px] font-medium text-[#ecd083] hover:border-[#d9b45b]/50 disabled:opacity-40">Use this</button>
              </li>
            ))}
          </ul>
        </details>
      )}

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
