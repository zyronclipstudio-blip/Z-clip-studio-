"use client";

// Last-resort screen: shows what actually broke (message only, no secrets) and a safe way back.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const clearAndReload = async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch { /* ignore */ }
    window.location.reload();
  };
  return (
    <html lang="en">
      <body style={{ background: "#05060a", color: "#eceff4", fontFamily: "system-ui, sans-serif", margin: 0, padding: 24 }}>
        <div style={{ maxWidth: 480, margin: "20vh auto 0" }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#8d97a8", margin: "0 0 16px" }}>ZClip hit a snag. Your projects are safe.</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#11141b", border: "1px solid #242a35", borderRadius: 12, padding: 12, fontSize: 12, color: "#ff6171" }}>
            {error.name}: {error.message}{error.digest ? `\nref ${error.digest}` : ""}
          </pre>
          <button onClick={reset} style={{ marginTop: 12, marginRight: 8, padding: "12px 16px", borderRadius: 12, border: "1px solid #242a35", background: "#181c25", color: "#eceff4" }}>Try again</button>
          <button onClick={clearAndReload} style={{ marginTop: 12, padding: "12px 16px", borderRadius: 12, border: 0, background: "#d9b45b", color: "#05060a", fontWeight: 600 }}>Clear and reload</button>
        </div>
      </body>
    </html>
  );
}
