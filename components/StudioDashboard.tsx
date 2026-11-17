"use client";

import { useState } from "react";
import { Film, LogOut, Plus, ShieldCheck, Upload, Wand2 } from "lucide-react";
import { MyEdits } from "@/components/MyEdits";
import { ZClipLogo } from "@/components/ZClipLogo";

interface DashboardProps {
  userEmail?: string;
  userCredits?: number;
  onNewProject: () => void;
  onSignOut: () => void;
}

const STEPS = [
  { icon: Upload, title: "Add your clips", text: "Up to 20 clips, 500 MB per batch." },
  { icon: Wand2, title: "ZClip edits it", text: "Cuts, pacing and music planned for you. You approve the cost first." },
  { icon: ShieldCheck, title: "Review and fix", text: "Check the result, then change anything yourself or let ZClip redo it." },
];

export function StudioDashboard({ userEmail, userCredits, onNewProject, onSignOut }: DashboardProps) {
  const [showMyEdits, setShowMyEdits] = useState(false);
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
          <MyEdits onBack={() => setShowMyEdits(false)} />
        ) : (
          <>
            <section className="mt-2 flex flex-col gap-2">
              <h1 className="text-[30px] font-semibold leading-[1.15] text-balance">
                Upload your footage.
                <span className="block text-[#d9b45b]">Let ZClip edit it.</span>
              </h1>
              <p className="max-w-sm text-[15px] leading-6 text-[#8d97a8]">
                Add your clips, answer a few quick questions if you like, and get a finished video to review. Fix anything yourself, or let ZClip do it.
              </p>
            </section>

            <button
              type="button"
              onClick={onNewProject}
              className="flex min-h-16 w-full items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(180deg,#ecd083,#b88f38)] text-[17px] font-bold text-[#17120a] shadow-[0_0_32px_rgba(217,180,91,0.28)] transition active:scale-[0.99]"
            >
              <Plus size={20} />
              Create a video
            </button>

            <button
              type="button"
              onClick={() => setShowMyEdits(true)}
              className="flex min-h-14 w-full items-center gap-3 rounded-[16px] border border-[#242a35] bg-[#11141b] px-4 text-left transition hover:border-[#d9b45b]/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#d9b45b]/10 text-[#ecd083]"><Film size={18} /></span>
              <span className="flex-1">
                <b className="block text-[15px] font-semibold">My Edits</b>
                <span className="text-[13px] text-[#8d97a8]">Your finished and in-progress videos</span>
              </span>
            </button>

            <section className="flex flex-col gap-3 rounded-[20px] border border-[#242a35] bg-[#11141b] p-4">
              <h2 className="text-[16px] font-semibold">How it works</h2>
              <ol className="flex flex-col gap-4">
                {STEPS.map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#d9b45b]/10 text-[#ecd083]"><Icon size={18} /></span>
                    <div>
                      <b className="block text-[15px] font-semibold">{title}</b>
                      <p className="text-[13px] leading-5 text-[#8d97a8]">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <p className="mt-auto text-center text-xs tracking-[0.04em] text-[#7b8596]">Proudly by Zyron</p>
      </div>
    </main>
  );
}
