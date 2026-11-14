"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useOnline } from "@/lib/useOnline";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

// Registers the service worker, shows connection status, and offers install where the browser allows it.
// (iOS Safari has no install prompt: use Share > Add to Home Screen.)
export default function PwaShell() {
  const online = useOnline();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
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
      {!online && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-50 bg-warning px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-center text-sm font-medium text-background"
        >
          You&apos;re offline. Uploading and editing need a connection.
        </div>
      )}
      {installEvent && (
        <button
          onClick={async () => {
            await installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
          }}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex min-h-11 items-center gap-2 rounded-full border border-cyan bg-surface px-4 py-2 text-sm text-cyan shadow-lg"
        >
          <Download size={16} /> Install ZClip
        </button>
      )}
    </>
  );
}
