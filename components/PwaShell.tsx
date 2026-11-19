"use client";

import { useEffect, useState } from "react";
import { useOnline } from "@/lib/useOnline";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export default function PwaShell() {
  const online = useOnline();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  // Quiet auto-update: notice a newer build, then reload only when it can't interrupt anything.
  useEffect(() => {
    const mine = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!mine || process.env.NODE_ENV !== "production") return;
    const isBusy = () => (window as unknown as { __zclipBusy?: boolean }).__zclipBusy === true;
    let stale = false;
    const reload = () => {
      try { sessionStorage.setItem("zclip-updated-at", String(Date.now())); } catch { /* ignore */ }
      window.location.reload();
    };
    const check = async () => {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const data = await res.json();
        if (data.build && data.build !== mine) {
          stale = true;
          navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => undefined);
          if (!isBusy()) setUpdateReady(true);
        }
      } catch { /* offline: try again later */ }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Coming back to the app: the safest moment to swap in the new version.
      if (stale && !isBusy()) reload();
      else void check();
    };
    // A page from an older build can fail to load a file that no longer exists: recover once.
    const onError = (e: ErrorEvent) => {
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(`${e.message} ${e.error?.name ?? ""}`)) {
        let last = 0;
        try { last = Number(sessionStorage.getItem("zclip-updated-at") || 0); } catch { /* ignore */ }
        if (Date.now() - last > 15000) reload();
      }
    };
    const timer = window.setInterval(check, 60000);
    void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("error", onError);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("error", onError);
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      (window as unknown as { __zclipInstall?: Event }).__zclipInstall = event;
      window.dispatchEvent(new Event("zclip-install-ready"));
      setInstallEvent(event as InstallEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <>
      {updateReady && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-[#d9b45b]/40 bg-[#11141b] px-4 py-2 text-sm font-medium text-[#ecd083] shadow-lg"
        >
          New version ready · tap to refresh
        </button>
      )}
      {!online && (
        <div role="status" className="fixed inset-x-0 top-0 z-50 bg-warning px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-medium text-background">
          You&apos;re offline. Uploading and editing need a connection.
        </div>
      )}
    </>
  );
}