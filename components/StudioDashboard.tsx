"use client";

import { useState } from "react";
import { MyEdits } from "@/components/MyEdits";

import {
  CheckCircle2,
  Film,
  LogOut,
  Plus,
  ShieldCheck,
  Upload,
  Wand2,
} from "lucide-react";
import { ZClipLogo } from "@/components/ZClipLogo";

interface DashboardProps {
  userEmail?: string;
  userCredits?: number;
  onNewProject: () => void;
  onSignOut: () => void;
}

export function StudioDashboard({
  userEmail,
  userCredits,
  onNewProject,
  onSignOut,
}: DashboardProps) {
  const [showMyEdits, setShowMyEdits] = useState(false);
  const hasBalance = typeof userCredits === "number" && Number.isFinite(userCredits);
  const balanceLabel = hasBalance
    ? new Intl.NumberFormat("en-NG").format(userCredits)
    : "—";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#05060a] text-[#eceff4]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[560px] w-[560px] rounded-full bg-[#b88f38]/20 blur-[140px]" />
        <div className="absolute -bottom-64 -left-40 h-[520px] w-[520px] rounded-full bg-[#d9b45b]/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(217,180,91,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(217,180,91,0.025)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-10">
        <header className="flex items-center justify-between gap-3 pb-4">
          <ZClipLogo size={34} variant="horizontal" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowMyEdits(true)} className="inline-flex min-h-11 items-center gap-2 rounded-[14px] border border-[#242a35] bg-[#11141b] px-3.5 text-sm font-medium text-[#eceff4] transition hover:border-[#d9b45b]/50"><Film size={16} className="text-[#d9b45b]" /> My Edits</button>
            <span className="inline-flex min-h-11 items-center rounded-full border border-[#242a35] bg-[#11141b] px-3.5 text-sm text-[#8d97a8]">
              <b className="mr-1 font-semibold text-[#ecd083]">{balanceLabel}</b> {hasBalance ? "credits" : ""}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#242a35] bg-[#11141b] text-[#c3cad6] transition hover:border-[#d9b45b]/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d9b45b]"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {showMyEdits ? <MyEdits onBack={() => setShowMyEdits(false)} /> : null}
        <section className={`grid flex-1 items-center gap-8 py-6 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-20 ${showMyEdits ? "hidden" : ""}`}>
          <div className="max-w-2xl">
            <h1 className="font-display text-[30px] font-semibold leading-[1.15] text-[#eceff4] sm:text-5xl">
              Upload your footage.
              <span className="block text-[#d9b45b]">Let ZClip edit it.</span>
            </h1>

            <p className="mt-4 max-w-md text-[15px] leading-6 text-[#8d97a8]">
              Add your clips, answer a few quick questions if you like, and get a finished video to review. Fix anything yourself, or let ZClip do it.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onNewProject}
                className="group inline-flex min-h-16 w-full items-center justify-center gap-3 rounded-[14px] bg-[linear-gradient(180deg,#ecd083,#b88f38)] px-6 py-3 text-[17px] font-bold text-[#17130A] shadow-[0_0_28px_rgba(217,180,91,0.18)] transition hover:brightness-110 hover:shadow-[0_0_34px_rgba(217,180,91,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                <Plus size={20} />
                Create a video
              </button>
              <p className="text-xs leading-5 text-[#8d97a8]">
                Up to 20 clips · 500 MB per upload batch
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-xs tracking-[0.06em] text-[#8d97a8]">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#d9b45b]" />
                Automatic or manual
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#b88f38]" />
                You approve cost first
              </span>
            </div>
          </div>

          <aside className="relative mx-auto w-full max-w-xl">
            <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#b88f38]/20 via-transparent to-[#d9b45b]/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-[#d9b45b]/20 bg-[#11141b]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.2em] text-[#8d97a8]">
                    HOW IT WORKS
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-white">
                    Three steps. One finished edit.
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d9b45b]/25 bg-[#d9b45b]/[0.08] text-[#ecd083]">
                  <Film size={19} />
                </div>
              </div>

              <ol className="mt-5 space-y-4">
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9b45b]/25 bg-[#d9b45b]/[0.08] text-[#ecd083]">
                    <Upload size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#d9b45b]">01</span>
                      <h3 className="text-sm font-semibold text-white">Upload your clips</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#8d97a8]">
                      Choose the footage you want ZClip to work with.
                    </p>
                  </div>
                </li>

                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#b88f38]/25 bg-[#b88f38]/[0.08] text-[#ecd083]">
                    <Wand2 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#ecd083]">02</span>
                      <h3 className="text-sm font-semibold text-white">Set your direction</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#8d97a8]">
                      Answer three optional questions—or let ZClip decide.
                    </p>
                  </div>
                </li>

                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9b45b]/25 bg-[#d9b45b]/[0.08] text-[#ecd083]">
                    <CheckCircle2 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#d9b45b]">03</span>
                      <h3 className="text-sm font-semibold text-white">Review and render</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#8d97a8]">
                      Check the estimate and approve the maximum credit amount first.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="mt-6 flex gap-3 rounded-xl border border-[#d9b45b]/20 bg-[#d9b45b]/[0.055] p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#ecd083]" />
                <div>
                  <p className="text-xs font-semibold text-white">A cost check before every render</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#8d97a8]">
                    ZClip shows the expected credits and the maximum you authorise before it starts processing.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className={`grid gap-3 border-t border-white/10 py-6 sm:grid-cols-3 sm:gap-5 ${showMyEdits ? "hidden" : ""}`}>
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#d9b45b]/[0.08] text-[#ecd083]">
              <Wand2 size={16} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Automatic first</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#8d97a8]">
                A guided workflow does the heavy lifting without a crowded editor.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#b88f38]/[0.08] text-[#ecd083]">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Quality checks</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#8d97a8]">
                The rendered file is inspected before ZClip marks the edit as ready.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-[10px] text-[#7b8596] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono tracking-[0.12em]">ZYRON CLIP STUDIO</span>
          <span>Proudly by Zyron</span>
        </footer>
      </div>
    </main>
  );
}
