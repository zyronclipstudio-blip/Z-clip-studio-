// Keeps the clips (and sound) a person picked, on their own phone, so an accidental swipe-away
// or a refresh does not lose them. Nothing here is sent anywhere. Every call fails quietly.
const DB = "zclip-draft";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface Draft {
  files: File[];
  sound: File | null;
  mode: "auto" | "manual";
  savedAt: number;
}

export async function saveDraft(d: Omit<Draft, "savedAt">): Promise<void> {
  try {
    const bytes = d.files.reduce((t, f) => t + f.size, 0) + (d.sound?.size ?? 0);
    if (!d.files.length || bytes > 300 * 1024 * 1024) return;
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ ...d, savedAt: Date.now() }, "draft");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch { /* storage unavailable: carry on without a draft */ }
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const db = await open();
    const d = await new Promise<Draft | undefined>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get("draft");
      req.onsuccess = () => resolve(req.result as Draft | undefined);
      req.onerror = () => reject(req.error);
    });
    if (!d || Date.now() - d.savedAt > 24 * 3600 * 1000 || !d.files?.length) return null;
    return d;
  } catch {
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete("draft");
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch { /* ignore */ }
}
