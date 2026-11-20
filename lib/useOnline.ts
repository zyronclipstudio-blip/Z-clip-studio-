"use client";

import { useEffect, useState } from "react";

// navigator.onLine is unreliable on phones (it can say "offline" while the connection works), so
// "offline" is only believed after ZClip itself fails to answer.
async function reachable(): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(`/api/version?ping=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    let alive = true;
    let poll: ReturnType<typeof setInterval> | undefined;
    const verify = async () => {
      if (await reachable()) {
        if (alive) setOnline(true);
        if (poll) {
          clearInterval(poll);
          poll = undefined;
        }
        return;
      }
      if (alive) setOnline(false);
      if (!poll) poll = setInterval(verify, 5000);
    };
    const on = () => void verify();
    const off = () => void verify();
    if (!navigator.onLine) void verify();
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      alive = false;
      if (poll) clearInterval(poll);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}
