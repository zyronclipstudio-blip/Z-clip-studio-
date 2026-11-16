"use client";

import {
  ArrowRight,
  CheckCircle2,
  Film,
  LogOut,
  ShieldCheck,
  Sparkles,
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
  const hasBalance = typeof userCredits === "number" && Number.isFinite(userCredits);
  const balanceLabel = hasBalance
    ? new Intl.NumberFormat("en-NG").format(userCredits)
    : "—";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08080A] text-[#F5F1E6]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-40 -top-48 h-[560px] w-[560px] rounded-full bg-[#8B6A22]/20 blur-[140px]" />
        <div className="absolute -bottom-64 -left-40 h-[520px] w-[520px] rounded-full bg-[#D4AF37]/10 blur-[140px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(212,175,55,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(212,175,55,0.025)_1px,transparent_1px)] bg-[size:42px_42px] opacity-40" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="flex min-w-0 items-center gap-3">
            <ZClipLogo size={42} variant="horizontal" />
            <span className="hidden rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-3 py-1.5 font-mono text-[9px] tracking-[0.2em] text-[#F3E3B3] sm:inline-flex">
              PROTOTYPE 01
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:px-4">
              <p className="font-mono text-[9px] tracking-[0.16em] text-[#A39A86]">
                ACCOUNT CREDITS
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5 font-mono text-sm font-semibold text-white">
                {balanceLabel}
                <span className="font-sans text-[10px] font-normal text-[#A39A86]">
                  {hasBalance ? "available" : "not loaded"}
                </span>
              </p>
            </div>

            <div className="hidden max-w-[190px] sm:block">
              <p className="truncate text-xs font-medium text-white">
                {userEmail ?? "Your account"}
              </p>
              <p className="mt-1 font-mono text-[9px] tracking-[0.14em] text-[#A39A86]">
                SIGNED IN
              </p>
            </div>

            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#C8BEA8] transition hover:border-[#D4AF37]/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4AF37]"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12 lg:py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] px-3 py-1.5 font-mono text-[10px] tracking-[0.16em] text-[#F3E3B3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37] shadow-[0_0_10px_rgba(212,175,55,0.9)]" />
              GUIDED AUTOMATIC EDITING
            </div>

            <h1 className="mt-6 font-display text-[clamp(2.7rem,7vw,5.5rem)] font-bold leading-[0.98] tracking-[-0.055em] text-white">
              Your footage.
              <span className="mt-2 block bg-gradient-to-r from-[#D4AF37] via-[#E5C76B] to-[#BFA15A] bg-clip-text text-transparent">
                Without the busywork.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-7 text-[#C8BEA8] sm:text-base">
              Add your clips, tell ZClip what you are making, and let it plan and
              render the edit. You stay in control of the direction and approve
              the cost before processing begins.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onNewProject}
                className="group inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#8BEAF7]/50 bg-gradient-to-r from-[#D4AF37] to-[#E5C76B] px-6 py-3 text-sm font-bold text-[#06101B] shadow-[0_0_28px_rgba(212,175,55,0.18)] transition hover:brightness-110 hover:shadow-[0_0_34px_rgba(212,175,55,0.3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                <Sparkles size={17} />
                Create a new edit
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </button>
              <p className="text-xs leading-5 text-[#A39A86]">
                Up to 20 clips · 500 MB per upload batch
              </p>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-5 text-[10px] font-mono tracking-[0.12em] text-[#A39A86]">
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
                NO TEMPLATE MAZE
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#BFA15A]" />
                COST APPROVAL FIRST
              </span>
            </div>
          </div>

          <aside className="relative mx-auto w-full max-w-xl">
            <div aria-hidden="true" className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-[#8B6A22]/20 via-transparent to-[#D4AF37]/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-[#D4AF37]/20 bg-[#111114]/90 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-7">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <p className="font-mono text-[9px] tracking-[0.2em] text-[#A39A86]">
                    THE WORKFLOW
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-white">
                    Three steps. One finished edit.
                  </h2>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] text-[#F3E3B3]">
                  <Film size={19} />
                </div>
              </div>

              <ol className="mt-5 space-y-4">
                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] text-[#F3E3B3]">
                    <Upload size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#D4AF37]">01</span>
                      <h3 className="text-sm font-semibold text-white">Upload your clips</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#A39A86]">
                      Choose the footage you want ZClip to work with.
                    </p>
                  </div>
                </li>

                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#BFA15A]/25 bg-[#BFA15A]/[0.08] text-[#E5D09A]">
                    <Wand2 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#E5D09A]">02</span>
                      <h3 className="text-sm font-semibold text-white">Set your direction</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#A39A86]">
                      Answer three optional questions—or let ZClip decide.
                    </p>
                  </div>
                </li>

                <li className="flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] text-[#F3E3B3]">
                    <CheckCircle2 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[9px] text-[#D4AF37]">03</span>
                      <h3 className="text-sm font-semibold text-white">Review and render</h3>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#A39A86]">
                      Check the estimate and approve the maximum credit amount first.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="mt-6 flex gap-3 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-4">
                <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#F3E3B3]" />
                <div>
                  <p className="text-xs font-semibold text-white">A cost check before every render</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#A39A86]">
                    ZClip shows the expected credits and the maximum you authorise before it starts processing.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </section>

        <section className="grid gap-3 border-t border-white/10 py-6 sm:grid-cols-3 sm:gap-5">
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/[0.08] text-[#F3E3B3]">
              <Wand2 size={16} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Automatic first</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#A39A86]">
                A guided workflow does the heavy lifting without a crowded editor.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#BFA15A]/[0.08] text-[#E5D09A]">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Quality checks</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#A39A86]">
                The rendered file is inspected before ZClip marks the edit as ready.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D4AF37]/[0.08] text-[#F3E3B3]">
              <Film size={16} />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-white">Focused prototype</h2>
              <p className="mt-1 text-[11px] leading-5 text-[#A39A86]">
                Built around turning your clips into one finished video—not a template catalogue.
              </p>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-white/10 pt-5 text-[10px] text-[#8C8068] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono tracking-[0.12em]">ZYRON CLIP STUDIO</span>
          <span>Prototype 1 · Guided automatic video editing</span>
        </footer>
      </div>
    </main>
  );
}
