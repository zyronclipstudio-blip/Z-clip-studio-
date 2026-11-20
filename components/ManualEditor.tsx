"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Copy, Film, History, Redo2, RefreshCw, Scissors, Sparkles, Trash2, Undo2, Volume2, VolumeX } from "lucide-react";
import {
  PlanOpError,
  commit,
  duplicateSegment,
  moveSegment,
  redo,
  removeSegment,
  setAspect,
  setTransition,
  toggleEffect,
  setVolume,
  splitSegment,
  startHistory,
  trimSegment,
  undo,
  validatePlan,
  type PlanHistory,
} from "@/lib/plan-ops";
import type { AspectRatio, EditPlan, PublicAsset } from "@/lib/types/schema";
import { isImageName } from "@/lib/image";
import { PlanPlayer, type PlanPlayerHandle } from "./PlanPlayer";

interface Props {
  projectId: string;
  plan: EditPlan;
  assets: PublicAsset[];
  capSec: number;
  busy: boolean;
  error?: string;
  onRender: (plan: EditPlan) => void;
  versions?: { version: number; createdAt: string; plan: EditPlan }[];
}

type Drawer = "video" | "audio" | "effects";

const MIN_BLOCK_PX = 48;
const COLORS = ["#d9b45b", "#3ddba5", "#62adff", "#ff6171", "#b794f6"]; // Zyron palette

const fmt = (n: number) => `${n.toFixed(1)}s`;
const SHAPES: { value: AspectRatio; label: string; hint: string }[] = [
  { value: "9:16", label: "Vertical", hint: "TikTok, Reels, Shorts" },
  { value: "1:1", label: "Square", hint: "Feed posts" },
  { value: "16:9", label: "Wide", hint: "YouTube" },
];
const DRAWERS: { id: Drawer; label: string; icon: typeof Film; tone: string }[] = [
  { id: "video", label: "Video", icon: Film, tone: "#d9b45b" },
  { id: "audio", label: "Audio", icon: Volume2, tone: "#3ddba5" },
  { id: "effects", label: "Effects", icon: Sparkles, tone: "#62adff" },
];


export function ManualEditor({ projectId, plan, assets, capSec, busy, error, onRender, versions = [] }: Props) {
  const [history, setHistory] = useState<PlanHistory>(() => startHistory(plan));
  const [selected, setSelected] = useState(0);
  const [drawer, setDrawer] = useState<Drawer>("video");
  const [note, setNote] = useState("");
  const [time, setTime] = useState(0);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<EditPlan | null>(null);
  const player = useRef<PlanPlayerHandle>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  const [tlWidth, setTlWidth] = useState(0);
  const drag = useRef<{ i: number; edge: "start" | "end"; x0: number; start: number; end: number } | null>(null);

  const current = history.present;
  const view = draft ?? current; // while a trim handle is being dragged, the timeline follows the finger
  const original = history.past.length ? history.past[0] : history.present;
  const dirty = history.past.length > 0;
  const sel = Math.min(selected, current.segments.length - 1);
  const nameOf = (id: string) => assets.find((a) => a.id === id)?.originalName ?? "Clip";
  const colorOf = (id: string) => COLORS[Math.max(0, assets.findIndex((a) => a.id === id)) % COLORS.length];
  const total = useMemo(() => current.segments.reduce((s, x) => s + x.endSec - x.startSec, 0), [current]);
  const overCap = total > capSec + 0.01;
  // Fit the whole edit on screen by default (clamped so tiny pieces stay tappable and long edits scroll).
  const pps = tlWidth > 0 && total > 0 ? Math.min(60, Math.max(10, (tlWidth - 8 - current.segments.length * 4) / total)) : 30;
  const widthOf = (sec: number) => Math.max(MIN_BLOCK_PX, sec * pps);
  const starts = useMemo(() => {
    let t = 0;
    return current.segments.map((s) => {
      const at = t;
      t += s.endSec - s.startSec;
      return at;
    });
  }, [current]);

  useEffect(() => {
    const el = tlRef.current;
    if (!el) return;
    const measure = () => setTlWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/projects/${projectId}/previews`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d && d.urls) setUrls(d.urls);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [projectId]);

  const run = (op: (p: EditPlan) => EditPlan, then?: () => void) => {
    try {
      const next = op(current);
      setHistory((h) => commit(h, next));
      setNote("");
      then?.();
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

  const selectPiece = (i: number) => {
    setSelected(i);
    player.current?.seek(starts[i] ?? 0);
  };

  // Split the chosen piece where the playhead is, or in the middle if the playhead is elsewhere.
  const splitHere = () => {
    const s = current.segments[sel];
    if (!s) return;
    const within = time > starts[sel] + 0.5 && time < starts[sel] + (s.endSec - s.startSec) - 0.5;
    const at = within ? s.startSec + (time - starts[sel]) : (s.startSec + s.endSec) / 2;
    run((p) => splitSegment(p, sel, at));
  };

  // ---- trim handles on the timeline
  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>, i: number, edge: "start" | "end") => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const s = current.segments[i];
    drag.current = { i, edge, x0: e.clientX, start: s.startSec, end: s.endSec };
  };
  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = (e.clientX - d.x0) / pps;
    try {
      setDraft(trimSegment(current, d.i, d.edge === "start" ? { startSec: d.start + delta } : { endSec: d.end + delta }, assets));
    } catch {
      /* dragged past a limit: keep the last valid trim */
    }
  };
  const onHandleUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d && draft) {
      const next = draft;
      setHistory((h) => commit(h, next));
      setNote("");
    }
    setDraft(null);
  };

  // Keyboard shortcuts for laptops. The listener is added once and always reads the latest handlers.
  const keys = useRef<(e: KeyboardEvent) => void>(() => undefined);
  keys.current = (e) => {
    const el = e.target as HTMLElement | null;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
    if (busy) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "z") { e.preventDefault(); setHistory(e.shiftKey ? redo : undo); return; }
    if (mod && k === "y") { e.preventDefault(); setHistory(redo); return; }
    if (mod) return;
    if (e.key === " ") { e.preventDefault(); player.current?.toggle(); }
    else if (k === "s") { e.preventDefault(); splitHere(); }
    else if (e.key === "Delete" || e.key === "Backspace") {
      if (current.segments.length > 1) { e.preventDefault(); run((p) => removeSegment(p, sel), () => setSelected(Math.max(0, sel - 1))); }
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowLeft" ? -1 : 1);
      const t = Math.max(0, Math.min(total, time + step));
      setTime(t);
      player.current?.seek(t);
    } else if (e.key === "ArrowUp" && sel > 0) { e.preventDefault(); selectPiece(sel - 1); }
    else if (e.key === "ArrowDown" && sel < current.segments.length - 1) { e.preventDefault(); selectPiece(sel + 1); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const btn = "inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#242a35] bg-[#11141b] text-[#c3cad6] transition hover:border-[#d9b45b]/50 disabled:opacity-35";
  const chip = (on: boolean) =>
    `min-h-11 rounded-[12px] border px-3 text-[13px] font-semibold transition disabled:opacity-40 ${on ? "text-[#eceff4]" : "border-[#242a35] bg-[#11141b] text-[#c3cad6]"}`;
  const chipStyle = (on: boolean, tone: string): React.CSSProperties => (on ? { borderColor: tone, background: `${tone}22` } : {});
  const s = current.segments[sel];
  const asset = s ? assets.find((a) => a.id === s.assetId) : undefined;
  const dur = asset?.durationSec ?? (s ? s.endSec : 0);

  // Where the playhead line sits on the timeline, in pixels.
  const playheadX = useMemo(() => {
    let x = 0;
    for (let k = 0; k < view.segments.length; k++) {
      const len = view.segments[k].endSec - view.segments[k].startSec;
      const w = widthOf(len);
      const segStart = starts[k] ?? 0;
      if (time < segStart + len || k === view.segments.length - 1) return x + Math.min(1, Math.max(0, (time - segStart) / len)) * w;
      x += w + 4;
    }
    return x;
  }, [view, starts, time, pps]);

  return (
    <div className="zy-card lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-6">
      <div className="flex items-center justify-between gap-2 lg:col-span-2">
        <div>
          <h2 className="font-display text-[16px] font-semibold">Edit it yourself</h2>
          <p className="mt-0.5 text-[13px] text-[#8d97a8]">
            <span className={overCap ? "text-[#ff6171]" : "text-[#ecd083]"}>{fmt(total)}</span> of {capSec}s allowed
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" aria-label="Undo" className={btn} disabled={!history.past.length || busy} onClick={() => setHistory(undo)}><Undo2 size={18} /></button>
          <button type="button" aria-label="Redo" className={btn} disabled={!history.future.length || busy} onClick={() => setHistory(redo)}><Redo2 size={18} /></button>
        </div>
      </div>

      <div className="min-w-0">
      {/* Live preview: plays your clips as edited, nothing is rendered yet. */}
      <div className="mt-4">
        <PlanPlayer ref={player} plan={current} urls={urls} stills={assets.filter((a) => isImageName(a.originalName)).map((a) => a.id)} onTime={setTime} />
        <div className="mt-3 flex items-center gap-3">
          <span className="w-12 font-mono text-[12px] text-[#8d97a8]">{fmt(time)}</span>
          <input
            type="range" min={0} max={Math.max(0.1, total)} step={0.05} value={Math.min(time, total)}
            aria-label="Scrub through the video"
            onChange={(e) => { const t = Number(e.target.value); setTime(t); player.current?.seek(t); }}
            className="h-11 flex-1 accent-[#d9b45b]"
          />
          <span className="w-12 text-right font-mono text-[12px] text-[#8d97a8]">{fmt(total)}</span>
        </div>
      </div>

      {/* Timeline */}
      <div ref={tlRef} className="mt-2 overflow-x-auto pb-2" style={{ touchAction: "pan-x" }}>
        <div className="relative flex gap-1 py-3" style={{ minWidth: "100%" }}>
          {view.segments.map((seg, i) => {
            const len = seg.endSec - seg.startSec;
            const on = i === sel;
            const c = colorOf(seg.assetId);
            return (
              <div key={`${seg.assetId}-${i}`} className="relative shrink-0" style={{ width: widthOf(len) }}>
                <button
                  type="button"
                  onClick={() => selectPiece(i)}
                  aria-label={`Piece ${i + 1}, ${nameOf(seg.assetId)}, ${fmt(len)}`}
                  aria-pressed={on}
                  className="flex h-16 w-full flex-col justify-between overflow-hidden rounded-[10px] border px-2 py-1.5 text-left"
                  style={{ borderColor: on ? c : "#242a35", background: `linear-gradient(160deg, ${c}33, ${c}0d 70%), #11141b`, boxShadow: on ? `0 0 0 1px ${c}, 0 6px 18px -8px ${c}` : "none" }}
                >
                  <span className="truncate text-[11px] font-semibold text-[#eceff4]">{i + 1}. {nameOf(seg.assetId)}</span>
                  <span className="flex items-center justify-between font-mono text-[10px] text-[#c3cad6]">
                    {fmt(len)}
                    {seg.transition === "fade" && <span style={{ color: "#62adff" }}>fade</span>}
                    {(seg.volume ?? 1) === 0 && <VolumeX size={11} color="#ff6171" />}
                  </span>
                </button>
                {on && !busy && (
                  <>
                    <div
                      role="slider" aria-label="Trim the start" aria-valuenow={seg.startSec}
                      onPointerDown={(e) => onHandleDown(e, i, "start")} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}
                      className="absolute -left-1 top-0 grid h-16 w-5 place-items-center rounded-l-[8px]"
                      style={{ background: c, touchAction: "none", cursor: "ew-resize" }}
                    ><span className="h-6 w-0.5 rounded bg-black/50" /></div>
                    <div
                      role="slider" aria-label="Trim the end" aria-valuenow={seg.endSec}
                      onPointerDown={(e) => onHandleDown(e, i, "end")} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}
                      className="absolute -right-1 top-0 grid h-16 w-5 place-items-center rounded-r-[8px]"
                      style={{ background: c, touchAction: "none", cursor: "ew-resize" }}
                    ><span className="h-6 w-0.5 rounded bg-black/50" /></div>
                  </>
                )}
              </div>
            );
          })}
          <div className="pointer-events-none absolute bottom-1 top-1 w-0.5 rounded bg-[#ff6171]" style={{ left: playheadX }} aria-hidden />
        </div>
      </div>

      {/* Quick actions on the chosen piece */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button type="button" disabled={busy} onClick={splitHere} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[#242a35] bg-[#11141b] text-[13px] font-semibold hover:border-[#d9b45b]/50 disabled:opacity-40"><Scissors size={16} className="text-[#d9b45b]" /> Split</button>
        <button type="button" disabled={busy} onClick={() => run((p) => duplicateSegment(p, sel), () => setSelected(sel + 1))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[#242a35] bg-[#11141b] text-[13px] font-semibold hover:border-[#62adff]/50 disabled:opacity-40"><Copy size={16} className="text-[#62adff]" /> Copy</button>
        <button type="button" disabled={busy || current.segments.length === 1} onClick={() => run((p) => removeSegment(p, sel), () => setSelected(Math.max(0, sel - 1)))} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[12px] border border-[#242a35] bg-[#11141b] text-[13px] font-semibold text-[#ff8a96] hover:border-[#ff6171]/50 disabled:opacity-40"><Trash2 size={16} /> Delete</button>
      </div>

      </div>
      <div className="min-w-0 lg:row-span-1">
      {/* Drawers: one per kind of job, each holds only its own tools */}
      <div className="mt-4 grid grid-cols-3 gap-2" role="tablist" aria-label="Editing tools">
        {DRAWERS.map((d) => {
          const on = drawer === d.id;
          return (
            <button key={d.id} type="button" role="tab" aria-selected={on} onClick={() => setDrawer(d.id)}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-[14px] border text-[12px] font-semibold transition"
              style={{ borderColor: on ? d.tone : "#242a35", color: on ? d.tone : "#8d97a8", background: on ? `${d.tone}14` : "#11141b" }}>
              <d.icon size={18} /> {d.label}
            </button>
          );
        })}
      </div>

      {s && (
        <div className="mt-3 space-y-4 rounded-[14px] border border-[#242a35] bg-[#181c25] p-3" role="tabpanel">
          <p className="text-[12px] text-[#8d97a8]">Piece {sel + 1} of {current.segments.length} · <span className="text-[#eceff4]">{nameOf(s.assetId)}</span></p>

          {drawer === "video" && (
            <>
              <div>
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
              <label className="block text-[13px] text-[#8d97a8]">
                Starts at <b className="text-[#eceff4]">{fmt(s.startSec)}</b>
                <input type="range" min={0} max={Math.max(0, dur - 0.5)} step={0.1} value={s.startSec} disabled={busy}
                  onChange={(e) => run((p) => trimSegment(p, sel, { startSec: Math.min(Number(e.target.value), p.segments[sel].endSec - 0.5) }, assets))}
                  className="mt-1 h-11 w-full accent-[#d9b45b]" />
              </label>
              <label className="block text-[13px] text-[#8d97a8]">
                Ends at <b className="text-[#eceff4]">{fmt(s.endSec)}</b>
                <input type="range" min={0.5} max={dur} step={0.1} value={s.endSec} disabled={busy}
                  onChange={(e) => run((p) => trimSegment(p, sel, { endSec: Math.max(Number(e.target.value), p.segments[sel].startSec + 0.5) }, assets))}
                  className="mt-1 h-11 w-full accent-[#d9b45b]" />
              </label>
              <div className="flex gap-2">
                <button type="button" aria-label="Move earlier" className={btn} disabled={sel === 0 || busy} onClick={() => run((p) => moveSegment(p, sel, sel - 1), () => setSelected(sel - 1))}><ChevronLeft size={18} /></button>
                <button type="button" aria-label="Move later" className={btn} disabled={sel === current.segments.length - 1 || busy} onClick={() => run((p) => moveSegment(p, sel, sel + 1), () => setSelected(sel + 1))}><ChevronRight size={18} /></button>
                <span className="self-center text-[12px] text-[#8d97a8]">Move this piece</span>
              </div>
            </>
          )}

          {drawer === "audio" && (
            <>
              <label className="block text-[13px] text-[#8d97a8]">
                Sound <b className="text-[#eceff4]">{Math.round((s.volume ?? 1) * 100)}%</b>{(s.volume ?? 1) === 0 ? " (muted)" : ""}
                <input type="range" min={0} max={2} step={0.05} value={s.volume ?? 1} disabled={busy}
                  onChange={(e) => run((p) => setVolume(p, sel, Number(e.target.value)))}
                  className="mt-1 h-11 w-full accent-[#3ddba5]" />
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => run((p) => setVolume(p, sel, 0))} className={chip((s.volume ?? 1) === 0)} style={chipStyle((s.volume ?? 1) === 0, "#ff6171")}><VolumeX size={15} className="mr-1 inline" /> Mute</button>
                <button type="button" disabled={busy} onClick={() => run((p) => setVolume(p, sel, 1))} className={chip((s.volume ?? 1) === 1)} style={chipStyle((s.volume ?? 1) === 1, "#3ddba5")}>Original</button>
                <button type="button" disabled={busy} onClick={() => run((p) => setVolume(p, sel, 1.5))} className={chip((s.volume ?? 1) === 1.5)} style={chipStyle((s.volume ?? 1) === 1.5, "#3ddba5")}>Louder</button>
              </div>
              <p className="text-[12px] leading-5 text-[#7b8596]">Preview plays at most 100%. A louder piece is applied when you render.</p>
            </>
          )}

          {drawer === "effects" && (
            <>
              <div>
                <p className="text-[13px] text-[#8d97a8]">How this piece begins</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={busy} aria-pressed={s.transition === "cut"} onClick={() => run((p) => setTransition(p, sel, "cut"))} className={chip(s.transition === "cut")} style={chipStyle(s.transition === "cut", "#62adff")}>Plain cut</button>
                  <button type="button" disabled={busy} aria-pressed={s.transition === "fade"} onClick={() => run((p) => setTransition(p, sel, "fade"))} className={chip(s.transition === "fade")} style={chipStyle(s.transition === "fade", "#62adff")}>Soft fade</button>
                </div>
              </div>
              <div>
                <p className="text-[13px] text-[#8d97a8]">Motion on the first beat (up to 3)</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {([["punch", "Zoom punch"], ["shake", "Shake"], ["flash", "Flash"], ["glitch", "Glitch"], ["whip", "Whip blur"]] as const).map(([id, label]) => {
                    const on = (s.effects ?? []).includes(id);
                    return (
                      <button key={id} type="button" disabled={busy} aria-pressed={on} onClick={() => run((p) => toggleEffect(p, sel, id))} className={chip(on)} style={chipStyle(on, "#d9b45b")}>{label}</button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[12px] leading-5 text-[#7b8596]">Effects and fades show when you export. Text and music are coming next.</p>
            </>
          )}

          {s.reason && drawer === "video" && <p className="text-[12px] leading-5 text-[#7b8596]">Why ZClip chose this: {s.reason}</p>}
        </div>
      )}

      {versions.length > 1 && (
        <details className="mt-4 rounded-[14px] border border-[#242a35] bg-[#181c25]">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[14px] font-medium"><History size={16} className="text-[#d9b45b]" /> Earlier versions</summary>
          <ul className="space-y-2 border-t border-[#242a35] p-3">
            {versions.slice(1).map((v) => (
              <li key={v.version} className="flex items-center justify-between gap-2">
                <span className="text-[13px] text-[#c3cad6]">Version {v.version} · {v.plan.segments.length} pieces · {fmt(v.plan.targetDurationSec)}</span>
                <button type="button" disabled={busy} onClick={() => { setHistory((h) => commit(h, v.plan)); setSelected(0); setNote(""); }}
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
        Manual edits don&apos;t use extra credits. Your earlier video stays saved{original === current ? "" : " until the new one passes the checks"}.
      </p>
      <p className="mt-3 hidden text-center text-[11px] leading-5 text-[#7b8596] lg:block">Shortcuts: Space play · S split · Delete remove · ← → step · ↑ ↓ pick piece · Ctrl+Z undo</p>
      </div>
    </div>
  );
}
