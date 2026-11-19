"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download, Film, Home, LogOut, Plus } from "lucide-react";
import { ZClipLogo } from "@/components/ZClipLogo";

export type Tab = "home" | "new" | "edits";

interface Props {
  tab: Tab;
  onTab: (tab: Tab) => void;
  credits?: number;
  email?: string;
  onSignOut: () => void;
  /** Wider canvas on laptops, for screens that need room (the editor). */
  wide?: boolean;
  children: ReactNode;
}

// One shell for every screen, like Zyron Studio: header on top, content in the middle, the same
// bottom navigation everywhere. Screens never carry their own logo, credits or sign-out.
export function AppShell({ tab, onTab, credits, email, onSignOut, wide, children }: Props) {
  type Installer = Event & { prompt(): Promise<void>; userChoice: Promise<unknown> };
  const [installer, setInstaller] = useState<Installer | null>(null);
  useEffect(() => {
    const read = () => setInstaller(((window as unknown as { __zclipInstall?: Installer }).__zclipInstall) ?? null);
    read();
    window.addEventListener("zclip-install-ready", read);
    window.addEventListener("appinstalled", () => setInstaller(null));
    return () => window.removeEventListener("zclip-install-ready", read);
  }, []);
  const hasBalance = typeof credits === "number" && Number.isFinite(credits);
  return (
    <div className="relative min-h-screen bg-[#05060a] text-[#eceff4]">
      <div className={`mx-auto flex min-h-screen w-full flex-col px-5 pb-32 pt-5 ${wide ? "max-w-md lg:max-w-6xl lg:px-8" : "max-w-md"}`}>
        <header className="mb-5 flex items-center justify-between gap-3">
          <button type="button" onClick={() => onTab("home")} aria-label="ZClip home" className="text-left">
            <ZClipLogo size={34} variant="horizontal" />
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex min-h-11 items-center rounded-full border border-[#242a35] bg-[#11141b] px-3.5 text-sm text-[#8d97a8]">
              <b className="mr-1 font-semibold text-[#ecd083]">{hasBalance ? new Intl.NumberFormat("en-NG").format(credits) : "—"}</b>
              {hasBalance ? (credits === 1 ? "credit" : "credits") : ""}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title={email ? `Sign out ${email}` : "Sign out"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-[#242a35] bg-[#11141b] text-[#c3cad6] transition hover:border-[#d9b45b]/40"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col">{children}</div>
        {installer && (
          <button
            type="button"
            onClick={async () => {
              await installer.prompt();
              await installer.userChoice;
              setInstaller(null);
            }}
            className="mx-auto mt-8 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9b45b]/40 bg-[#11141b] px-4 text-sm text-[#ecd083]"
          >
            <Download size={16} /> Install ZClip
          </button>
        )}
        <p className="mt-6 text-center text-xs tracking-[0.04em] text-[#7b8596]">Proudly by Zyron</p>
      </div>

      <nav className="zy-nav" aria-label="Main">
        <button type="button" aria-current={tab === "home" ? "page" : undefined} onClick={() => onTab("home")}><Home size={22} />Home</button>
        <button type="button" className="fab" aria-current={tab === "new" ? "page" : undefined} onClick={() => onTab("new")} aria-label="Create a video"><span className="disc"><Plus size={26} strokeWidth={2.4} /></span></button>
        <button type="button" aria-current={tab === "edits" ? "page" : undefined} onClick={() => onTab("edits")}><Film size={22} />My Edits</button>
      </nav>
    </div>
  );
}
