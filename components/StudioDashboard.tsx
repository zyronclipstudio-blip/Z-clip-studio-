"use client";

import { useEffect, useState } from "react";
import { Film, Home, LogOut, Plus, ShieldCheck, Upload, Wand2 } from "lucide-react";
import { MyEdits } from "@/components/MyEdits";
import { ZClipMark } from "@/components/ZClipMark";

interface DashboardProps {
  view: "home" | "edits";
  userCredits?: number;
  onNewProject: () => void;
  onOpenProject?: (id: string) => void;
  onShowEdits: () => void;
  onBackHome: () => void;
  opening?: boolean;
  openError?: string;
}

const STEPS = [
  { icon: Upload, title: "Add your clips", tone: "blue" },
  { icon: Wand2, title: "ZClip edits it", tone: "" },
  { icon: ShieldCheck, title: "Review and fix", tone: "green" },
];

export function StudioDashboard({ view, userCredits, onNewProject, onOpenProject, onShowEdits, onBackHome, opening, openError }: DashboardProps) {
  const [counts, setCounts] = useState<{ ready: number; working: number; total: number; lastReadyId?: string } | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/projects", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!live || !d || !Array.isArray(d.projects)) return;
        const list = d.projects as { id: string; status: string }[];
        const ready = list.filter((p) => p.status === "ready").length;
        const failed = list.filter((p) => ["failed", "qa_failed", "unavailable"].includes(p.status)).length;
        setCounts({ ready, working: list.length - ready - failed, total: list.length, lastReadyId: list.find((p) => p.status === "ready")?.id });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const balanceLabel = typeof userCredits === "number" && Number.isFinite(userCredits) ? new Intl.NumberFormat("en-NG").format(userCredits) : "—";

  if (view === "edits") return <MyEdits onBack={onBackHome} onOpen={onOpenProject} />;

  return (
    <div className="zy-pop flex flex-col gap-5">
            <section className="relative flex flex-col gap-2 overflow-hidden rounded-[24px] border border-[#242a35] p-5 [background:linear-gradient(160deg,rgba(246,220,146,.12),rgba(246,220,146,.02)_45%),#0d1017]">
              <ZClipMark className="pointer-events-none absolute -right-8 -top-6 h-44 w-44 opacity-[0.07]" />
              <h1 className="text-[26px] font-semibold leading-[1.15] tracking-[-0.01em] text-balance">
                Upload your footage.
                <span className="block bg-gradient-to-r from-[#f6dc92] to-[#d9b45b] bg-clip-text text-transparent">Let ZClip edit it.</span>
              </h1>
              <p className="max-w-sm text-[15px] leading-6 text-[#8d97a8]">
                Add your clips, answer a few quick questions if you like, and get a finished video to review. Fix anything yourself, or let ZClip do it.
              </p>
              <button type="button" onClick={onNewProject} className="zy-btn-gold mt-3 flex min-h-16 w-full items-center justify-center gap-3 rounded-[14px] text-[17px] transition active:scale-[0.99]">
                <Plus size={20} />
                Create a video
              </button>
            </section>


            {counts?.lastReadyId && onOpenProject && (
              <button type="button" disabled={opening} onClick={() => onOpenProject(counts.lastReadyId!)} className="zy-card flex min-h-16 w-full items-center gap-3 text-left transition hover:brightness-110 disabled:opacity-60">
                <span className="zy-icon h-11 w-11 rounded-[14px]"><Wand2 size={19} /></span>
                <span className="flex-1">
                  <b className="block text-[15px] font-semibold">{opening ? "Opening…" : "Continue your last edit"}</b>
                  <span className="text-[13px] text-[#8d97a8]">Fix it by hand, or try a different shape</span>
                </span>
              </button>
            )}
            {openError && <p role="alert" className="text-[13px] text-[#ff8a96]">{openError}</p>}

            <div className="grid grid-cols-3 gap-2.5">
              <div className="zy-kpi"><small>Credits</small><b>{balanceLabel}</b></div>
              <div className="zy-kpi green"><small>Ready</small><b>{counts ? counts.ready : "—"}</b></div>
              <div className="zy-kpi blue"><small>In progress</small><b>{counts ? counts.working : "—"}</b></div>
            </div>

            <button type="button" onClick={() => onShowEdits()} className="zy-card flex min-h-16 w-full items-center gap-3 text-left transition hover:brightness-110">
              <span className="zy-icon rose h-11 w-11 rounded-[14px]"><Film size={19} /></span>
              <span className="flex-1">
                <b className="block text-[15px] font-semibold">My Edits</b>
                <span className="text-[13px] text-[#8d97a8]">{counts && counts.total ? `${counts.total} video${counts.total === 1 ? "" : "s"} saved` : "Your finished and in-progress videos"}</span>
              </span>
            </button>

            <section className="grid grid-cols-3 gap-2.5" aria-label="How it works">
              {STEPS.map(({ icon: Icon, title, tone }) => (
                <div key={title} className="flex flex-col items-center gap-2 rounded-[18px] border border-[#242a35] bg-[#11141b] px-2 py-3 text-center">
                  <span className={`zy-icon ${tone} h-11 w-11 rounded-[14px]`}><Icon size={19} /></span>
                  <b className="text-[12px] font-medium leading-4 text-[#c3cad6]">{title}</b>
                </div>
              ))}
            </section>
          </div>
  );
}
