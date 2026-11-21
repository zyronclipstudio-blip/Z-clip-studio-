// Phone notifications from the app itself (no server, no extra data stored).
// They show only when ZClip is in the background, so a finished video never goes unnoticed.
export function canNotify(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

// Call from a tap (browsers only allow the permission prompt after a user gesture).
export async function askNotifyPermission(): Promise<void> {
  try {
    if (canNotify() && Notification.permission === "default") await Notification.requestPermission();
  } catch { /* ignore */ }
}

export async function notify(title: string, body: string, tag: string): Promise<void> {
  try {
    if (!canNotify() || Notification.permission !== "granted") return;
    if (document.visibilityState === "visible") return; // they are looking at the app already
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.showNotification(title, { body, tag, icon: "/icons/zclip-gold.svg", badge: "/icons/zclip-gold.svg", data: { url: "/" } });
  } catch { /* ignore */ }
}
