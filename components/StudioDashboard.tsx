"use client";

import { useEffect, useState } from "react";
import { Film, Home, LogOut, Plus, ShieldCheck, Upload, Wand2 } from "lucide-react";
import { MyEdits } from "@/components/MyEdits";
import { ZClipLogo } from "@/components/ZClipLogo";

interface DashboardProps {
  userEmail?: string;
  userCredits?: number;
  onNewProject: () => void;
  onOpenProject?: (id: string) => void;
  opening?: boolean;
  openError?: string;
  onSignOut: () => void;
}

const STEPS = [
  { icon: Upload, title: "Add your clips", text: "Up to 20 clips, 500 MB per batch." },
  { icon: Wand2, title: "ZClip edits it", text: "Cuts, pacing and music planned for you. You approve the cost first." },
  { icon: ShieldCheck, title: "Review and fix", text: "Check the result, then change anything yourself or let ZClip redo it." },
];

export function StudioDashboard({ userEmail, userCredits, onNewProject, onOpenProject, opening, openError, onSignOut }: DashboardProps) {
  const [showMyEdits, setShowMyEdits] = useState(false);
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
  const hasBalance = typeof userCredits === "number" && Number.isFinite(userCredits);
  const balanceLabel = hasBalance ? new Intl.NumberFormat("en-NG").format(userCredits) : "—";

  return (
    <main className="relative min-h-screen bg-[#05060a] text-[#eceff4] [background-image:radial-gradient(120%_60%_at_50%_-10%,#1f1b10_0%,transparent_60%)]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-5 pb-8 pt-5">
        <header className="flex items-center justify-between gap-3">
          <ZClipLogo size={34} variant="horizontal" />
          <div className="flex items-center gap-2">
            <span className="inline-flex min-h-11 items-center rounded-full border border-[#242a35] bg-[#11141b] px-3.5 text-sm text-[#8d97a8]">
              <b className="mr-1 font-semibold text-[#ecd083]">{balanceLabel}</b>
              {hasBalance ? "credits" : ""}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title={userEmail ? `Sign out ${userEmail}` : "Sign out"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#242a35] bg-[#11141b] text-[#c3cad6] transition hover:border-[#d9b45b]/40"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {showMyEdits ? (
          <MyEdits onBack={() => setShowMyEdits(false)} onOpen={onOpenProject} />
        ) : (
          <div className="zy-pop flex flex-col gap-5">
            <section className="mt-1 flex flex-col gap-2">
              <h1 className="text-[30px] font-semibold leading-[1.15] text-balance">
                Upload your footage.
                <span className="block bg-gradient-to-r from-[#f6dc92] to-[#d9b45b] bg-clip-text text-transparent">Let ZClip edit it.</span>
              </h1>
              <p className="max-w-sm text-[15px] leading-6 text-[#8d97a8]">
                Add your clips, answer a few quick questions if you like, and get a finished video to review. Fix anything yourself, or let ZClip do it.
              </p>
            </section>

            <button type="button" onClick={onNewProject} className="zy-btn-gold flex min-h-16 w-full items-center justify-center gap-3 rounded-[14px] text-[17px] transition active:scale-[0.99]">
              <Plus size={20} />
              Create a video
            </button>

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
              <div className="zy-kpi"><small>Ready</small><b>{counts ? counts.ready : "—"}</b></div>
              <div className="zy-kpi"><small>In progress</small><b>{counts ? counts.working : "—"}</b></div>
            </div>

            <button type="button" onClick={() => setShowMyEdits(true)} className="zy-card flex min-h-16 w-full items-center gap-3 text-left transition hover:brightness-110">
              <span className="zy-icon h-11 w-11 rounded-[14px]"><Film size={19} /></span>
              <span className="flex-1">
                <b className="block text-[15px] font-semibold">My Edits</b>
                <span className="text-[13px] text-[#8d97a8]">{counts && counts.total ? `${counts.total} video${counts.total === 1 ? "" : "s"} saved` : "Your finished and in-progress videos"}</span>
              </span>
            </button>

            <section className="zy-card flex flex-col gap-3">
              <h2 className="text-[16px] font-semibold">How it works</h2>
              <ol className="flex flex-col gap-4">
                {STEPS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="zy-icon h-10 w-10 shrink-0 rounded-[12px]"><Icon size={18} /></span>
                    <div>
                      <b className="block text-[15px] font-semibold">{title}</b>
                      <p className="text-[13px] leading-5 text-[#8d97a8]">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        )}

        <p className="mt-auto pb-20 text-center text-xs tracking-[0.04em] text-[#7b8596]">Proudly by Zyron</p>
      </div>
      <nav className="zy-nav" aria-label="Main">
        <button type="button" aria-current={showMyEdits ? undefined : "page"} onClick={() => setShowMyEdits(false)}><Home size={22} />Home</button>
        <button type="button" className="fab" onClick={onNewProject} aria-label="Create a video"><span className="disc"><Plus size={26} strokeWidth={2.4} /></span></button>
        <button type="button" aria-current={showMyEdits ? "page" : undefined} onClick={() => setShowMyEdits(true)}><Film size={22} />My Edits</button>
      </nav>
    </main>
  );
}
