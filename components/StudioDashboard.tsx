"use client";

import React, { useState } from "react";
import {
  LayoutDashboard,
  FolderKanban,
  LayoutTemplate,
  Wand2,
  HardDrive,
  Settings,
  HelpCircle,
  Crown,
  Search,
  Bell,
  PlusCircle,
  Video,
  Download,
  Cloud,
  TrendingUp,
  Sparkles,
  Play,
  Pause,
  Scissors,
  Layers,
  Type,
  Music,
  Sliders,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Smartphone,
  ChevronRight,
} from "lucide-react";
import { ZClipLogo } from "@/components/ZClipLogo";

interface DashboardProps {
  userEmail?: string;
  userCredits?: number;
  onNewProject: () => void;
  onSignOut: () => void;
}

export function StudioDashboard({
  userEmail = "creator@studio.com",
  userCredits = 100,
  onNewProject,
  onSignOut,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "projects" | "templates" | "ai-tools" | "storage" | "pricing"
  >("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-[#080B11] text-[#F4F7FB] flex flex-col font-sans selection:bg-[#00D4FF] selection:text-black">
      {/* Cosmic background glows */}
      <div className="fixed top-0 right-1/4 w-[750px] h-[550px] bg-gradient-to-b from-[#001AFF]/20 via-[#0075FF]/10 to-transparent rounded-full blur-[160px] pointer-events-none" />
      <div className="fixed bottom-10 left-10 w-[550px] h-[450px] bg-[#00D4FF]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Main Studio Frame */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-[#1C283F] bg-[#0A0E18]/80 backdrop-blur-xl flex flex-col justify-between p-4 shrink-0">
          <div className="space-y-6">
            {/* Top Brand Logo */}
            <div className="px-2 pt-2">
              <ZClipLogo size={42} variant="horizontal" />
            </div>

            {/* Nav Menu */}
            <nav className="space-y-1.5 pt-2">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "dashboard"
                    ? "bg-gradient-to-r from-[#0075FF] to-[#001AFF] text-white shadow-[0_0_15px_rgba(0,117,255,0.4)]"
                    : "text-[#8A99AD] hover:text-white hover:bg-[#151F33]"
                }`}
              >
                <LayoutDashboard size={18} />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("projects");
                  onNewProject();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "projects"
                    ? "bg-gradient-to-r from-[#0075FF] to-[#001AFF] text-white shadow-[0_0_15px_rgba(0,117,255,0.4)]"
                    : "text-[#8A99AD] hover:text-white hover:bg-[#151F33]"
                }`}
              >
                <FolderKanban size={18} />
                <span>My Projects</span>
              </button>

              <button
                onClick={() => setActiveTab("templates")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "templates"
                    ? "bg-gradient-to-r from-[#0075FF] to-[#001AFF] text-white shadow-[0_0_15px_rgba(0,117,255,0.4)]"
                    : "text-[#8A99AD] hover:text-white hover:bg-[#151F33]"
                }`}
              >
                <LayoutTemplate size={18} />
                <span>Templates</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab("ai-tools");
                  onNewProject();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "ai-tools"
                    ? "bg-gradient-to-r from-[#0075FF] to-[#001AFF] text-white shadow-[0_0_15px_rgba(0,117,255,0.4)]"
                    : "text-[#8A99AD] hover:text-white hover:bg-[#151F33]"
                }`}
              >
                <Wand2 size={18} className="text-[#00D4FF]" />
                <span>AI Tools</span>
              </button>

              <button
                onClick={() => setActiveTab("storage")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "storage"
                    ? "bg-gradient-to-r from-[#0075FF] to-[#001AFF] text-white shadow-[0_0_15px_rgba(0,117,255,0.4)]"
                    : "text-[#8A99AD] hover:text-white hover:bg-[#151F33]"
                }`}
              >
                <HardDrive size={18} />
                <span>Storage</span>
              </button>

              <button
                onClick={() => setActiveTab("pricing")}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeTab === "pricing"
                    ? "bg-gradient-to-r from-[#0075FF] to-[#001AFF] text-white shadow-[0_0_15px_rgba(0,117,255,0.4)]"
                    : "text-[#8A99AD] hover:text-white hover:bg-[#151F33]"
                }`}
              >
                <Crown size={18} className="text-[#F2B84B]" />
                <span>Pricing Plans</span>
              </button>
            </nav>
          </div>

          {/* Bottom Upgrade Card */}
          <div className="space-y-3 pt-4 border-t border-[#1C283F]">
            <div className="rounded-2xl bg-gradient-to-br from-[#101726] to-[#0D1424] border border-[#1C283F] p-4 text-center relative overflow-hidden">
              <div className="absolute -right-6 -bottom-6 w-20 h-20 bg-[#00D4FF]/10 rounded-full blur-xl" />
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#00D4FF] mb-1">
                <Crown size={14} className="text-[#F2B84B]" />
                <span>Pro Plan Available</span>
              </div>
              <p className="text-[11px] text-[#8A99AD] mb-3">
                Unlock 4K Export, Unlimited AI Assembly & Priority Cloud Queue.
              </p>
              <button
                onClick={() => setActiveTab("pricing")}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-[#0075FF] to-[#00D4FF] text-black font-semibold text-xs shadow-[0_0_15px_rgba(0,212,255,0.4)] hover:brightness-110 transition"
              >
                Upgrade to Pro
              </button>
            </div>

            <div className="flex items-center justify-between text-xs px-2 text-[#8A99AD]">
              <span className="truncate max-w-[120px]">{userEmail}</span>
              <button onClick={onSignOut} className="hover:text-white underline">
                Sign out
              </button>
            </div>
          </div>
        </aside>

        {/* Center Main Stage */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* Top Bar */}
          <header className="h-16 border-b border-[#1C283F] bg-[#0A0E18]/60 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
            {/* Search */}
            <div className="relative w-80">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8A99AD]" />
              <input
                type="text"
                placeholder="Search projects, clips, templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#151F33] border border-[#1C283F] rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-[#8A99AD] outline-none focus:border-[#00D4FF] transition"
              />
            </div>

            {/* Profile & Notifications */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-[#151F33] border border-[#1C283F] px-3 py-1.5 rounded-xl text-xs">
                <span className="w-2 h-2 rounded-full bg-[#30C98B] animate-pulse" />
                <span className="font-mono text-[#00D4FF] font-semibold">{userCredits}</span>
                <span className="text-[#8A99AD]">credits</span>
              </div>

              <button className="w-9 h-9 rounded-xl bg-[#151F33] border border-[#1C283F] flex items-center justify-center text-[#8A99AD] hover:text-white transition">
                <Bell size={16} />
              </button>

              <div className="flex items-center gap-2.5 pl-2 border-l border-[#1C283F]">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#001AFF] to-[#00D4FF] flex items-center justify-center text-xs font-bold text-white shadow-[0_0_8px_rgba(0,212,255,0.4)]">
                  C
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-semibold leading-none">Creator Studio</p>
                  <p className="text-[10px] text-[#00D4FF] font-mono leading-none mt-1">PRO PLAN</p>
                </div>
              </div>
            </div>
          </header>

          {/* Content Space */}
          <main className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto w-full">
            {/* Welcome Banner with Cosmic Earth Arc */}
            <div className="relative rounded-3xl border border-[#1C283F] bg-gradient-to-r from-[#0D1424] via-[#101726] to-[#0A0E18] p-8 overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
              {/* Cosmic Earth Arc graphic in background */}
              <div className="absolute right-0 top-0 bottom-0 w-2/5 pointer-events-none opacity-40 overflow-hidden">
                <div className="absolute -right-20 -top-20 w-[480px] h-[480px] rounded-full border-4 border-[#00D4FF]/40 bg-gradient-to-b from-[#0075FF]/30 to-transparent blur-[2px] shadow-[0_0_60px_rgba(0,212,255,0.5)]" />
              </div>

              <div className="relative z-10 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-xs text-[#00D4FF] font-mono mb-4">
                  <Sparkles size={13} />
                  <span>AI VIDEO ENGINE V0.5</span>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                  Welcome back, Creator! 👋
                </h1>
                <p className="mt-2 text-sm text-[#8A99AD] font-sans">
                  Turn your raw footage into stunning publishable videos. Upload clips, pick an intent, and let ZClip do the editing.
                </p>
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 relative z-10">
                <div className="rounded-2xl border border-[#1C283F] bg-[#151F33]/80 backdrop-blur-md p-4">
                  <div className="flex items-center justify-between text-[#8A99AD]">
                    <span className="text-xs">Total Projects</span>
                    <Video size={16} className="text-[#00D4FF]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">24</div>
                </div>

                <div className="rounded-2xl border border-[#1C283F] bg-[#151F33]/80 backdrop-blur-md p-4">
                  <div className="flex items-center justify-between text-[#8A99AD]">
                    <span className="text-xs">Exports</span>
                    <Download size={16} className="text-[#0075FF]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">18</div>
                </div>

                <div className="rounded-2xl border border-[#1C283F] bg-[#151F33]/80 backdrop-blur-md p-4">
                  <div className="flex items-center justify-between text-[#8A99AD]">
                    <span className="text-xs">Storage Used</span>
                    <Cloud size={16} className="text-[#30C98B]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-white mt-1">8.7 GB</div>
                  <span className="text-[10px] text-[#8A99AD]">/ 100 GB</span>
                </div>

                <div className="rounded-2xl border border-[#1C283F] bg-[#151F33]/80 backdrop-blur-md p-4">
                  <div className="flex items-center justify-between text-[#8A99AD]">
                    <span className="text-xs">This Month</span>
                    <TrendingUp size={16} className="text-[#00D4FF]" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#00D4FF] mt-1">+48%</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#8A99AD] mb-3">
                Quick Actions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={onNewProject}
                  className="group relative rounded-2xl border border-[#00D4FF]/40 bg-gradient-to-b from-[#151F33] to-[#0D1424] p-5 text-left transition-all duration-200 hover:border-[#00D4FF] hover:shadow-[0_0_25px_rgba(0,212,255,0.25)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center text-[#00D4FF] mb-3 group-hover:scale-105 transition">
                    <PlusCircle size={20} />
                  </div>
                  <h3 className="font-semibold text-white text-sm">New Project</h3>
                  <p className="text-xs text-[#8A99AD] mt-1">Start editing raw clips</p>
                </button>

                <button
                  onClick={() => setActiveTab("templates")}
                  className="group relative rounded-2xl border border-[#1C283F] bg-[#101726] p-5 text-left transition-all duration-200 hover:border-[#0075FF] hover:shadow-[0_0_20px_rgba(0,117,255,0.2)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0075FF]/10 border border-[#0075FF]/30 flex items-center justify-center text-[#0075FF] mb-3 group-hover:scale-105 transition">
                    <LayoutTemplate size={20} />
                  </div>
                  <h3 className="font-semibold text-white text-sm">Use Template</h3>
                  <p className="text-xs text-[#8A99AD] mt-1">Pick a pre-cut style</p>
                </button>

                <button
                  onClick={onNewProject}
                  className="group relative rounded-2xl border border-[#1C283F] bg-[#101726] p-5 text-left transition-all duration-200 hover:border-[#00D4FF] hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#00D4FF]/10 border border-[#00D4FF]/30 flex items-center justify-center text-[#00D4FF] mb-3 group-hover:scale-105 transition">
                    <Wand2 size={20} />
                  </div>
                  <h3 className="font-semibold text-white text-sm">AI Auto Edit</h3>
                  <p className="text-xs text-[#8A99AD] mt-1">Let AI arrange the cuts</p>
                </button>

                <button
                  onClick={onNewProject}
                  className="group relative rounded-2xl border border-[#1C283F] bg-[#101726] p-5 text-left transition-all duration-200 hover:border-[#30C98B] hover:shadow-[0_0_20px_rgba(48,201,139,0.2)]"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#30C98B]/10 border border-[#30C98B]/30 flex items-center justify-center text-[#30C98B] mb-3 group-hover:scale-105 transition">
                    <Cloud size={20} />
                  </div>
                  <h3 className="font-semibold text-white text-sm">Upload Media</h3>
                  <p className="text-xs text-[#8A99AD] mt-1">Send footage to Backblaze B2</p>
                </button>
              </div>
            </div>

            {/* Editing Workspace Showcase (Exact Match to Picture) */}
            <div className="rounded-3xl border border-[#1C283F] bg-[#0A0E18] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1C283F]">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#00D4FF] animate-pulse" />
                  <h3 className="font-display font-semibold text-white text-sm sm:text-base">
                    Editing Workspace Preview
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#151F33] text-[#00D4FF] border border-[#1C283F]">
                    MULTITRACK TIMELINE
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={onNewProject}
                    className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#0075FF] to-[#00D4FF] text-black font-semibold text-xs shadow-[0_0_12px_rgba(0,212,255,0.4)] hover:brightness-110 transition"
                  >
                    Launch Editor
                  </button>
                </div>
              </div>

              {/* Workspace Layout */}
              <div className="grid grid-cols-12 gap-4">
                {/* Tools bar */}
                <div className="col-span-1 border-r border-[#1C283F] pr-2 flex flex-col items-center gap-4 py-2 text-[#8A99AD]">
                  <button className="p-2 rounded-xl bg-[#151F33] text-[#00D4FF] hover:bg-[#1C283F]">
                    <Video size={16} />
                  </button>
                  <button className="p-2 rounded-xl hover:text-white hover:bg-[#151F33]">
                    <Layers size={16} />
                  </button>
                  <button className="p-2 rounded-xl hover:text-white hover:bg-[#151F33]">
                    <Type size={16} />
                  </button>
                  <button className="p-2 rounded-xl hover:text-white hover:bg-[#151F33]">
                    <Scissors size={16} />
                  </button>
                  <button className="p-2 rounded-xl hover:text-white hover:bg-[#151F33]">
                    <Music size={16} />
                  </button>
                  <button className="p-2 rounded-xl hover:text-white hover:bg-[#151F33]">
                    <Sliders size={16} />
                  </button>
                </div>

                {/* Video Monitor */}
                <div className="col-span-8 bg-[#0D1424] rounded-2xl border border-[#1C283F] overflow-hidden flex flex-col justify-between relative aspect-video">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                  
                  {/* Neon Cybercar Visual Placeholder */}
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-tr from-[#001AFF]/30 via-transparent to-[#00D4FF]/20">
                    <div className="text-center z-20">
                      <div className="w-16 h-16 rounded-full bg-[#00D4FF]/20 border border-[#00D4FF] flex items-center justify-center text-[#00D4FF] mx-auto mb-2 cursor-pointer shadow-[0_0_20px_rgba(0,212,255,0.5)] hover:scale-110 transition" onClick={() => setIsPlaying(!isPlaying)}>
                        {isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-1" />}
                      </div>
                      <p className="text-xs font-mono text-white/80">Cyber_Night_Runner_4K.mp4</p>
                    </div>
                  </div>

                  <div className="relative z-20 p-3 flex justify-between items-center text-xs text-white/70">
                    <span className="font-mono bg-black/60 px-2 py-0.5 rounded">00:14 / 01:00</span>
                    <span className="font-mono bg-black/60 px-2 py-0.5 rounded text-[#00D4FF]">1080x1920 (9:16)</span>
                  </div>
                </div>

                {/* Right Filter & Adjustments Palette */}
                <div className="col-span-3 bg-[#101726] rounded-2xl border border-[#1C283F] p-3 space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold pb-2 border-b border-[#1C283F]">
                    <span>Effects</span>
                    <span className="text-[#8A99AD] hover:text-white cursor-pointer">Filters &rarr;</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {["Glow", "Blur", "Zoom", "Color", "Film", "Shake"].map((fx) => (
                      <div
                        key={fx}
                        className="rounded-xl border border-[#1C283F] bg-[#151F33] p-2 text-center text-xs hover:border-[#00D4FF] cursor-pointer transition"
                      >
                        <div className="w-full h-8 rounded-lg bg-gradient-to-tr from-[#0075FF]/30 to-[#00D4FF]/30 mb-1" />
                        <span className="text-[11px] text-[#F4F7FB]">{fx}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audio Waveform & Multi-Track Timeline */}
                <div className="col-span-12 rounded-2xl border border-[#1C283F] bg-[#101726] p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#8A99AD] font-mono px-2">
                    <span>TRACK 1: VIDEO CUTS (4 CLIPS)</span>
                    <span className="text-[#00D4FF]">BEAT DETECTED (128 BPM)</span>
                  </div>

                  {/* Cut Segments */}
                  <div className="h-10 rounded-xl bg-[#0D1424] border border-[#1C283F] flex p-1 gap-1">
                    <div className="w-1/4 rounded-lg bg-[#0075FF]/40 border border-[#0075FF] flex items-center justify-center text-[10px] text-white font-mono">
                      Clip_01
                    </div>
                    <div className="w-1/3 rounded-lg bg-[#00D4FF]/40 border border-[#00D4FF] flex items-center justify-center text-[10px] text-white font-mono">
                      Clip_02 (Hero)
                    </div>
                    <div className="w-1/5 rounded-lg bg-[#001AFF]/50 border border-[#001AFF] flex items-center justify-center text-[10px] text-white font-mono">
                      Clip_03
                    </div>
                    <div className="flex-1 rounded-lg bg-[#30C98B]/30 border border-[#30C98B] flex items-center justify-center text-[10px] text-white font-mono">
                      Outro
                    </div>
                  </div>

                  {/* Waveform track */}
                  <div className="h-6 rounded-lg bg-[#080B11] border border-[#1C283F] flex items-center px-2 gap-1 overflow-hidden">
                    {Array.from({ length: 60 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-[#00D4FF]/60 rounded-full"
                        style={{ height: `${Math.sin(i) * 12 + 14}px` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Themes & Pricing Section (Exact to Picture) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Themes Palette */}
              <div className="rounded-3xl border border-[#1C283F] bg-[#0A0E18] p-6 space-y-4">
                <h3 className="font-display font-semibold text-white text-sm">ZClip Themes</h3>
                <div className="grid grid-cols-5 gap-2.5">
                  {[
                    { name: "Dark Royal", color: "from-[#001AFF] to-[#0A0E18]" },
                    { name: "Cyber Blue", color: "from-[#00D4FF] to-[#0075FF]" },
                    { name: "Neon Glow", color: "from-[#8C7BFF] to-[#00D4FF]" },
                    { name: "Luxury Pro", color: "from-[#F2B84B] to-[#1A1A1A]" },
                    { name: "Minimal Plus", color: "from-[#F4F7FB] to-[#1C283F]" },
                  ].map((t) => (
                    <div
                      key={t.name}
                      className="rounded-2xl border border-[#1C283F] bg-[#101726] p-2 text-center hover:border-[#00D4FF] cursor-pointer transition group"
                    >
                      <div
                        className={`w-full h-12 rounded-xl bg-gradient-to-tr ${t.color} mb-1.5 shadow-sm group-hover:scale-105 transition`}
                      />
                      <span className="text-[10px] text-[#8A99AD] font-medium leading-tight block">
                        {t.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pricing Plans Box */}
              <div className="rounded-3xl border border-[#1C283F] bg-[#0A0E18] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-white text-sm">Pricing Plans</h3>
                  <span className="text-[10px] font-mono text-[#00D4FF] bg-[#00D4FF]/10 px-2 py-0.5 rounded-full border border-[#00D4FF]/30">
                    MONTHLY TIERS
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Plus */}
                  <div className="rounded-2xl border border-[#1C283F] bg-[#101726] p-3 text-center space-y-2">
                    <span className="text-xs font-semibold text-white">Plus</span>
                    <div className="font-mono text-base font-bold text-[#00D4FF]">₦5,000</div>
                    <ul className="text-[10px] text-[#8A99AD] space-y-1 text-left">
                      <li>• Basic Editing</li>
                      <li>• HD Export</li>
                      <li>• 1 Project at a time</li>
                    </ul>
                    <button className="w-full py-1.5 rounded-xl border border-[#1C283F] bg-[#151F33] text-xs font-semibold hover:border-[#00D4FF] transition">
                      Get Started
                    </button>
                  </div>

                  {/* Pro (Most Popular) */}
                  <div className="rounded-2xl border border-[#00D4FF] bg-[#151F33] p-3 text-center space-y-2 relative shadow-[0_0_15px_rgba(0,212,255,0.25)]">
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wider bg-[#00D4FF] text-black px-2 py-0.5 rounded-full">
                      Most Popular
                    </span>
                    <span className="text-xs font-semibold text-white">Pro</span>
                    <div className="font-mono text-base font-bold text-[#00D4FF]">₦8,000</div>
                    <ul className="text-[10px] text-[#8A99AD] space-y-1 text-left">
                      <li>• Advanced AI Tools</li>
                      <li>• 4K Export</li>
                      <li>• Unlimited Projects</li>
                    </ul>
                    <button className="w-full py-1.5 rounded-xl bg-gradient-to-r from-[#0075FF] to-[#00D4FF] text-black text-xs font-semibold hover:brightness-110 transition">
                      Upgrade
                    </button>
                  </div>

                  {/* Pro Max */}
                  <div className="rounded-2xl border border-[#1C283F] bg-[#101726] p-3 text-center space-y-2">
                    <span className="text-xs font-semibold text-white">Pro Max</span>
                    <div className="font-mono text-base font-bold text-[#00D4FF]">₦20,000</div>
                    <ul className="text-[10px] text-[#8A99AD] space-y-1 text-left">
                      <li>• All Features</li>
                      <li>• Priority Cloud Queue</li>
                      <li>• 100GB Storage</li>
                    </ul>
                    <button className="w-full py-1.5 rounded-xl border border-[#1C283F] bg-[#151F33] text-xs font-semibold hover:border-[#00D4FF] transition">
                      Go Pro
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Features Banner (From Picture) */}
            <div className="rounded-2xl border border-[#1C283F] bg-[#0A0E18] p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                {[
                  "AI-Powered Editing",
                  "Premium Templates",
                  "Cloud Rendering",
                  "4K Export Quality",
                  "Multi-Platform (PWA)",
                  "Secure & Reliable",
                ].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-[#F4F7FB]">
                    <CheckCircle2 size={15} className="text-[#00D4FF] shrink-0" />
                    <span className="font-medium text-[11px]">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </main>

          {/* Footer Bar */}
          <footer className="border-t border-[#1C283F] bg-[#0A0E18] px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-xs text-[#8A99AD] gap-2">
            <div className="flex items-center gap-3">
              <span className="font-display font-bold text-white">ZClip</span>
              <span>•</span>
              <span>Edit. Create. Share.</span>
            </div>
            <div className="text-[11px] font-mono">
              A Zyron Studio Product • Powered by Innovation • Built for Creators
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
